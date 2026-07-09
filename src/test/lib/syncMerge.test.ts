import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { isServerNewer, mergeServerRows } from '@/lib/sync'
import type { Pocket } from '@/types'

function pocket(id: string, balance: number, updated_at?: string): Pocket {
  return {
    id, user_id: 'u', name: id, type: 'cash', platform_id: null,
    balance, color: '#000', icon: '💵', is_active: true, created_at: '',
    ...(updated_at ? { updated_at } : {}),
  } as Pocket
}

beforeEach(async () => { await db.pockets.clear() })

describe('isServerNewer', () => {
  it('is true when the server timestamp is greater', () => {
    expect(isServerNewer({ updated_at: '2026-07-02T00:00:00Z' }, { updated_at: '2026-07-01T00:00:00Z' })).toBe(true)
  })
  it('is false when the local timestamp is greater', () => {
    expect(isServerNewer({ updated_at: '2026-07-01T00:00:00Z' }, { updated_at: '2026-07-02T00:00:00Z' })).toBe(false)
  })
  it('is true when server has a timestamp and local has none (server migrated first)', () => {
    expect(isServerNewer({ updated_at: '2026-07-01T00:00:00Z' }, {})).toBe(true)
  })
  it('is false when server has no timestamp (do not clobber local)', () => {
    expect(isServerNewer({}, { updated_at: '2026-07-01T00:00:00Z' })).toBe(false)
    expect(isServerNewer({}, {})).toBe(false)
  })
})

describe('mergeServerRows', () => {
  it('overwrites a local row that is older than the server', async () => {
    await db.pockets.add(pocket('p1', 100, '2026-07-01T00:00:00Z'))
    await mergeServerRows(db.pockets, [pocket('p1', 999, '2026-07-02T00:00:00Z')])
    expect((await db.pockets.get('p1'))?.balance).toBe(999)
  })

  it('keeps a local row that is newer than the server', async () => {
    await db.pockets.add(pocket('p1', 100, '2026-07-03T00:00:00Z'))
    await mergeServerRows(db.pockets, [pocket('p1', 999, '2026-07-02T00:00:00Z')])
    expect((await db.pockets.get('p1'))?.balance).toBe(100)
  })

  it('inserts a server row that is missing locally (arrived from another device)', async () => {
    await mergeServerRows(db.pockets, [pocket('p2', 500, '2026-07-02T00:00:00Z')])
    expect((await db.pockets.get('p2'))?.balance).toBe(500)
  })

  it('does nothing for an empty or null server set', async () => {
    await db.pockets.add(pocket('p1', 100, '2026-07-01T00:00:00Z'))
    await mergeServerRows(db.pockets, null)
    await mergeServerRows(db.pockets, [])
    expect((await db.pockets.get('p1'))?.balance).toBe(100)
  })
})
