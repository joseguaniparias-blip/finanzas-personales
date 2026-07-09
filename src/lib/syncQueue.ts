import { db, type SyncOp } from '@/lib/db'

/**
 * Local durable outbox for cloud sync. When a push to Supabase fails (offline,
 * transient error), the operation is parked here and retried later instead of
 * being lost. Ops are keyed by `${table}:${recordId}` so repeated writes to the
 * same record collapse to a single pending op (latest payload wins; a delete
 * supersedes a pending upsert).
 */

export async function enqueueSyncOp(
  op: SyncOp['op'],
  table: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = payload.id as string
  const key = `${table}:${id}`
  const existing = await db.sync_queue.get(key)
  await db.sync_queue.put({
    key,
    op,
    table,
    payload,
    attempts: existing?.attempts ?? 0,
    updated_at: new Date().toISOString(),
  })
}

export async function getSyncQueue(): Promise<SyncOp[]> {
  return db.sync_queue.toArray()
}

/**
 * Drains the queue, handing each op to `run`. Ops that succeed are removed;
 * ops that throw are kept with their attempt count bumped, to be retried on the
 * next flush (app load or reconnect).
 */
export async function processSyncQueue(
  run: (op: SyncOp) => Promise<void>,
): Promise<{ succeeded: number; failed: number }> {
  const ops = await db.sync_queue.toArray()
  let succeeded = 0
  let failed = 0

  for (const op of ops) {
    try {
      await run(op)
      await db.sync_queue.delete(op.key)
      succeeded++
    } catch {
      await db.sync_queue.update(op.key, { attempts: op.attempts + 1 })
      failed++
    }
  }

  return { succeeded, failed }
}
