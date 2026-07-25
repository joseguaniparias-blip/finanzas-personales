import { supabase } from '@/lib/supabase'
import { db, type SyncOp } from '@/lib/db'
import { enqueueSyncOp, processSyncQueue } from '@/lib/syncQueue'
import type { Table } from 'dexie'

// Prevents circular sync: pull → hook → push → loop
let syncing = false
let hooksSetup = false

const nowISO = () => new Date().toISOString()

/**
 * Last-writer-wins comparison for a pulled row vs its local copy. The server
 * wins only when it is strictly newer. If the server row has no `updated_at`
 * yet (pre-migration), we never clobber the local copy.
 */
export function isServerNewer(
  server: { updated_at?: string },
  local: { updated_at?: string },
): boolean {
  const s = server.updated_at
  const l = local.updated_at
  if (s && l) return s > l
  if (s && !l) return true
  return false
}

/** Merge server rows into a Dexie table by last-writer-wins on `updated_at`. */
export async function mergeServerRows<T extends { id: string; updated_at?: string }>(
  table: Table<T>,
  rows: T[] | null | undefined,
): Promise<void> {
  if (!rows?.length) return
  for (const row of rows) {
    const local = await table.get(row.id)
    if (!local || isServerNewer(row, local)) {
      await table.put(row)
    }
  }
}

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
  recurring_payments: ['is_variable', 'is_active'],
}

/**
 * The exact set of columns each table has in Supabase (per migrations 001–005).
 * `toSupabase` sends ONLY these, so a field that lives only in the local Dexie
 * store — a UI flag, or a new column whose migration hasn't run yet — never
 * reaches the upsert. Without this guard an unknown column makes PostgREST
 * reject the whole row, and the op is parked in the outbox retrying forever
 * (local works, but the row never syncs). Keep in lockstep with the SQL schema.
 */
export const SUPABASE_COLUMNS: Record<string, string[]> = {
  user_profiles: ['id', 'name', 'onboarding_completed', 'balance_hidden', 'created_at', 'updated_at'],
  platforms: ['id', 'user_id', 'name', 'color', 'payout_day', 'payout_pocket_id', 'is_active',
    'created_at', 'updated_at', 'last_closed_sunday'],
  pockets: ['id', 'user_id', 'name', 'type', 'platform_id', 'balance', 'color', 'icon',
    'is_active', 'created_at', 'updated_at'],
  categories: ['id', 'user_id', 'name', 'icon', 'monthly_limit', 'is_default', 'kind',
    'created_at', 'updated_at'],
  transactions: ['id', 'user_id', 'type', 'amount', 'pocket_id', 'category_id', 'platform_id',
    'reference_id', 'reference_type', 'note', 'receipt_url', 'date', 'created_at',
    'transfer_group_id', 'transfer_other_pocket_id', 'event_id', 'updated_at'],
  debts: ['id', 'user_id', 'name', 'has_total', 'total_amount', 'installment_amount', 'frequency',
    'payment_day', 'source_pocket_id', 'paid_amount', 'status', 'started_before_app',
    'start_installment', 'created_at', 'updated_at'],
  collections: ['id', 'user_id', 'name', 'person_name', 'has_total', 'total_amount',
    'installment_amount', 'frequency', 'payment_day', 'dest_pocket_id', 'collected_amount',
    'status', 'start_date', 'started_before_app', 'start_installment', 'created_at', 'updated_at'],
  saving_goals: ['id', 'user_id', 'name', 'target_amount', 'contribution_amount', 'contribution_type',
    'frequency', 'trigger_day', 'source_pocket_id', 'saved_amount', 'is_active', 'created_at', 'updated_at'],
  cadenas: ['id', 'user_id', 'name', 'participants', 'contribution_amount', 'frequency', 'my_turn',
    'payout_pocket_id', 'source_pocket_id', 'current_round', 'paid_rounds', 'started_before_app',
    'status', 'created_at', 'updated_at'],
  scheduled_events: ['id', 'user_id', 'type', 'reference_id', 'reference_type', 'amount', 'due_date',
    'status', 'actual_pocket_id', 'partial_amount', 'remaining_after_partial', 'created_at', 'updated_at'],
  recurring_payments: ['id', 'user_id', 'name', 'icon', 'amount', 'is_variable', 'frequency',
    'trigger_day', 'source_pocket_id', 'category_id', 'is_active', 'created_at', 'updated_at'],
}

