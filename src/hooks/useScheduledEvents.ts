import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { ScheduledEvent, EventType } from '@/types'

interface ScheduledEventsHook {
  events: ScheduledEvent[]
  todayEvents: ScheduledEvent[]
  loading: boolean
  confirmEvent: (id: string, pocketId: string) => Promise<void>
  partialEvent: (id: string, pocketId: string, paidAmount: number) => Promise<void>
  postponeEvent: (id: string) => Promise<void>
  changeEventPocket: (id: string, newPocketId: string) => Promise<void>
  getPendingByType: (type: EventType) => ScheduledEvent[]
}

export function useScheduledEvents(userId: string): ScheduledEventsHook {
  const [events, setEvents] = useState<ScheduledEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.scheduled_events
      .where('user_id').equals(userId)
      .and(e => e.status === 'pending')
      .sortBy('due_date')
    setEvents(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().slice(0, 10)
  const todayEvents = events.filter(e => e.due_date <= today)

  const confirmEvent = async (id: string, pocketId: string) => {
    const event = await db.scheduled_events.get(id)
    if (!event) return

    await db.scheduled_events.update(id, {
      status: 'confirmed',
      actual_pocket_id: pocketId
    })

    // Deduct from pocket
    const pocket = await db.pockets.get(pocketId)
    if (pocket) {
      await db.pockets.update(pocketId, { balance: pocket.balance - event.amount })
    }

    // Record transaction
    await db.transactions.add({
      id: crypto.randomUUID(),
      user_id: userId,
      type: 'expense',
      amount: event.amount,
      pocket_id: pocketId,
      category_id: null,
      platform_id: null,
      reference_id: event.reference_id,
      reference_type: event.reference_type,
      note: null,
      receipt_url: null,
      date: today,
      created_at: new Date().toISOString()
    })

    // Update debt paid_amount
    if (event.type === 'debt') {
      const debt = await db.debts.get(event.reference_id)
      if (debt) {
        const newPaid = debt.paid_amount + event.amount
        const updates: Record<string, unknown> = { paid_amount: newPaid }
        if (debt.has_total && debt.total_amount && newPaid >= debt.total_amount) {
          updates.status = 'paid_off'
        } else {
          await scheduleNextDebtEvent(debt, event)
        }
        await db.debts.update(debt.id, updates)
      }
    }

    await load()
  }

  const partialEvent = async (id: string, pocketId: string, paidAmount: number) => {
    const event = await db.scheduled_events.get(id)
    if (!event) return
    const remaining = event.amount - paidAmount

    await db.scheduled_events.update(id, {
      status: 'partial',
      actual_pocket_id: pocketId,
      partial_amount: paidAmount,
      remaining_after_partial: remaining
    })

    const pocket = await db.pockets.get(pocketId)
    if (pocket) {
      await db.pockets.update(pocketId, { balance: pocket.balance - paidAmount })
    }

    await db.transactions.add({
      id: crypto.randomUUID(),
      user_id: userId,
      type: 'expense',
      amount: paidAmount,
      pocket_id: pocketId,
      category_id: null,
      platform_id: null,
      reference_id: event.reference_id,
      reference_type: event.reference_type,
      note: `Abono parcial — quedan $${remaining.toLocaleString()}`,
      receipt_url: null,
      date: today,
      created_at: new Date().toISOString()
    })

    if (event.type === 'debt') {
      const debt = await db.debts.get(event.reference_id)
      if (debt) {
        await db.debts.update(debt.id, { paid_amount: debt.paid_amount + paidAmount })
      }
    }

    await load()
  }

  const postponeEvent = async (id: string) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await db.scheduled_events.update(id, {
      due_date: tomorrow.toISOString().slice(0, 10)
    })
    await load()
  }

  const changeEventPocket = async (id: string, newPocketId: string) => {
    await confirmEvent(id, newPocketId)
  }

  const getPendingByType = (type: EventType) => events.filter(e => e.type === type)

  return { events, todayEvents, loading, confirmEvent, partialEvent, postponeEvent, changeEventPocket, getPendingByType }
}

async function scheduleNextDebtEvent(debt: import('@/types').Debt, prevEvent: ScheduledEvent) {
  const nextDate = addPeriod(prevEvent.due_date, debt.frequency)
  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: debt.user_id,
    type: 'debt',
    reference_id: debt.id,
    reference_type: 'debt',
    amount: debt.installment_amount,
    due_date: nextDate,
    status: 'pending',
    actual_pocket_id: null,
    partial_amount: null,
    remaining_after_partial: null,
    created_at: new Date().toISOString()
  })
}

function addPeriod(dateStr: string, frequency: string): string {
  const d = new Date(dateStr)
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
