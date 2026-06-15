import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import type { Transaction } from '@/types'
import { toISODate, addDaysISO } from '@/lib/date'

interface TransactionsHook {
  transactions: Transaction[]
  loading: boolean
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
  transferBetweenPockets: (params: TransferParams) => Promise<void>
  getByPocket: (pocketId: string, limit?: number) => Promise<Transaction[]>
  getByPlatform: (platformId: string, from: string, to: string) => Promise<Transaction[]>
}

export interface TransferParams {
  userId: string
  fromPocketId: string
  toPocketId: string
  amount: number
  date: string
  note?: string | null
}

export function useTransactions(userId: string): TransactionsHook {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    // Load 35 days so "this week" always has data even if Mon is in the prev month
    const d = new Date(); d.setDate(d.getDate() - 35)
    const windowStart = toISODate(d)
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
    // Atomic: tx insert + pocket update + retroactive payout reconciliation
    // in one Dexie transaction so parallel calls don't race on balances.
    await db.transaction('rw',
      [db.transactions, db.pockets, db.platforms, db.scheduled_events],
      async () => {
        await db.transactions.add(tx)
        const pocket = await db.pockets.get(t.pocket_id)
        if (!pocket) return

        const delta = t.type === 'expense' ? -t.amount : t.amount
        await db.pockets.update(t.pocket_id, { balance: pocket.balance + delta })

        // ── Retroactive reconciliation for late Sunday entries ──────────────
        // If this is a platform-wallet income dated INSIDE the most recently
        // closed week AND a pending payout event still exists for that
        // platform, push the amount into the event and reverse the pocket
        // bump. Without this, late-Sunday earnings get stranded in the new
        // week's bucket and the user has to chase them manually.
        if (pocket.type === 'platform' && t.type === 'income' && pocket.platform_id) {
          const platform = await db.platforms.get(pocket.platform_id)
          if (platform?.last_closed_sunday) {
            const weekStart = addDaysISO(platform.last_closed_sunday, -6) // Monday
            const inClosedWeek = t.date >= weekStart && t.date <= platform.last_closed_sunday
            if (inClosedWeek) {
              const pendingEvent = await db.scheduled_events
                .where('user_id').equals(t.user_id)
                .filter(e => e.type === 'platform_payout'
                          && e.reference_id === platform.id
                          && e.status === 'pending')
                .first()
              if (pendingEvent) {
                await db.scheduled_events.update(pendingEvent.id, {
                  amount: pendingEvent.amount + t.amount
                })
                const pocketAfter = await db.pockets.get(t.pocket_id)
                if (pocketAfter) {
                  await db.pockets.update(t.pocket_id, {
                    balance: pocketAfter.balance - t.amount
                  })
                }
              }
            }
          }
        }
      }
    )
    await load()
    return tx
  }

  const transferBetweenPockets = async (params: TransferParams) => {
    const { userId: uid, fromPocketId, toPocketId, amount, date, note } = params
    if (fromPocketId === toPocketId) throw new Error('Origen y destino deben ser distintos')
    if (amount <= 0) throw new Error('El monto debe ser mayor a 0')

    const groupId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.transaction('rw', db.transactions, db.pockets, async () => {
      const fromPocket = await db.pockets.get(fromPocketId)
      const toPocket   = await db.pockets.get(toPocketId)
      if (!fromPocket || !toPocket) throw new Error('Bolsillo no encontrado')
      if (fromPocket.type === 'platform' || toPocket.type === 'platform') {
        throw new Error('Las billeteras de plataforma no participan en transferencias')
      }

      // Outflow leg
      await db.transactions.add({
        id: crypto.randomUUID(), user_id: uid, type: 'transfer', amount,
        pocket_id: fromPocketId, category_id: null, platform_id: null,
        reference_id: null, reference_type: 'transfer_out',
        note: note ?? null, receipt_url: null, date,
        transfer_group_id: groupId, transfer_other_pocket_id: toPocketId,
        created_at: now,
      })
      // Inflow leg
      await db.transactions.add({
        id: crypto.randomUUID(), user_id: uid, type: 'transfer', amount,
        pocket_id: toPocketId, category_id: null, platform_id: null,
        reference_id: null, reference_type: 'transfer_in',
        note: note ?? null, receipt_url: null, date,
        transfer_group_id: groupId, transfer_other_pocket_id: fromPocketId,
        created_at: now,
      })
      // Pocket balance updates
      await db.pockets.update(fromPocketId, { balance: fromPocket.balance - amount })
      await db.pockets.update(toPocketId,   { balance: toPocket.balance + amount })
    })
    await load()
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

  return { transactions, loading, addTransaction, transferBetweenPockets, getByPocket, getByPlatform }
}
