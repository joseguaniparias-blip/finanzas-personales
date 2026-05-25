import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import type { Pocket } from '@/types'

type NewPocket = Omit<Pocket, 'id' | 'created_at'>

interface PocketsHook {
  pockets: Pocket[]
  totalBalance: number
  loading: boolean
  load: () => Promise<void>
  addPocket: (pocket: NewPocket) => Promise<void>
  updatePocket: (id: string, updates: Partial<Pocket>) => Promise<void>
  updateBalance: (id: string, newBalance: number) => Promise<void>
  deletePocket: (id: string) => Promise<void>
}

export function usePockets(userId: string): PocketsHook {
  const [pockets, setPockets] = useState<Pocket[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    const data = await db.pockets
      .where('user_id').equals(userId)
      .and(p => Boolean(p.is_active))
      .sortBy('created_at')
    if (!mountedRef.current) return
    setPockets(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const totalBalance = pockets.reduce((sum, p) => sum + p.balance, 0)

  const addPocket = async (pocket: NewPocket) => {
    const newPocket: Pocket = {
      ...pocket,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    }
    await db.pockets.add(newPocket)
    await load()
  }

  const updatePocket = async (id: string, updates: Partial<Pocket>) => {
    await db.pockets.update(id, updates)
    await load()
  }

  const updateBalance = async (id: string, newBalance: number) => {
    await db.pockets.update(id, { balance: newBalance })
    await load()
  }

  const deletePocket = async (id: string) => {
    await db.pockets.update(id, { is_active: false })
    await load()
  }

  return { pockets, totalBalance, loading, load, addPocket, updatePocket, updateBalance, deletePocket }
}
