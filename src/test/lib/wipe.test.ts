import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/lib/db'

// ─── Supabase mock ───────────────────────────────────────────────────────────
// Records every delete/update/rpc so we can assert the cloud side ran, and lets
// a test force a failure to prove the local store is left untouched.

const calls: { deletes: string[]; updates: Record<string, unknown>[]; rpc: string[] } = {
  deletes: [], updates: [], rpc: [],
}
let failOnTable: string | null = null
let rpcError: string | null = null
let remoteWipedAt: string | null = null

const signOut = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signOut: () => signOut() },
    rpc: (name: string) => {
      calls.rpc.push(name)
      return Promise.resolve({ error: rpcError ? { message: rpcError } : null })
    },
    from: (table: string) => ({
      delete: () => ({
        eq: () => {
          calls.deletes.push(table)
          return Promise.resolve({
            error: failOnTable === table ? { message: 'boom' } : null,
          })
        },
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: () => {
          calls.updates.push({ table, ...payload })
          return Promise.resolve({ error: null })
        },
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { wiped_at: remoteWipedAt }, error: null,
          }),
        }),
      }),
    }),
  },
}))

const { resetAllData, deleteAccount, checkRemoteWipe, countUserData, OfflineError } =
  await import('@/lib/wipe')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER = 'user-1'
const OTHER = 'user-2'

