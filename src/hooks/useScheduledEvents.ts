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
  rescheduleEvent: (id: string, newDate: string) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
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

    const toDelete: string[] = []

    // ── Step 1: Orphan cleanup ──
    // Delete events whose referenced entity no longer exists or is inactive.
    // This handles records the user deleted (cancelled/paid_off/etc.) whose
    // future events lingered in the agenda.
    for (const ev of data) {
      let orphan = false
      if (ev.type === 'debt') {
        const r = await db.debts.get(ev.reference_id)
        orphan = !r || r.status !== 'active'
      } else if (ev.type === 'collection') {
        const r = await db.collections.get(ev.reference_id)
        orphan = !r || r.status !== 'active'
      } else if (ev.type === 'saving') {
        const r = await db.saving_goals.get(ev.reference_id)
        // is_active is coerced to 0/1 by the Dexie hook
        orphan = !r || !r.is_active
      } else if (ev.type === 'cadena') {
        const r = await db.cadenas.get(ev.reference_id)
        orphan = !r || r.status !== 'active'
      } else if (ev.type === 'platform_payout') {
        const r = await db.platforms.get(ev.reference_id)
        orphan = !r || !r.is_active
      }
      if (orphan) toDelete.push(ev.id)
    }

    // Filter out orphans before dedup
    const orphanSet = new Set(toDelete)
    const alive = data.filter(e => !orphanSet.has(e.id))

    // ── Step 2: Deduplicate ──
    // If multiple pending events exist for the same (reference_id + type),
    // keep the earliest due_date and delete the rest. Excludes platform_payout
    // which has its own merge logic in usePlatformPayouts.
    const seen = new Map<string, ScheduledEvent>()
    for (const ev of alive) {
      if (ev.type === 'platform_payout') continue
      const key = `${ev.type}::${ev.reference_id}`
      const existing = seen.get(key)
      if (!existing) {
        seen.set(key, ev)
      } else if (ev.due_date < existing.due_date) {
        toDelete.push(existing.id)
        seen.set(key, ev)
      } else {
        toDelete.push(ev.id)
      }
    }

    if (toDelete.length > 0) {
      await db.scheduled_events.bulkDelete(toDelete)
      const deletedSet = new Set(toDelete)
      setEvents(data.filter(e => !deletedSet.has(e.id)))
    } else {
      setEvents(data)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().slice(0, 10)
  const todayEvents = events.filter(e => e.due_date <= today)

  const confirmEvent = async (id: string, pocketId: string) => {
    // Wrap everything in a single Dexie transaction so the status check + side
    // effects are truly atomic. Without this, two parallel taps both see status
    // === 'pending', both pass the guard, and both run side-effects → doubled
    // balance, doubled transactions, doubled scheduleNext.
    await db.transaction('rw', [
      db.scheduled_events, db.pockets, db.transactions,
      db.debts, db.collections, db.saving_goals, db.cadenas, db.platforms,
    ], async () => {
        const event = await db.scheduled_events.get(id)
        if (!event || event.status !== 'pending') return

        await db.scheduled_events.update(id, { status: 'confirmed', actual_pocket_id: pocketId })

        if (event.type === 'debt') {
          await adjustPocket(pocketId, -event.amount)
          await addTx(userId, 'expense', event.amount, pocketId, event, today)
          await handleDebtConfirm(event)

        } else if (event.type === 'collection') {
          await adjustPocket(pocketId, +event.amount)
          await addTx(userId, 'income', event.amount, pocketId, event, today)
          await handleCollectionConfirm(event)

        } else if (event.type === 'saving') {
          await adjustPocket(pocketId, -event.amount)
          await addTx(userId, 'expense', event.amount, pocketId, event, today)
          await handleSavingConfirm(event)

        } else if (event.type === 'cadena') {
          await adjustPocket(pocketId, -event.amount)
          await addTx(userId, 'expense', event.amount, pocketId, event, today)
          await handleCadenaConfirm(event)

        } else if (event.type === 'platform_payout') {
          await handlePlatformPayoutConfirm(event, pocketId, userId, today)
        }
      }
    )

    await load()
  }

  const partialEvent = async (id: string, pocketId: string, paidAmount: number) => {
    // Same atomicity strategy as confirmEvent.
    await db.transaction('rw', [
      db.scheduled_events, db.pockets, db.transactions,
      db.debts, db.collections, db.saving_goals, db.cadenas, db.platforms,
    ], async () => {
        const event = await db.scheduled_events.get(id)
        if (!event || event.status !== 'pending') return

        // If user paid >= cuota, treat as full confirm with the larger amount.
        if (paidAmount >= event.amount) {
          const overrideEvent: ScheduledEvent = { ...event, amount: paidAmount }
          await db.scheduled_events.update(id, { status: 'confirmed', actual_pocket_id: pocketId })
          const isIncome = event.type === 'collection'
          if (event.type !== 'platform_payout') {
            await adjustPocket(pocketId, isIncome ? +paidAmount : -paidAmount)
            await addTx(userId, isIncome ? 'income' : 'expense', paidAmount, pocketId, overrideEvent, today)
          }
          if (event.type === 'debt')       await handleDebtConfirm(overrideEvent)
          else if (event.type === 'collection') await handleCollectionConfirm(overrideEvent)
          else if (event.type === 'saving')     await handleSavingConfirm(overrideEvent)
          else if (event.type === 'cadena')     await handleCadenaConfirm(overrideEvent)
          return
        }

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
      }
    )

    await load()
  }

  const postponeEvent = async (id: string) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await db.scheduled_events.update(id, { due_date: tomorrow.toISOString().slice(0, 10) })
    await load()
  }

  const rescheduleEvent = async (id: string, newDate: string) => {
    await db.scheduled_events.update(id, { due_date: newDate })
    await load()
  }

  const deleteEvent = async (id: string) => {
    await db.scheduled_events.delete(id)
    await load()
  }

  const getPendingByType = (type: EventType) => events.filter(e => e.type === type)
  const getPendingByRef = (referenceId: string) => events.find(e => e.reference_id === referenceId)

  return { events, todayEvents, loading, confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent, getPendingByType, getPendingByRef }
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
  if (debt.frequency === 'once') {
    // Single payment — always mark as paid_off after confirming
    updates.status = 'paid_off'
  } else if (debt.has_total && debt.total_amount && newPaid >= debt.total_amount) {
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

async function handlePlatformPayoutConfirm(event: ScheduledEvent, destPocketId: string, userId: string, today: string) {
  const platform = await db.platforms.get(event.reference_id)
  if (!platform) return

  const targetPocketId = platform.payout_pocket_id ?? destPocketId

  if (event.amount > 0) {
    // The weekly close (usePlatformPayouts) already subtracted closingBalance
    // from the platform pocket and recorded it as this event's amount. At
    // collect time we ONLY move event.amount into the destination — we do
    // NOT touch the platform pocket again. Any positive remainder there is
    // current-week earnings that must be preserved.
    //
    // If a legacy stale event exists (created by older buggy code without a
    // matching close), the user can remove it via the "Eliminar este pendiente"
    // button in the agenda sheet.
    await adjustPocket(targetPocketId, event.amount)
    await addTx(userId, 'income', event.amount, targetPocketId, event, today,
      `Pago ${platform.name} — período cerrado`)
  }

  // The next payout event is created automatically by usePlatformPayouts when
  // the next Sunday closes — no scheduling here.
}

async function scheduleNext(prev: ScheduledEvent, frequency: string, amount: number) {
  // Don't create a duplicate if a pending event already exists for this reference
  const existing = await db.scheduled_events
    .where('user_id').equals(prev.user_id)
    .filter(e => e.reference_id === prev.reference_id && e.type === prev.type && e.status === 'pending')
    .first()
  if (existing) return

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
