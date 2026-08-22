import { db } from '@/lib/db'

/**
 * Downloadable backup of everything the app holds for one user.
 *
 * Read straight from Dexie: after login the cloud copy has already been pulled
 * in, so the local store is the complete picture and the export works offline.
 * Its only job is to make a wipe survivable — "borré todo sin querer" becomes
 * recoverable instead of final.
 */

export interface DataExport {
  version: 1
  exported_at: string
  user_id: string
  tables: Record<string, unknown[]>
}

/** Tables included in a backup, in the order they appear in the file. */
export const EXPORT_TABLES = [
  'user_profiles', 'platforms', 'pockets', 'categories', 'transactions',
  'debts', 'collections', 'saving_goals', 'cadenas', 'scheduled_events',
  'recurring_payments',
] as const

export async function buildExport(userId: string): Promise<DataExport> {
  const tables: Record<string, unknown[]> = {}

  // user_profiles is keyed by the user id itself; every other table has user_id.
  const profile = await db.user_profiles.get(userId)
  tables.user_profiles = profile ? [profile] : []

  for (const name of EXPORT_TABLES) {
    if (name === 'user_profiles') continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[name]
    const rows = await table.where('user_id').equals(userId).toArray()
    tables[name] = rows
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: userId,
    tables,
  }
}

/** `mis-finanzas-2026-08-21.json` */
export function exportFileName(now = new Date()): string {
  return `mis-finanzas-${now.toISOString().slice(0, 10)}.json`
}

/** Builds the backup and hands it to the browser as a download. */
export async function downloadExport(userId: string): Promise<void> {
  const data = await buildExport(userId)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
