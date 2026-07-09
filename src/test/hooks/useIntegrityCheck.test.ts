import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIntegrityCheck } from '@/hooks/useIntegrityCheck'
import { db } from '@/lib/db'

const USER = 'user-integrity-hook'

beforeEach(async () => {
  await Promise.all([db.pockets.clear(), db.transactions.clear()])
})

describe('useIntegrityCheck', () => {
  it('surfaces drift when a stored balance disagrees with the ledger', async () => {
    await db.pockets.add({
      id: 'p1', user_id: USER, name: 'Nequi', type: 'bank', platform_id: null,
      balance: 500000, color: '#000', icon: '💳', is_active: true, created_at: '',
    })
    await db.transactions.add({
      id: 't1', user_id: USER, type: 'income', amount: 120000, pocket_id: 'p1',
      category_id: null, platform_id: null, reference_id: null, reference_type: null,
      note: null, receipt_url: null, date: '2026-07-01', created_at: '',
    })

    const { result } = renderHook(() => useIntegrityCheck(USER))
    await waitFor(() => expect(result.current.drift).toHaveLength(1))
    expect(result.current.drift[0].pocketId).toBe('p1')
  })

  it('reports no drift when balances match', async () => {
    await db.pockets.add({
      id: 'p1', user_id: USER, name: 'OK', type: 'cash', platform_id: null,
      balance: 120000, color: '#000', icon: '💵', is_active: true, created_at: '',
    })
    await db.transactions.add({
      id: 't1', user_id: USER, type: 'income', amount: 120000, pocket_id: 'p1',
      category_id: null, platform_id: null, reference_id: null, reference_type: null,
      note: null, receipt_url: null, date: '2026-07-01', created_at: '',
    })

    const { result } = renderHook(() => useIntegrityCheck(USER))
    await waitFor(() => expect(result.current.checked).toBe(true))
    expect(result.current.drift).toHaveLength(0)
  })

  it('can be dismissed', async () => {
    await db.pockets.add({
      id: 'p1', user_id: USER, name: 'Nequi', type: 'bank', platform_id: null,
      balance: 500000, color: '#000', icon: '💳', is_active: true, created_at: '',
    })
    await db.transactions.add({
      id: 't1', user_id: USER, type: 'income', amount: 120000, pocket_id: 'p1',
      category_id: null, platform_id: null, reference_id: null, reference_type: null,
      note: null, receipt_url: null, date: '2026-07-01', created_at: '',
    })

    const { result } = renderHook(() => useIntegrityCheck(USER))
    await waitFor(() => expect(result.current.drift).toHaveLength(1))
    expect(result.current.dismissed).toBe(false)
    act(() => result.current.dismiss())
    expect(result.current.dismissed).toBe(true)
  })
})
