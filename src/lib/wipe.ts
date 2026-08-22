import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { withSyncSuspended } from '@/lib/sync'

/**
 * Full data reset and account deletion.
 *
 * Three rules hold every flow here together:
 *
 * 1. **Cloud first, local second.** If the local store were cleared first and
 *    the cloud delete then failed, the next `pullFromSupabase` would restore
 *    everything and the wipe would silently undo itself. Every step is
 *    idempotent, so retrying after a partial failure finishes the job.
 * 2. **Purge the outbox before the tables.** Pushes parked in `sync_queue` are
 *    replayed on reconnect; leaving them behind resurrects deleted rows.
 * 3. **Mute the sync hooks.** Clearing tables row by row would otherwise fire
 *    one DELETE per row against Supabase, on top of the bulk delete already done.
 */

/** Tables that hold user data, all keyed by `user_id`. */
const DATA_TABLES = [
  'platforms', 'pockets', 'categories', 'transactions', 'debts',
  'collections', 'saving_goals', 'cadenas', 'scheduled_events',
  'recurring_payments',
] as const

/** Thrown when a wipe is attempted without connectivity. */
export class OfflineError extends Error {
  constructor() {
    super('Necesitas conexión para borrar tus datos.')
    this.name = 'OfflineError'
  }
}

export type WipeStep = 'cloud' | 'local'
export interface WipeOptions {
  onProgress?: (step: WipeStep) => void
}

function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OfflineError()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any)[name]
}

/**
 * How much data the user is about to lose, for the confirmation screen. Naming
 * the real numbers ("412 movimientos, 5 bolsillos") deters far better than a
 * generic "esto es irreversible".
 */
export async function countUserData(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const name of DATA_TABLES) {
    counts[name] = await table(name).where('user_id').equals(userId).count()
  }
  return counts
}

/** Deletes this user's rows from every cloud data table. Throws on first failure. */
async function wipeCloudData(userId: string): Promise<void> {
  for (const name of DATA_TABLES) {
    const { error } = await supabase.from(name).delete().eq('user_id', userId)
    if (error) {
      throw new Error(`No se pudo borrar "${name}" en la nube: ${error.message}`)
    }
  }
}

/**
 * Clears this user's rows from Dexie. Scoped by `user_id` rather than a blanket
 * `clear()` so a second account's data on the same device is never collateral.
 */
async function wipeLocalData(userId: string): Promise<void> {
  await withSyncSuspended(async () => {
    // Outbox first: a parked upsert replayed later would revive a deleted row.
    await db.sync_queue.clear()
    for (const name of DATA_TABLES) {
      await table(name).where('user_id').equals(userId).delete()
    }
  })
}

/**
 * Wipes every trace of the user's data while keeping the account. The profile
 * survives with `onboarding_completed: false` — the app drops back into the
 * onboarding flow — and with a fresh `wiped_at` so the user's other devices
 * clear themselves instead of re-uploading their stale copies.
 */
export async function resetAllData(userId: string, opts: WipeOptions = {}): Promise<void> {
  assertOnline()
  const wipedAt = new Date().toISOString()

  opts.onProgress?.('cloud')
  await wipeCloudData(userId)
  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_completed: false, wiped_at: wipedAt, updated_at: wipedAt })
    .eq('id', userId)
  if (error) {
    throw new Error(`No se pudo reiniciar el perfil en la nube: ${error.message}`)
  }

  opts.onProgress?.('local')
  await wipeLocalData(userId)
  await withSyncSuspended(async () => {
    const profile = await db.user_profiles.get(userId)
    if (profile) {
      await db.user_profiles.put({
        ...profile,
        onboarding_completed: false,
        wiped_at: wipedAt,
        // Keep the local copy's timestamp in step with the server's so the
        // last-writer-wins merge on the next pull is a no-op, not a fight.
        updated_at: wipedAt,
      } as typeof profile)
    }
  })
}

/**
 * Deletes the Supabase auth user, then everything local.
 *
 * The cloud side is one RPC: every data table declares
 * `references auth.users on delete cascade`, so removing the auth row takes the
 * rest with it. The anon key cannot touch `auth.users` directly, hence the
 * `SECURITY DEFINER` function from migration 006.
 */
export async function deleteAccount(userId: string, opts: WipeOptions = {}): Promise<void> {
  assertOnline()

  opts.onProgress?.('cloud')
  const { error } = await supabase.rpc('delete_my_account')
  if (error) {
    throw new Error(`No se pudo eliminar la cuenta: ${error.message}`)
  }

  opts.onProgress?.('local')
  await wipeLocalData(userId)
  await withSyncSuspended(async () => {
    await db.user_profiles.delete(userId)
  })
  await supabase.auth.signOut()
}

/**
 * Startup guard for the user's *other* devices.
 *
 * A device that was offline (or simply closed) during a reset still holds the
 * full local copy, and its outbox would happily push it all back. Before the
 * outbox is flushed, compare the server's `wiped_at` against ours: if the
 * server's is strictly newer, this device missed a reset and clears itself.
 *
 * The device that performed the reset already carries the same mark, so this is
 * a no-op there. Offline, the lookup fails and we simply try again next launch.
 *
 * @returns whether a local wipe was performed.
 */
export async function checkRemoteWipe(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wiped_at')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data?.wiped_at) return false

    const local = await db.user_profiles.get(userId)
    // No local profile means no local data to revive; the pull will bring the
    // mark down with the profile.
    if (!local) return false
    if (local.wiped_at && local.wiped_at >= data.wiped_at) return false

    await wipeLocalData(userId)
    await withSyncSuspended(async () => {
      await db.user_profiles.put({ ...local, wiped_at: data.wiped_at })
    })
    return true
  } catch (e) {
    console.warn('[wipe] checkRemoteWipe failed:', e)
    return false
  }
}