export function toSupabase(table: string, record: Record<string, unknown>): Record<string, unknown> {
  const allowed = SUPABASE_COLUMNS[table]
  const bools = BOOL_FIELDS[table] ?? []
  const out: Record<string, unknown> = {}
  // Fall back to the raw record if a table has no declared allowlist (shouldn't
  // happen for synced tables), so we never silently send nothing.
  const keys = allowed ?? Object.keys(record)
  for (const key of keys) {
    if (!(key in record)) continue
    out[key] = bools.includes(key) ? Boolean(record[key]) : record[key]
  }
  return out
}

function pushRecord(table: string, record: Record<string, unknown>) {
  if (syncing) return
  // Optimistic push. If it fails (offline, transient, RLS hiccup) park the op in
  // the durable outbox so it's retried on next load / reconnect instead of lost.
  supabase.from(table).upsert(toSupabase(table, record)).then(
    ({ error }) => { if (error) enqueueSyncOp('upsert', table, record) },
    () => { enqueueSyncOp('upsert', table, record) },
  )
}

function deleteRecord(table: string, id: string) {
  if (syncing) return
  supabase.from(table).delete().eq('id', id).then(
    ({ error }) => { if (error) enqueueSyncOp('delete', table, { id }) },
    () => { enqueueSyncOp('delete', table, { id }) },
  )
}

/** Executes one queued op against Supabase; throws on error so it stays queued. */
async function runSyncOp(op: SyncOp): Promise<void> {
  if (op.op === 'delete') {
    const { error } = await supabase.from(op.table).delete().eq('id', op.payload.id as string)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from(op.table).upsert(toSupabase(op.table, op.payload))
    if (error) throw new Error(error.message)
  }
}

/** Retries every parked sync op. Safe to call repeatedly; no-op while pulling. */
export async function flushSyncQueue(): Promise<void> {
  if (syncing) return
  await processSyncQueue(runSyncOp)
}

export function setupSyncHooks() {
  if (hooksSetup) return
  hooksSetup = true

  // Retry parked ops whenever connectivity returns.
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { flushSyncQueue() })
  }

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
    ['recurring_payments', db.recurring_payments],
    ['user_profiles',    db.user_profiles],
  ]

  for (const [tableName, table] of tables) {
    table.hook('creating', (_key: unknown, obj: Record<string, unknown>) => {
      // Stamp updated_at for last-writer-wins sync (unless we're applying a pull,
      // where the server's own timestamp must be preserved).
      if (!syncing && obj.updated_at == null) obj.updated_at = nowISO()
      pushRecord(tableName, obj)
    })
    table.hook('updating', (mods: Record<string, unknown>, _key: unknown, obj: Record<string, unknown>) => {
      if (syncing) return
      const updated_at = nowISO()
      pushRecord(tableName, { ...obj, ...mods, updated_at })
      return { updated_at }
    })
    table.hook('deleting', (key: string) => {
      deleteRecord(tableName, key)
    })
  }
}

/**
 * Pulls cloud data into local Dexie, merging by last-writer-wins on
 * `updated_at`. Runs on every login: a row is overwritten locally only when the
 * server copy is strictly newer, so a change made on another device propagates
 * here while local-only edits that are newer are preserved (and later flushed
 * by the outbox). Requires migration 003 (updated_at columns); before that the
 * merge is conservative and never clobbers local rows.
 */
export async function pullFromSupabase(userId: string) {
  syncing = true
  try {
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
      { data: recurring_payments },
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
      supabase.from('recurring_payments').select('*').eq('user_id', userId),
      supabase.from('user_profiles').select('*').eq('id', userId),
    ])

    await db.transaction('rw', [
      db.platforms, db.pockets, db.categories, db.transactions,
      db.debts, db.collections, db.saving_goals, db.cadenas,
      db.scheduled_events, db.recurring_payments, db.user_profiles,
    ], async () => {
      await mergeServerRows(db.platforms, platforms)
      await mergeServerRows(db.pockets, pockets)
      await mergeServerRows(db.categories, categories)
      await mergeServerRows(db.transactions, transactions)
      await mergeServerRows(db.debts, debts)
      await mergeServerRows(db.collections, collections)
      await mergeServerRows(db.saving_goals, saving_goals)
      await mergeServerRows(db.cadenas, cadenas)
      await mergeServerRows(db.scheduled_events, scheduled_events)
      await mergeServerRows(db.recurring_payments, recurring_payments)
      await mergeServerRows(db.user_profiles, user_profiles)
    })
  } catch (e) {
    console.warn('[sync] pull failed:', e)
  } finally {
    syncing = false
  }
}