async function seed() {
  await db.user_profiles.put({
    id: USER, name: 'José', onboarding_completed: true,
    balance_hidden: false, created_at: '2026-01-01T00:00:00.000Z',
  })
  await db.pockets.bulkAdd([
    { id: 'p1', user_id: USER, name: 'Efectivo', type: 'cash', platform_id: null,
      balance: 50000, color: '', icon: '', is_active: true, created_at: '' },
    { id: 'p2', user_id: OTHER, name: 'Ajeno', type: 'cash', platform_id: null,
      balance: 1, color: '', icon: '', is_active: true, created_at: '' },
  ])
  await db.transactions.bulkAdd([
    { id: 't1', user_id: USER, type: 'expense', amount: 1000, pocket_id: 'p1',
      category_id: null, platform_id: null, reference_id: null, reference_type: null,
      note: null, receipt_url: null, date: '2026-08-01', created_at: '' },
    { id: 't2', user_id: USER, type: 'expense', amount: 2000, pocket_id: 'p1',
      category_id: null, platform_id: null, reference_id: null, reference_type: null,
      note: null, receipt_url: null, date: '2026-08-02', created_at: '' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any)
  await db.sync_queue.put({
    key: 'transactions:t1', op: 'upsert', table: 'transactions',
    payload: { id: 't1' }, attempts: 0, updated_at: '',
  })
}

beforeEach(async () => {
  calls.deletes = []; calls.updates = []; calls.rpc = []
  failOnTable = null; rpcError = null; remoteWipedAt = null
  signOut.mockClear()
  await Promise.all([
    db.user_profiles.clear(), db.pockets.clear(), db.transactions.clear(),
    db.sync_queue.clear(),
  ])
  await seed()
})

// ─── countUserData ───────────────────────────────────────────────────────────

describe('countUserData', () => {
  it('counts only this user’s rows', async () => {
    const counts = await countUserData(USER)
    expect(counts.transactions).toBe(2)
    expect(counts.pockets).toBe(1)   // the other user's pocket is not counted
  })
})

// ─── resetAllData ────────────────────────────────────────────────────────────

describe('resetAllData', () => {
  it('deletes every data table in the cloud', async () => {
    await resetAllData(USER)
    expect(calls.deletes).toEqual(expect.arrayContaining([
      'platforms', 'pockets', 'categories', 'transactions', 'debts',
      'collections', 'saving_goals', 'cadenas', 'scheduled_events',
      'recurring_payments',
    ]))
    expect(calls.deletes).toHaveLength(10)
  })

  it('deletes children before parents, or Postgres rejects the wipe', async () => {
    // Six tables reference pockets with `on delete restrict` (migraciones 001 y
    // 002). Deleting pockets while any of them still has rows raises
    // "violates foreign key constraint transactions_pocket_id_fkey" and the
    // whole reset aborts. The mock has no FKs, so only the ORDER can be
    // asserted here — and the order is load-bearing, not cosmetic.
    const RESTRICT_ON_POCKETS = [
      'transactions', 'debts', 'collections', 'saving_goals', 'cadenas',
      'recurring_payments',
    ]
    await resetAllData(USER)
    const pocketsAt = calls.deletes.indexOf('pockets')
    expect(pocketsAt).toBeGreaterThanOrEqual(0)
    for (const child of RESTRICT_ON_POCKETS) {
      expect(
        calls.deletes.indexOf(child),
        `"${child}" referencia a pockets con RESTRICT: debe borrarse ANTES`,
      ).toBeLessThan(pocketsAt)
    }
  })

  it('clears local data and purges the outbox', async () => {
    await resetAllData(USER)
    expect(await db.transactions.count()).toBe(0)
    expect(await db.sync_queue.count()).toBe(0)
  })

  it('leaves another user’s local rows alone', async () => {
    await resetAllData(USER)
    expect(await db.pockets.get('p2')).toBeDefined()
  })

  it('keeps the profile, sends it back to onboarding and stamps wiped_at', async () => {
    await resetAllData(USER)
    const profile = await db.user_profiles.get(USER)
    expect(profile).toBeDefined()
    expect(profile!.name).toBe('José')
    expect(profile!.onboarding_completed).toBeFalsy()
    expect(profile!.wiped_at).toBeTruthy()
    // …and the same reset reached the server profile
    expect(calls.updates[0]).toMatchObject({
      table: 'user_profiles', onboarding_completed: false,
    })
  })

  it('aborts without touching local data when the cloud delete fails', async () => {
    failOnTable = 'transactions'
    await expect(resetAllData(USER)).rejects.toThrow(/transactions/)
    // Local store is intact: retrying is safe, and the user was told nothing
    // was deleted on this device.
    expect(await db.transactions.count()).toBe(2)
    expect(await db.sync_queue.count()).toBe(1)
    const profile = await db.user_profiles.get(USER)
    expect(profile!.onboarding_completed).toBe(true)
  })

  it('refuses to run while offline', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(resetAllData(USER)).rejects.toBeInstanceOf(OfflineError)
    expect(calls.deletes).toHaveLength(0)
    spy.mockRestore()
  })
})

// ─── deleteAccount ───────────────────────────────────────────────────────────

describe('deleteAccount', () => {
  it('calls the RPC, clears everything local including the profile, and signs out', async () => {
    await deleteAccount(USER)
    expect(calls.rpc).toEqual(['delete_my_account'])
    expect(await db.transactions.count()).toBe(0)
    expect(await db.user_profiles.get(USER)).toBeUndefined()
    expect(await db.sync_queue.count()).toBe(0)
    expect(signOut).toHaveBeenCalled()
  })

  it('leaves local data untouched when the RPC fails', async () => {
    rpcError = 'permission denied'
    await expect(deleteAccount(USER)).rejects.toThrow(/permission denied/)
    expect(await db.transactions.count()).toBe(2)
    expect(await db.user_profiles.get(USER)).toBeDefined()
    expect(signOut).not.toHaveBeenCalled()
  })
})

// ─── checkRemoteWipe ─────────────────────────────────────────────────────────

describe('checkRemoteWipe', () => {
  it('wipes this device when the server was reset more recently', async () => {
    remoteWipedAt = '2026-08-21T10:00:00.000Z'
    const wiped = await checkRemoteWipe(USER)
    expect(wiped).toBe(true)
    expect(await db.transactions.count()).toBe(0)
    expect(await db.sync_queue.count()).toBe(0)
    // The mark is adopted so the next launch is a no-op.
    expect((await db.user_profiles.get(USER))!.wiped_at).toBe(remoteWipedAt)
  })

  it('does nothing when this device already carries the same mark', async () => {
    remoteWipedAt = '2026-08-21T10:00:00.000Z'
    await db.user_profiles.update(USER, { wiped_at: remoteWipedAt })
    expect(await checkRemoteWipe(USER)).toBe(false)
    expect(await db.transactions.count()).toBe(2)
  })

  it('does nothing when the account was never reset', async () => {
    remoteWipedAt = null
    expect(await checkRemoteWipe(USER)).toBe(false)
    expect(await db.transactions.count()).toBe(2)
  })
})
