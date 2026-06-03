import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import type { RecurringPayment, RecurringFrequency } from '@/types'
import { toISODate } from '@/lib/date'

type NewRecurring = Omit<RecurringPayment, 'id' | 'created_at' | 'is_active'>

interface RecurringHook {
  payments: RecurringPayment[]
  loading: boolean
  addPayment: (p: NewRecurring, firstDueDate?: string) => Promise<RecurringPayment>
  updatePayment: (id: string, updates: Partial<RecurringPayment>) => Promise<void>
  closePayment: (id: string) => Promise<void>
}

export function useRecurringPayments(userId: string): RecurringHook {
  const [payments, setPayments] = useState<RecurringPayment[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    const data = await db.recurring_payments
      .where('user_id').equals(userId)
      .and(p => Boolean(p.is_active))
      .sortBy('created_at')
    if (!mountedRef.current) return
    setPayments(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addPayment = async (p: NewRecurring, firstDueDate?: string) => {
    const payment: RecurringPayment = {
      ...p,
      id: crypto.randomUUID(),
      is_active: true,
      created_at: new Date().toISOString()
    }
    await db.recurring_payments.add(payment)
    await scheduleNextRecurring(payment, firstDueDate)
    await load()
    return payment
  }

  const updatePayment = async (id: string, updates: Partial<RecurringPayment>) => {
    await db.recurring_payments.update(id, updates)
    await load()
  }

  const closePayment = async (id: string) => {
    // Soft-delete: mark inactive AND remove any pending events.
    const linked = await db.scheduled_events
      .where('user_id').equals(userId)
      .filter(e => e.reference_id === id && e.status === 'pending')
      .toArray()
    await db.transaction('rw', db.recurring_payments, db.scheduled_events, async () => {
      for (const e of linked) await db.scheduled_events.delete(e.id)
      await db.recurring_payments.update(id, { is_active: false })
    })
    await load()
  }

  return { payments, loading, addPayment, updatePayment, closePayment }
}

export async function scheduleNextRecurring(p: RecurringPayment, overrideDate?: string) {
  const dueDate = overrideDate ?? nextDueDate(p.frequency, p.trigger_day)
  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: p.user_id,
    type: 'recurring',
    reference_id: p.id,
    reference_type: 'recurring',
    amount: p.amount,
    due_date: dueDate,
    status: 'pending',
    actual_pocket_id: null,
    partial_amount: null,
    remaining_after_partial: null,
    created_at: new Date().toISOString()
  })
}

function nextDueDate(frequency: RecurringFrequency, triggerDay: number): string {
  const now = new Date()
  if (frequency === 'weekly') {
    // triggerDay 0–6 (Sun–Sat). If today matches and time has passed, jump to next week.
    const diff = (triggerDay - now.getDay() + 7) % 7 || 7
    const d = new Date(now); d.setDate(d.getDate() + diff)
    return toISODate(d)
  }
  if (frequency === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth(), Math.min(28, Math.max(1, triggerDay)))
    if (d <= now) d.setMonth(d.getMonth() + 1)
    return toISODate(d)
  }
  // yearly: triggerDay = month * 100 + day, e.g. 304 = Mar 4
  const month = Math.floor(triggerDay / 100) - 1
  const day = triggerDay % 100
  const d = new Date(now.getFullYear(), month, day)
  if (d <= now) d.setFullYear(d.getFullYear() + 1)
  return toISODate(d)
}
