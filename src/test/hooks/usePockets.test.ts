import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePockets } from '@/hooks/usePockets'
import { db } from '@/lib/db'

const TEST_USER = 'user-test-1'

beforeEach(async () => {
  await db.pockets.clear()
})

describe('usePockets', () => {
  it('loads pockets for a user', async () => {
    await db.pockets.add({
      id: '1', user_id: TEST_USER, name: 'Efectivo', type: 'cash',
      platform_id: null, balance: 50000, color: '#34d399', icon: '💵',
      is_active: true, created_at: new Date().toISOString()
    })

    const { result } = renderHook(() => usePockets(TEST_USER))

    await waitFor(() => expect(result.current.pockets).toHaveLength(1))
    expect(result.current.pockets[0].name).toBe('Efectivo')
  })

  it('calculates total balance', async () => {
    await db.pockets.bulkAdd([
      { id: '1', user_id: TEST_USER, name: 'A', type: 'cash', platform_id: null,
        balance: 100000, color: '#000', icon: '💵', is_active: true, created_at: '' },
      { id: '2', user_id: TEST_USER, name: 'B', type: 'bank', platform_id: null,
        balance: 250000, color: '#000', icon: '💳', is_active: true, created_at: '' }
    ])

    const { result } = renderHook(() => usePockets(TEST_USER))

    await waitFor(() => expect(result.current.totalBalance).toBe(350000))
  })

  it('adds a new pocket', async () => {
    const { result } = renderHook(() => usePockets(TEST_USER))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addPocket({
        user_id: TEST_USER, name: 'Nequi', type: 'bank',
        platform_id: null, balance: 80000, color: '#34d399',
        icon: '🟢', is_active: true
      })
    })

    expect(result.current.pockets).toHaveLength(1)
    expect(result.current.pockets[0].name).toBe('Nequi')
  })

  it('updates pocket balance', async () => {
    const id = 'pocket-1'
    await db.pockets.add({
      id, user_id: TEST_USER, name: 'Nequi', type: 'bank',
      platform_id: null, balance: 100000, color: '#34d399',
      icon: '🟢', is_active: true, created_at: ''
    })

    const { result } = renderHook(() => usePockets(TEST_USER))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.updateBalance(id, 150000) })

    expect(result.current.pockets[0].balance).toBe(150000)
  })
})
