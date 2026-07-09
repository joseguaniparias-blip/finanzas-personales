import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { enqueueSyncOp, getSyncQueue, processSyncQueue } from '@/lib/syncQueue'

beforeEach(async () => { await db.sync_queue.clear() })

describe('sync queue', () => {
  it('enqueues an upsert op keyed by table:id', async () => {
    await enqueueSyncOp('upsert', 'pockets', { id: 'p1', balance: 100 })
    const q = await getSyncQueue()
    expect(q).toHaveLength(1)
    expect(q[0]).toMatchObject({ op: 'upsert', table: 'pockets', key: 'pockets:p1' })
  })

  it('dedups repeated ops for the same record, keeping the latest payload', async () => {
    await enqueueSyncOp('upsert', 'pockets', { id: 'p1', balance: 100 })
    await enqueueSyncOp('upsert', 'pockets', { id: 'p1', balance: 250 })
    const q = await getSyncQueue()
    expect(q).toHaveLength(1)
    expect(q[0].payload.balance).toBe(250)
  })

  it('a delete supersedes a pending upsert for the same record', async () => {
    await enqueueSyncOp('upsert', 'pockets', { id: 'p1', balance: 100 })
    await enqueueSyncOp('delete', 'pockets', { id: 'p1' })
    const q = await getSyncQueue()
    expect(q).toHaveLength(1)
    expect(q[0].op).toBe('delete')
  })

  it('clears ops the runner processes successfully', async () => {
    await enqueueSyncOp('upsert', 'pockets', { id: 'p1', balance: 100 })
    await enqueueSyncOp('upsert', 'debts', { id: 'd1' })
    const res = await processSyncQueue(async () => { /* success */ })
    expect(res.succeeded).toBe(2)
    expect(await getSyncQueue()).toHaveLength(0)
  })

  it('keeps ops the runner fails on and counts the attempt', async () => {
    await enqueueSyncOp('upsert', 'pockets', { id: 'p1', balance: 100 })
    const res = await processSyncQueue(async () => { throw new Error('offline') })
    expect(res.failed).toBe(1)
    const q = await getSyncQueue()
    expect(q).toHaveLength(1)
    expect(q[0].attempts).toBe(1)
  })
})
