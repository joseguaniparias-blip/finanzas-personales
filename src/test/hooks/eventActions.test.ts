import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { confirmEventTx, partialEventTx, reverseEvent, editConfirmedEvent } from '@/hooks/useScheduledEvents'
import type { Pocket, Debt, Collection, ScheduledEvent } from '@/types'

const USER = 'user-events-1'
const TODAY = '2026-07-24'

function pocket(over: Partial<Pocket> & Pick<Pocket, 'id'>): Pocket {
  return {
    user_id: USER, name: 'P', type: 'cash', platform_id: null,
    balance: 0, color: '#000', icon: '💵', is_active: true, created_at: '', ...over,
  }
}

function debt(over: Partial<Debt> & Pick<Debt, 'id'>): Debt {
  return {
    user_id: USER, name: 'D', has_total: false, total_amount: null,
    installment_amount: 50000, frequency: 'monthly', payment_day: 1,
    source_pocket_id: 'p1', paid_amount: 0, status: 'active',
    started_before_app: false, start_installment: 0, created_at: '', ...over,
  }
}

function collection(over: Partial<Collection> & Pick<Collection, 'id'>): Collection {
  return {
    user_id: USER, name: 'C', person_name: 'X', has_total: false, total_amount: null,
    installment_amount: 40000, frequency: 'monthly', payment_day: 1, dest_pocket_id: 'p1',
    collected_amount: 0, status: 'active', start_date: TODAY, started_before_app: false,
    start_installment: 0, created_at: '', ...over,
  }
}

function ev(over: Partial<ScheduledEvent> & Pick<ScheduledEvent, 'id' | 'type' | 'reference_id' | 'amount'>): ScheduledEvent {
  return {
    user_id: USER, reference_type: over.type ?? 'debt', due_date: TODAY,
    status: 'pending', actual_pocket_id: null, partial_amount: null,
    remaining_after_partial: null, created_at: '', ...over,
  }
}

beforeEach(async () => {
  await Promise.all([
    db.pockets.clear(), db.transactions.clear(), db.scheduled_events.clear(),
    db.debts.clear(), db.collections.clear(), db.saving_goals.clear(),
    db.cadenas.clear(), db.platforms.clear(), db.recurring_payments.clear(),
  ])
})

describe('confirmEventTx (debt)', () => {
  it('moves money, records a tagged tx, advances the debt, schedules next', async () => {
    await db.pockets.add(pocket({ id: 'p1', balance: 100000 }))
    await db.debts.add(debt({ id: 'd1' }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'debt', reference_id: 'd1', amount: 50000 }))

    await confirmEventTx(USER, 'e1', 'p1', TODAY)

    expect((await db.pockets.get('p1'))?.balance).toBe(50000)
    expect((await db.debts.get('d1'))?.paid_amount).toBe(50000)
    const confirmed = await db.scheduled_events.get('e1')
    expect(confirmed?.status).toBe('confirmed')
    const txs = await db.transactions.where('user_id').equals(USER).toArray()
    const linked = txs.filter(t => t.event_id === 'e1')
    expect(linked).toHaveLength(1)
    expect(linked[0]).toMatchObject({ type: 'expense', amount: 50000, pocket_id: 'p1' })
    // scheduleNext created a fresh pending event for the same debt
    const pendingNext = txs.length && await db.scheduled_events
      .where('user_id').equals(USER).and(e => e.status === 'pending' && e.reference_id === 'd1').toArray()
    expect(pendingNext).toHaveLength(1)
  })
})

describe('partialEventTx keeps the card pending with the remainder (#3)', () => {
  it('debt: charges the abono, advances paid_amount, leaves event pending at remaining', async () => {
    await db.pockets.add(pocket({ id: 'p1', balance: 100000 }))
    await db.debts.add(debt({ id: 'd1', installment_amount: 50000 }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'debt', reference_id: 'd1', amount: 50000 }))

    await partialEventTx(USER, 'e1', 'p1', 20000, TODAY)

    expect((await db.pockets.get('p1'))?.balance).toBe(80000)
    expect((await db.debts.get('d1'))?.paid_amount).toBe(20000)
    const e = await db.scheduled_events.get('e1')
    expect(e?.status).toBe('pending')
    expect(e?.amount).toBe(30000) // remaining is the new card amount
    // no next period scheduled yet — still same cuota
    const pending = await db.scheduled_events.where('user_id').equals(USER)
      .and(x => x.status === 'pending' && x.reference_id === 'd1').toArray()
    expect(pending).toHaveLength(1)
    const linked = (await db.transactions.toArray()).filter(t => t.event_id === 'e1')
    expect(linked).toHaveLength(1)
    expect(linked[0].amount).toBe(20000)
  })

  it('a second abono that completes the cuota confirms and schedules next', async () => {
    await db.pockets.add(pocket({ id: 'p1', balance: 100000 }))
    await db.debts.add(debt({ id: 'd1', installment_amount: 50000 }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'debt', reference_id: 'd1', amount: 50000 }))

    await partialEventTx(USER, 'e1', 'p1', 20000, TODAY) // remaining 30000
    await partialEventTx(USER, 'e1', 'p1', 30000, TODAY) // completes

    expect((await db.pockets.get('p1'))?.balance).toBe(50000)
    expect((await db.debts.get('d1'))?.paid_amount).toBe(50000)
    expect((await db.scheduled_events.get('e1'))?.status).toBe('confirmed')
  })
})

