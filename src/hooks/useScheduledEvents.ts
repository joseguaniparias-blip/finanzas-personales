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
  getPendingByType: (type: EventType) => ScheduledEvent[]
  getPendingByRef: (referenceId: string) => ScheduledEvent | undefined
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

    await db.scheduled_events.update(id, { status: 'confirmed', actual_pocket_id: pocketId })

    if (event.type === 'debt') {
      // Expense: deduct from pocket
      await adjustPocket(pocketId, -event.amount)
      await addTx(userId, 'expense', event.amount, pocketId, event, today)
      await handleDebtConfirm(event)

    } else if (event.type === 'collection') {
      // Income: add to pocket
      await adjustPocket(pocketId, +event.amount)
      await addTx(userId, 'income', event.amount, pocketId, event, today)
      await handleCollectionConfirm(event)

    } else if (event.type === 'saving') {
      // Expense from source: deduct from pocket, update goal saved_amount
      await adjustPocket(pocketId, -event.amount)
      await addTx(userId, 'expense', event.amount, pocketId, event, today)
      await handleSavingConfirm(event)

    } else if (event.type === 'cadena') {
      // Expense: deduct from pocket, advance cadena round
      await adjustPocket(pocketId, -event.amount)
      await addTx(userId, 'expense', event.amount, pocketId, event, today)
      await handleCadenaConfirm(event)
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

    const isIncome = event.type === 'collection'
    await adjustPocket(pocketId, isIncome ? +paidAmount : -paidAmount)
    await addTx(userId, isIncome ? 'income' : 'expense', paidAmount, pocketId, event, today,
      `Abono parcial — quedan $${remaining.toLocaleString('es-CO')}`)

    if (event.type === 'debt') {
      const debt = await db.debts.get(event.reference_id)
      if (debt) await db.debts.update(debt.id, { paid_amount: debt.paid_amount + paidAmount })
    } else if (event.type === 'collection') {
      const col = await db.collections.get(event.reference_id)
      if (col) await db.collections.update(col.id, { collected_amount: col.collected_amount + paidAmount })
    } else if (event.type === 'saving') {
      const goal = await db.saving_goals.get(event.reference_id)
      if (goal) await db.saving_goals.update(goal.id, { saved_amount: goal.saved_amount + paidAmount })
    }

    await load()
  }

  const postponeEvent = async (id: string) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await db.scheduled_events.update(id, { due_date: tomorrow.toISOString().slice(0, 10) })
    await load()
  }

  const getPendingByType = (type: EventType) => events.filter(e => e.type === type)
  const getPendingByRef = (referenceId: string) => events.find(e => e.reference_id === referenceId)

  return { events, todayEvents, loading, confirmEvent, partialEvent, postponeEvent, getPendingByType, getPendingByRef }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function adjustPocket(pocketId: string, delta: number) {
  const pocket = await db.pockets.get(pocketId)
  if (pocket) await db.pockets.update(pocketId, { balance: pocket.balance + delta })
}

async function addTx(
  userId: string, type: 'income' | 'expense', amount: number,
  pocketId: string, event: ScheduledEvent, date: string, note?: string
) {
  await db.transactions.add({
    id: crypto.randomUUID(), user_id: userId, type, amount,
    pocket_id: pocketId, category_id: null, platform_id: null,
    reference_id: event.reference_id, reference_type: event.reference_type,
    note: note ?? null, receipt_url: null, date,
    created_at: new Date().toISOString()
  })
}

async function handleDebtConfirm(event: ScheduledEvent) {
  const debt = await db.debts.get(event.reference_id)
  if (!debt) return
  const newPaid = debt.paid_amount + event.amount
  const updates: Record<string, unknown> = { paid_amount: newPaid }
  if (debt.has_total && debt.total_amount && newPaid >= debt.total_amount) {
    updates.status = 'paid_off'
  } else {
    await scheduleNext(event, debt.frequency, debt.installment_amount)
  }
  await db.debts.update(debt.id, updates)
}

async function handleCollectionConfirm(event: ScheduledEvent) {
  const col = await db.collections.get(event.reference_id)
  if (!col) return
  const newCollected = col.collected_amount + event.amount
  const updates: Record<string, unknown> = { collected_amount: newCollected }
  if (col.has_total && col.total_amount && newCollected >= col.total_amount) {
    updates.status = 'fully_collected'
  } else if (col.frequency !== 'once') {
    await scheduleNext(event, col.frequency, col.installment_amount)
  }
  await db.collections.update(col.id, updates)
}

async function handleSavingConfirm(event: ScheduledEvent) {
  const goal = await db.saving_goals.get(event.reference_id)
  if (!goal) return
  const newSaved = goal.saved_amount + event.amount
  await db.saving_goals.update(goal.id, { saved_amount: newSaved })
  if (!goal.target_amount || newSaved < goal.target_amount) {
    await scheduleNext(event, goal.frequency === 'on_payout' ? 'weekly' : goal.frequency, event.amount)
  }
}

async function handleCadenaConfirm(event: ScheduledEvent) {
  const cadena = await db.cadenas.get(event.reference_id)
  if (!cadena) return
  const newPaid = cadena.paid_rounds + 1
  const newCurrent = cadena.current_round + 1
  const updates: Record<string, unknown> = { paid_rounds: newPaid, current_round: newCurrent }
  if (newCurrent > cadena.participants) {
    updates.status = 'completed'
  } else {
    await scheduleNext(event, cadena.frequency, cadena.contribution_amount)
  }
  await db.cadenas.update(cadena.id, updates)
}

async function scheduleNext(prev: ScheduledEvent, frequency: string, amount: number) {
  const d = new Date(prev.due_date)
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else d.setDate(d.getDate() + 1)

  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: prev.user_id,
    type: prev.type,
    reference_id: prev.reference_id,
    reference_type: prev.reference_type,
    amount,
    due_date: d.toISOString().slice(0, 10),
    status: 'pending',
    actual_pocket_id: null,
    partial_amount: null,
    remaining_after_partial: null,
    created_at: new Date().toISOString()
  })
}
