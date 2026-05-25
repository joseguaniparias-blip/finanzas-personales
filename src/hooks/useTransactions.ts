import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import type { Transaction } from '@/types'

interface TransactionsHook {
  transactions: Transaction[]
  loading: boolean
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
  getByPocket: (pocketId: string, limit?: number) => Promise<Transaction[]>
  getByPlatform: (platformId: string, from: string, to: string) => Promise<Transaction[]>
}

export function useTransactions(userId: string): TransactionsHook {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    // Load 35 days so "this week" always has data even if Mon is in the prev month
    const d = new Date(); d.setDate(d.getDate() - 35)
    const windowStart = d.toISOString().slice(0, 10)
    const data = await db.transactions
      .where('user_id').equals(userId)
      .and(t => t.date >= windowStart)
      .sortBy('date')
    if (!mountedRef.current) return
    setTransactions(data.reverse())
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addTransaction = async (t: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> => {
    const tx: Transaction = { ...t, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    // Atomic: tx insert + pocket balance update in one Dexie transaction so
    // parallel calls cannot lose updates against the same pocket balance.
    await db.transaction('rw', db.transactions, db.pockets, async () => {
      await db.transactions.add(tx)
      const pocket = await db.pockets.get(t.pocket_id)
      if (pocket) {
        const delta = t.type === 'expense' ? -t.amount : t.amount
        await db.pockets.update(t.pocket_id, { balance: pocket.balance + delta })
      }
    })
    await load()
    return tx
  }

  const getByPocket = async (pocketId: string, limit = 50): Promise<Transaction[]> => {
    const data = await db.transactions
      .where('pocket_id').equals(pocketId)
      .and(t => t.user_id === userId)
      .sortBy('date')
    return data.reverse().slice(0, limit)
  }

  const getByPlatform = async (platformId: string, from: string, to: string): Promise<Transaction[]> => {
    const data = await db.transactions
      .where('user_id').equals(userId)
      .and(t => t.platform_id === platformId && t.date >= from && t.date <= to)
      .sortBy('date')
    return data
  }

  return { transactions, loading, addTransaction, getByPocket, getByPlatform }
}