describe('reverseEvent undoes a confirmed payment (#4)', () => {
  it('debt: restores pocket, deletes the tx, rolls back paid_amount, returns to pending', async () => {
    await db.pockets.add(pocket({ id: 'p1', balance: 100000 }))
    await db.debts.add(debt({ id: 'd1' }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'debt', reference_id: 'd1', amount: 50000 }))
    await confirmEventTx(USER, 'e1', 'p1', TODAY)

    await reverseEvent('e1')

    expect((await db.pockets.get('p1'))?.balance).toBe(100000)
    expect((await db.debts.get('d1'))?.paid_amount).toBe(0)
    const e = await db.scheduled_events.get('e1')
    expect(e?.status).toBe('pending')
    expect(e?.actual_pocket_id).toBeNull()
    expect((await db.transactions.toArray()).filter(t => t.event_id === 'e1')).toHaveLength(0)
    // the scheduled-next sibling was removed → exactly one pending remains
    const pending = await db.scheduled_events.where('user_id').equals(USER)
      .and(x => x.status === 'pending' && x.reference_id === 'd1').toArray()
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe('e1')
  })

  it('collection: rolls back collected_amount and pocket (income direction)', async () => {
    await db.pockets.add(pocket({ id: 'p1', balance: 100000 }))
    await db.collections.add(collection({ id: 'c1' }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'collection', reference_id: 'c1', amount: 40000 }))
    await confirmEventTx(USER, 'e1', 'p1', TODAY)
    expect((await db.pockets.get('p1'))?.balance).toBe(140000)

    await reverseEvent('e1')
    expect((await db.pockets.get('p1'))?.balance).toBe(100000)
    expect((await db.collections.get('c1'))?.collected_amount).toBe(0)
    expect((await db.scheduled_events.get('e1'))?.status).toBe('pending')
  })
})

describe('editConfirmedEvent recalculates differences (#4)', () => {
  it('amount change adjusts pocket, tx and advance by the delta', async () => {
    await db.pockets.add(pocket({ id: 'p1', balance: 100000 }))
    await db.debts.add(debt({ id: 'd1' }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'debt', reference_id: 'd1', amount: 50000 }))
    await confirmEventTx(USER, 'e1', 'p1', TODAY)

    await editConfirmedEvent('e1', { amount: 60000 })

    expect((await db.pockets.get('p1'))?.balance).toBe(40000) // 50000 − extra 10000
    expect((await db.debts.get('d1'))?.paid_amount).toBe(60000)
    expect((await db.scheduled_events.get('e1'))?.amount).toBe(60000)
    const linked = (await db.transactions.toArray()).filter(t => t.event_id === 'e1')
    expect(linked[0].amount).toBe(60000)
  })

  it('pocket change moves money between pockets and re-tags the tx', async () => {
    await db.pockets.bulkAdd([pocket({ id: 'p1', balance: 100000 }), pocket({ id: 'p2', balance: 100000 })])
    await db.debts.add(debt({ id: 'd1' }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'debt', reference_id: 'd1', amount: 50000 }))
    await confirmEventTx(USER, 'e1', 'p1', TODAY)

    await editConfirmedEvent('e1', { pocketId: 'p2' })

    expect((await db.pockets.get('p1'))?.balance).toBe(100000) // refunded
    expect((await db.pockets.get('p2'))?.balance).toBe(50000)  // charged
    expect((await db.scheduled_events.get('e1'))?.actual_pocket_id).toBe('p2')
    const linked = (await db.transactions.toArray()).filter(t => t.event_id === 'e1')
    expect(linked[0].pocket_id).toBe('p2')
  })

  it('date change updates the tx date and the event due_date', async () => {
    await db.pockets.add(pocket({ id: 'p1', balance: 100000 }))
    await db.debts.add(debt({ id: 'd1' }))
    await db.scheduled_events.add(ev({ id: 'e1', type: 'debt', reference_id: 'd1', amount: 50000 }))
    await confirmEventTx(USER, 'e1', 'p1', TODAY)

    await editConfirmedEvent('e1', { date: '2026-07-20' })

    expect((await db.scheduled_events.get('e1'))?.due_date).toBe('2026-07-20')
    const linked = (await db.transactions.toArray()).filter(t => t.event_id === 'e1')
    expect(linked[0].date).toBe('2026-07-20')
  })
})
