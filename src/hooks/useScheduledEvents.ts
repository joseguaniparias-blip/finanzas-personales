import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import type { ScheduledEvent, EventType } from '@/types'
import { todayISO, toISODate } from '@/lib/date'

interface ScheduledEventsHook {
  events: ScheduledEvent[]
  todayEvents: ScheduledEvent[]
  recentConfirmed: ScheduledEvent[]
  loading: boolean
  confirmEvent: (id: string, pocketId: string) => Promise<void>
  partialEvent: (id: string, pocketId: string, paidAmount: number) => Promise<void>
  postponeEvent: (id: string) => Promise<void>
  rescheduleEvent: (id: string, newDate: string) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  reverseConfirmed: (id: string) => Promise<void>
  editConfirmed: (id: string, changes: EventEdit) => Promise<void>
  getPendingByType: (type: EventType) => ScheduledEvent[]
  getPendingByRef: (referenceId: string) => ScheduledEvent | undefined
}

export interface EventEdit {
  amount?: number
  pocketId?: string
  date?: string
}

// How many recently-confirmed events to surface for correction on the Home.
const RECENT_CONFIRMED_LIMIT = 20

export function useScheduledEvents(userId: string): ScheduledEventsHook {
  const [events, setEvents] = useState<ScheduledEvent[]>([])
  const [recentConfirmed, setRecentConfirmed] = useState<ScheduledEvent[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    // Migrate any legacy 'partial' rows (created before the abono-libre change,
    // where the event was parked as 'partial' with its ORIGINAL amount and the
    // outstanding balance stored in remaining_after_partial). If we surfaced
    // those as-is, confirming one would re-charge the FULL cuota — double-billing
    // the part already paid. Normalise them to pending with amount = remaining.
    await normalizeLegacyPartials(userId)

    // Pure read. Orphan/duplicate cleanup runs once per session via
    // useOrphanCleanup (mounted in App.tsx), so this hook stays cheap.
    const all = await db.scheduled_events
      .where('user_id').equals(userId)
      .sortBy('due_date')
    if (!mountedRef.current) return
    // A partial abono no longer parks the event in a dead 'partial' state — the
    // card stays pending with the remaining amount. Any 'partial' row still seen
    // here is mid-migration; treat it as pending.
    const pending = all.filter(e => e.status === 'pending' || e.status === 'partial')
    const confirmed = all
      .filter(e => e.status === 'confirmed' && e.type !== 'platform_payout')
      .sort((a, b) => (a.due_date < b.due_date ? 1 : -1))
      .slice(0, RECENT_CONFIRMED_LIMIT)
    setEvents(pending)
    setRecentConfirmed(confirmed)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const today = todayISO()
  const todayEvents = events.filter(e => e.due_date <= today)

  const confirmEvent = async (id: string, pocketId: string) => {
    await confirmEventTx(userId, id, pocketId, today)
    await load()
  }

  const partialEvent = async (id: string, pocketId: string, paidAmount: number) => {
    await partialEventTx(userId, id, pocketId, paidAmount, today)
    await load()
  }

  const postponeEvent = async (id: string) => {
    // Posponer = correr 1 día desde la fecha ACTUAL del evento, no regresar
    // a "mañana". Si el evento estaba para dentro de 30 días, posponer un día
    // lo mueve al día 31 — antes lo regresaba a mañana, una regresión brutal.
    const ev = await db.scheduled_events.get(id)
    if (!ev) return
    const d = new Date(ev.due_date + 'T12:00:00')  // noon → no DST/timezone surprises
    d.setDate(d.getDate() + 1)
    await db.scheduled_events.update(id, { due_date: toISODate(d) })
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

  const reverseConfirmed = async (id: string) => {
    await reverseEvent(id)
    await load()
  }

  const editConfirmed = async (id: string, changes: EventEdit) => {
    await editConfirmedEvent(id, changes)
    await load()
  }

  const getPendingByType = (type: EventType) => events.filter(e => e.type === type)
  const getPendingByRef = (referenceId: string) => events.find(e => e.reference_id === referenceId)

  return {
    events, todayEvents, recentConfirmed, loading,
    confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent,
    reverseConfirmed, editConfirmed, getPendingByType, getPendingByRef,
  }
}

// ─── Transactional core (exported for tests) ─────────────────────────────────

const TX_TABLES = [
  db.scheduled_events, db.pockets, db.transactions,
  db.debts, db.collections, db.saving_goals, db.cadenas, db.platforms, db.recurring_payments,
] as const

/** true for event types that move money INTO a pocket (income), false for expense-like. */
function isIncomeType(type: EventType): boolean {
  return type === 'collection' || type === 'platform_payout'
}

export async function confirmEventTx(userId: string, id: string, pocketId: string, today: string) {
  // Wrap everything in a single Dexie transaction so the status check + side
  // effects are truly atomic. Without this, two parallel taps both see status
  // === 'pending', both pass the guard, and both run side-effects → doubled
  // balance, doubled transactions, doubled scheduleNext.
  await db.transaction('rw', [...TX_TABLES], async () => {
    const event = await db.scheduled_events.get(id)
    if (!event || (event.status !== 'pending' && event.status !== 'partial')) return

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

    } else if (event.type === 'recurring') {
      await adjustPocket(pocketId, -event.amount)
      await addTx(userId, 'expense', event.amount, pocketId, event, today)
      await handleRecurringConfirm(event)
    }
  })
}

export async function partialEventTx(userId: string, id: string, pocketId: string, paidAmount: number, today: string) {
  // Same atomicity strategy as confirmEventTx.
  await db.transaction('rw', [...TX_TABLES], async () => {
    const event = await db.scheduled_events.get(id)
    if (!event || (event.status !== 'pending' && event.status !== 'partial')) return

    const isIncome = isIncomeType(event.type)

    // If the abono covers (or exceeds) what's left of the cuota, this completes
    // it: confirm with the paid amount, advance the origin, schedule next.
    if (paidAmount >= event.amount) {
      await db.scheduled_events.update(id, { status: 'confirmed', actual_pocket_id: pocketId })
      const overrideEvent: ScheduledEvent = { ...event, amount: paidAmount }
      if (event.type !== 'platform_payout') {
        await adjustPocket(pocketId, isIncome ? +paidAmount : -paidAmount)
        await addTx(userId, isIncome ? 'income' : 'expense', paidAmount, pocketId, overrideEvent, today)
      }
      if (event.type === 'debt')            await handleDebtConfirm(overrideEvent)
      else if (event.type === 'collection') await handleCollectionConfirm(overrideEvent)
      else if (event.type === 'saving')     await handleSavingConfirm(overrideEvent)
      else if (event.type === 'cadena')     await handleCadenaConfirm(overrideEvent)
      else if (event.type === 'recurring')  await handleRecurringConfirm(overrideEvent)
      return
    }

    // Abono libre: the card STAYS pending, with its amount reduced to the
    // remainder, so the user can keep adjusting/completing it later.
    const remaining = event.amount - paidAmount

    await adjustPocket(pocketId, isIncome ? +paidAmount : -paidAmount)
    await addTx(userId, isIncome ? 'income' : 'expense', paidAmount, pocketId, event, today,
      `Abono parcial — quedan $${remaining.toLocaleString('es-CO')}`)

    await applyAdvance(event, paidAmount)

    await db.scheduled_events.update(id, {
      status: 'pending',
      amount: remaining,
      actual_pocket_id: pocketId,
      partial_amount: (event.partial_amount ?? 0) + paidAmount,
      remaining_after_partial: remaining,
    })
  })
}

/**
 * Undo a confirmed payment: refund the pocket(s), delete the generated
 * transaction(s), roll back the origin's progress, remove the auto-scheduled
 * next event, and return the event to pending so it can be redone.
 */
export async function reverseEvent(id: string) {
  await db.transaction('rw', [...TX_TABLES], async () => {
    const event = await db.scheduled_events.get(id)
    if (!event || event.status !== 'confirmed') return
    if (event.type === 'platform_payout') return  // has its own flow; not reversed here

    const linked = await linkedTransactions(id, event)
    let total = 0
    for (const t of linked) {
      // Reverse each leg's effect on its pocket, then delete it.
      if (t.type === 'income')       await adjustPocket(t.pocket_id, -t.amount)
      else if (t.type === 'expense') await adjustPocket(t.pocket_id, +t.amount)
      total += t.amount
      await db.transactions.delete(t.id)
    }

    await reverseAdvance(event, total)

    // Remove the auto-scheduled next event (scheduleNext creates a fresh pending
    // sibling for the same reference). Only delete UNTOUCHED pending siblings so
    // we never destroy an abono the user already made on the next period.
    const siblings = await db.scheduled_events
      .where('user_id').equals(event.user_id)
      .and(e => e.reference_id === event.reference_id && e.type === event.type
        && e.id !== id && e.status === 'pending' && (e.partial_amount ?? 0) === 0)
      .toArray()
    for (const s of siblings) await db.scheduled_events.delete(s.id)

    await db.scheduled_events.update(id, {
      status: 'pending',
      actual_pocket_id: null,
      partial_amount: null,
      remaining_after_partial: null,
    })
  })
}

/**
 * Edit a confirmed payment in place: change amount, pocket and/or date, and
 * recalculate the pocket balances, the linked transaction and the origin's
 * progress so everything stays consistent.
 */
export async function editConfirmedEvent(id: string, changes: EventEdit) {
  await db.transaction('rw', [...TX_TABLES], async () => {
    const event = await db.scheduled_events.get(id)
    if (!event || event.status !== 'confirmed') return
    if (event.type === 'platform_payout') return

    const linked = await linkedTransactions(id, event)
    const primary = linked[0]  // confirmed-in-full events have exactly one linked tx
    const sign = isIncomeType(event.type) ? +1 : -1

    const evUpdates: Partial<ScheduledEvent> = {}
    const txUpdates: Record<string, unknown> = {}

    // ── Amount ──────────────────────────────────────────────────────────────
    if (changes.amount != null && changes.amount !== event.amount) {
      const delta = changes.amount - event.amount
      const pocketId = changes.pocketId ?? event.actual_pocket_id
      if (pocketId) await adjustPocket(pocketId, sign * delta)
      await applyAdvance(event, delta)
      evUpdates.amount = changes.amount
      txUpdates.amount = changes.amount
    }

    // ── Pocket ──────────────────────────────────────────────────────────────
    if (changes.pocketId && changes.pocketId !== event.actual_pocket_id) {
      const amt = changes.amount ?? event.amount
      if (event.actual_pocket_id) await adjustPocket(event.actual_pocket_id, -sign * amt)
      await adjustPocket(changes.pocketId, sign * amt)
      evUpdates.actual_pocket_id = changes.pocketId
      txUpdates.pocket_id = changes.pocketId
    }

    // ── Date ────────────────────────────────────────────────────────────────
    if (changes.date && changes.date !== event.due_date) {
      evUpdates.due_date = changes.date
      txUpdates.date = changes.date
    }

    if (primary && Object.keys(txUpdates).length) await db.transactions.update(primary.id, txUpdates)
    if (Object.keys(evUpdates).length) await db.scheduled_events.update(id, evUpdates)
  })
}

/**
 * One-time data migration: convert legacy 'partial' events (original amount +
 * remaining_after_partial) into pending events whose amount IS the remaining
 * balance, so the abono-libre model applies uniformly and no confirm re-charges
 * an already-paid portion. Idempotent — once migrated the rows are 'pending' and
 * skipped.
 */
export async function normalizeLegacyPartials(userId: string) {
  const legacy = await db.scheduled_events
    .where('user_id').equals(userId)
    .and(e => e.status === 'partial')
    .toArray()
  for (const e of legacy) {
    const remaining = e.remaining_after_partial ?? e.amount
    await db.scheduled_events.update(e.id, { status: 'pending', amount: remaining })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find the transactions generated by a given event. Prefers the exact
 * event_id tag; falls back to reference matching for legacy rows without it. */
async function linkedTransactions(eventId: string, event: ScheduledEvent) {
  const tagged = await db.transactions.filter(t => t.event_id === eventId).toArray()
  if (tagged.length) return tagged
  // Legacy fallback: same reference and pocket, on the confirm date if known.
  const pocketId = event.actual_pocket_id
  return db.transactions.filter(t =>
    t.reference_id === event.reference_id &&
    t.reference_type === event.reference_type &&
    (!pocketId || t.pocket_id === pocketId)
  ).toArray()
}

async function adjustPocket(pocketId: string, delta: number) {
  const pocket = await db.pockets.get(pocketId)
  if (pocket) await db.pockets.update(pocketId, { balance: pocket.balance + delta })
}

async function addTx(
  userId: string, type: 'income' | 'expense', amount: number,
  pocketId: string, event: ScheduledEvent, date: string, note?: string
) {
  // For platform_payout events the reference_id IS the platform id, so we
  // tag the transaction with platform_id too — Reports / dashboards filter
  // ingresos by plataforma and these payouts must show up there.
  const platformId = event.type === 'platform_payout' ? event.reference_id : null
  await db.transactions.add({
    id: crypto.randomUUID(), user_id: userId, type, amount,
    pocket_id: pocketId, category_id: null, platform_id: platformId,
    reference_id: event.reference_id, reference_type: event.reference_type,
    event_id: event.id,
    note: note ?? null, receipt_url: null, date,
    created_at: new Date().toISOString()
  })
}

/** Add `delta` (can be negative) to the numeric progress of the origin record. */
async function applyAdvance(event: ScheduledEvent, delta: number) {
  if (event.type === 'debt') {
    const debt = await db.debts.get(event.reference_id)
    if (!debt) return
    const newPaid = debt.paid_amount + delta
    const updates: Record<string, unknown> = { paid_amount: newPaid }
    if (debt.has_total && debt.total_amount) {
      updates.status = newPaid >= debt.total_amount ? 'paid_off' : 'active'
    } else if (delta < 0 && debt.status === 'paid_off') {
      updates.status = 'active'
    }
    await db.debts.update(debt.id, updates)
  } else if (event.type === 'collection') {
    const col = await db.collections.get(event.reference_id)
    if (!col) return
    const newCollected = col.collected_amount + delta
    const updates: Record<string, unknown> = { collected_amount: newCollected }
    if (col.has_total && col.total_amount) {
      updates.status = newCollected >= col.total_amount ? 'fully_collected' : 'active'
    } else if (delta < 0 && col.status === 'fully_collected') {
      updates.status = 'active'
    }
    await db.collections.update(col.id, updates)
  } else if (event.type === 'saving') {
    const goal = await db.saving_goals.get(event.reference_id)
    if (goal) await db.saving_goals.update(goal.id, { saved_amount: goal.saved_amount + delta })
  }
}

/** Roll back the origin's progress after undoing a confirmed event. */
async function reverseAdvance(event: ScheduledEvent, total: number) {
  if (event.type === 'debt' || event.type === 'collection' || event.type === 'saving') {
    await applyAdvance(event, -total)
  } else if (event.type === 'cadena') {
    const cadena = await db.cadenas.get(event.reference_id)
    if (!cadena) return
    const updates: Record<string, unknown> = {
      paid_rounds: Math.max(0, cadena.paid_rounds - 1),
      current_round: Math.max(1, cadena.current_round - 1),
    }
    if (cadena.status === 'completed') updates.status = 'active'
    await db.cadenas.update(cadena.id, updates)
  }
  // recurring has no cumulative progress to roll back.
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

  const d = new Date(prev.due_date + 'T12:00:00')
  if (frequency === 'monthly')      d.setMonth(d.getMonth() + 1)
  else if (frequency === 'weekly')  d.setDate(d.getDate() + 7)
  else if (frequency === 'yearly')  d.setFullYear(d.getFullYear() + 1)
  else                              d.setDate(d.getDate() + 1)

  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: prev.user_id,
    type: prev.type,
    reference_id: prev.reference_id,
    reference_type: prev.reference_type,
    amount,
    due_date: toISODate(d),
    status: 'pending',
    actual_pocket_id: null,
    partial_amount: null,
    remaining_after_partial: null,
    created_at: new Date().toISOString()
  })
}

async function handleRecurringConfirm(event: ScheduledEvent) {
  const rec = await db.recurring_payments.get(event.reference_id)
  if (!rec || !rec.is_active) return
  // Always schedule the next period — recurring payments are open-ended.
  // For variable amounts we re-use the configured base amount (the user can
  // override at confirm time via the partial sheet); the next event keeps
  // the configured suggestion.
  await scheduleNext(event, rec.frequency, rec.amount)
}
