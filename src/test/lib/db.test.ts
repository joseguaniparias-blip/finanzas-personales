import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'

describe('db', () => {
  beforeEach(async () => {
    await db.pockets.clear()
    await db.platforms.clear()
  })

  it('stores and retrieves a pocket', async () => {
    const id = crypto.randomUUID()
    await db.pockets.add({
      id,
      user_id: 'user-1',
      name: 'Nequi',
      type: 'bank',
      platform_id: null,
      balance: 150000,
      color: '#34d399',
      icon: '🟢',
      is_active: true,
      created_at: new Date().toISOString()
    })
    const found = await db.pockets.get(id)
    expect(found?.name).toBe('Nequi')
    expect(found?.balance).toBe(150000)
  })

  it('filters active pockets', async () => {
    await db.pockets.bulkAdd([
      { id: crypto.randomUUID(), user_id: 'u', name: 'A', type: 'cash', platform_id: null,
        balance: 0, color: '#000', icon: '💵', is_active: true, created_at: '' },
      { id: crypto.randomUUID(), user_id: 'u', name: 'B', type: 'bank', platform_id: null,
        balance: 0, color: '#000', icon: '💳', is_active: false, created_at: '' }
    ])
    const active = await db.pockets.where('is_active').equals(1).toArray()
    expect(active).toHaveLength(1)
    expect(active[0].name).toBe('A')
  })
})
