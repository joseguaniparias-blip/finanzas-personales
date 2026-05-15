import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { Debt } from '@/types'

type NewDebt = Omit<Debt, 'id' | 'created_at' | 'paid_amount' | 'status'>

interface DebtsHook {
  debts: Debt[]
  loading: boolean
  addDebt: (d: NewDebt, firstDueDate?: string) => Promise<Debt>
  updateDebt: (id: string, updates: Partial<Debt>) => Promise<void>
  recordPayment: (id: string, amount: number) => Promise<void>
  closeDebt: (id: string) => Promise<void>
}

export function useDebts(userId: string): DebtsHook {
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.debts
      .where('user_id').equals(userId)
      .and(d => d.status === 'active')
      .sortBy('created_at')
    setDebts(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addDebt = async (d: NewDebt, firstDueDate?: string): Promise<Debt> => {
    const debt: Debt = {
      ...d,
      id: crypto.randomUUID(),
      paid_amount: 0,
      status: 'active',
      created_at: new Date().toISOString()
    }
    await db.debts.add(debt)

    // Generate first scheduled event (use custom date if provided)
    await scheduleNextEvent(debt, firstDueDate)

    await load()
    return debt
  }

  const updateDebt = async (id: string, updates: Partial<Debt>) => {
    await db.debts.update(id, updates)
    await load()
  }

  const recordPayment = async (id: string, amount: number) => {
    const debt = await db.debts.get(id)
    if (!debt) return
    const newPaid = debt.paid_amount + amount
    const updates: Partial<Debt> = { paid_amount: newPaid }
    if (debt.has_total && debt.total_amount && newPaid >= debt.total_amount) {
      updates.status = 'paid_off'
    }
    await db.debts.update(id, updates)
    await load()
  }

  const closeDebt = async (id: string) => {
    await db.debts.update(id, { status: 'cancelled' })
    await load()
  }

  return { debts, loading, addDebt, updateDebt, recordPayment, closeDebt }
}

async function scheduleNextEvent(debt: Debt, overrideDueDate?: string) {
  const dueDate = overrideDueDate ?? nextDueDate(debt.frequency, debt.payment_day)
  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: debt.user_id,
    type: 'debt',
    reference_id: debt.id,
    reference_type: 'debt',
    amount: debt.installment_amount,
    due_date: dueDate,
    status: 'pending',
    actual_pocket_id: null,
    partial_amount: null,
    remaining_after_partial: null,
    created_at: new Date().toISOString()
  })
}

function nextDueDate(frequency: string, paymentDay: number): string {
  const now = new Date()
  if (frequency === 'once') {
    // Due today — single payment
    return now.toISOString().slice(0, 10)
  }
  if (frequency === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth(), paymentDay)
    if (d <= now) d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  }
  if (frequency === 'weekly') {
    const diff = (paymentDay - now.getDay() + 7) % 7 || 7
    const d = new Date(now)
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
  }
  // daily
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
