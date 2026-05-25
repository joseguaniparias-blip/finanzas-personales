import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

// Prevents circular sync: pull → hook → push → loop
let syncing = false
let hooksSetup = false

// Dexie stores these booleans as 0/1 due to IndexedDB index limitations.
// Supabase expects actual booleans.
const BOOL_FIELDS: Record<string, string[]> = {
  user_profiles: ['onboarding_completed', 'balance_hidden'],
  platforms:     ['is_active'],
  pockets:       ['is_active'],
  categories:    ['is_default'],
  debts:         ['has_total', 'started_before_app'],
  collections:   ['has_total', 'started_before_app'],
  saving_goals:  ['is_active'],
  cadenas:       ['started_before_app'],
}

function toSupabase(table: string, record: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...record }
  for (const field of BOOL_FIELDS[table] ?? []) {
    if (field in copy) copy[field] = Boolean(copy[field])
  }
  return copy
}

function pushRecord(table: string, record: Record<string, unknown>) {
  if (syncing) return
  supabase.from(table).upsert(toSupabase(table, record)).then(({ error }) => {
    if (error) console.warn(`[sync] push error on ${table}:`, error.message)
  })
}

function deleteRecord(table: string, id: string) {
  if (syncing) return
  supabase.from(table).delete().eq('id', id).then(({ error }) => {
    if (error) console.warn(`[sync] delete error on ${table}:`, error.message)
  })
}

export function setupSyncHooks() {
  if (hooksSetup) return
  hooksSetup = true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables: [string, any][] = [
    ['platforms',        db.platforms],
    ['pockets',          db.pockets],
    ['categories',       db.categories],
    ['transactions',     db.transactions],
    ['debts',            db.debts],
    ['collections',      db.collections],
    ['saving_goals',     db.saving_goals],
    ['cadenas',          db.cadenas],
    ['scheduled_events', db.scheduled_events],
    ['user_profiles',    db.user_profiles],
  ]

  for (const [tableName, table] of tables) {
    table.hook('creating', (_key: unknown, obj: Record<string, unknown>) => {
      pushRecord(tableName, obj)
    })
    table.hook('updating', (mods: Record<string, unknown>, _key: unknown, obj: Record<string, unknown>) => {
      pushRecord(tableName, { ...obj, ...mods })
    })
    table.hook('deleting', (key: string) => {
      deleteRecord(tableName, key)
    })
  }
}

/**
 * Pulls data from Supabase into the local Dexie store.
 *
 * IMPORTANT — only runs when the local store is EMPTY for this user.
 * Previously this ran on every login and `bulkPut` overwrote local records
 * with whatever the server had, silently destroying offline-only changes
 * that hadn't been pushed yet (network failure, slow background sync).
 *
 * Trade-off: multi-device sync is degraded. Changes made on device B won't
 * automatically appear on device A unless A's local store is cleared. The
 * proper fix requires `updated_at` columns + per-row conflict resolution,
 * which is a schema change deferred to a separate task.
 */
export async function pullFromSupabase(userId: string) {
  syncing = true
  try {
    // Decide if local store is "empty" for this user. We check a few key
    // tables; if any has data, we treat local as the source of truth and skip
    // the pull entirely.
    const [localPocketsCount, localTxsCount, localProfile] = await Promise.all([
      db.pockets.where('user_id').equals(userId).count(),
      db.transactions.where('user_id').equals(userId).count(),
      db.user_profiles.get(userId),
    ])
    const hasLocalData = localPocketsCount > 0 || localTxsCount > 0 || !!localProfile
    if (hasLocalData) {
      // Skip — local store wins. Push hooks will keep server in sync going forward.
      return
    }

    const [
      { data: platforms },
      { data: pockets },
      { data: categories },
      { data: transactions },
      { data: debts },
      { data: collections },
      { data: saving_goals },
      { data: cadenas },
      { data: scheduled_events },
      { data: user_profiles },
    ] = await Promise.all([
      supabase.from('platforms').select('*').eq('user_id', userId),
      supabase.from('pockets').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('debts').select('*').eq('user_id', userId),
      supabase.from('collections').select('*').eq('user_id', userId),
      supabase.from('saving_goals').select('*').eq('user_id', userId),
      supabase.from('cadenas').select('*').eq('user_id', userId),
      supabase.from('scheduled_events').select('*').eq('user_id', userId),
      supabase.from('user_profiles').select('*').eq('id', userId),
    ])

    await db.transaction('rw', [
      db.platforms, db.pockets, db.categories, db.transactions,
      db.debts, db.collections, db.saving_goals, db.cadenas,
      db.scheduled_events, db.user_profiles,
    ], async () => {
      if (platforms?.length)        await db.platforms.bulkPut(platforms)
      if (pockets?.length)          await db.pockets.bulkPut(pockets)
      if (categories?.length)       await db.categories.bulkPut(categories)
      if (transactions?.length)     await db.transactions.bulkPut(transactions)
      if (debts?.length)            await db.debts.bulkPut(debts)
      if (collections?.length)      await db.collections.bulkPut(collections)
      if (saving_goals?.length)     await db.saving_goals.bulkPut(saving_goals)
      if (cadenas?.length)          await db.cadenas.bulkPut(cadenas)
      if (scheduled_events?.length) await db.scheduled_events.bulkPut(scheduled_events)
      if (user_profiles?.length)    await db.user_profiles.bulkPut(user_profiles)
    })
  } catch (e) {
    console.warn('[sync] pull failed:', e)
  } finally {
    syncing = false
  }
}
