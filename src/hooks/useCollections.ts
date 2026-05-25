import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { Collection } from '@/types'

type NewCollection = Omit<Collection, 'id' | 'created_at' | 'collected_amount' | 'status'>

interface CollectionsHook {
  collections: Collection[]
  loading: boolean
  addCollection: (c: NewCollection) => Promise<Collection>
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>
  recordCollection: (id: string, amount: number) => Promise<void>
  closeCollection: (id: string) => Promise<void>
}

export function useCollections(userId: string): CollectionsHook {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.collections
      .where('user_id').equals(userId)
      .and(c => c.status === 'active')
      .sortBy('created_at')
    setCollections(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addCollection = async (c: NewCollection): Promise<Collection> => {
    const priorCollected = c.started_before_app
      ? Math.max(0, (c.start_installment - 1) * c.installment_amount)
      : 0
    const collection: Collection = {
      ...c,
      id: crypto.randomUUID(),
      collected_amount: priorCollected,
      status: 'active',
      created_at: new Date().toISOString()
    }
    await db.collections.add(collection)
    await scheduleNextCollectionEvent(collection)
    await load()
    return collection
  }

  const updateCollection = async (id: string, updates: Partial<Collection>) => {
    await db.collections.update(id, updates)
    await load()
  }

  const recordCollection = async (id: string, amount: number) => {
    const col = await db.collections.get(id)
    if (!col) return
    const newCollected = col.collected_amount + amount
    const updates: Partial<Collection> = { collected_amount: newCollected }
    if (col.has_total && col.total_amount && newCollected >= col.total_amount) {
      updates.status = 'fully_collected'
    }
    await db.collections.update(id, updates)
    await load()
  }

  const closeCollection = async (id: string) => {
    const linked = await db.scheduled_events
      .where('user_id').equals(userId)
      .filter(e => e.reference_id === id && e.status === 'pending')
      .toArray()
    for (const e of linked) await db.scheduled_events.delete(e.id)
    await db.collections.update(id, { status: 'cancelled' })
    await load()
  }

  return { collections, loading, addCollection, updateCollection, recordCollection, closeCollection }
}

async function scheduleNextCollectionEvent(col: Collection) {
  if (col.frequency === 'once') {
    const due = col.start_date > new Date().toISOString().slice(0, 10)
      ? col.start_date
      : new Date().toISOString().slice(0, 10)
    await db.scheduled_events.add({
      id: crypto.randomUUID(),
      user_id: col.user_id,
      type: 'collection',
      reference_id: col.id,
      reference_type: 'collection',
      amount: col.installment_amount,
      due_date: due,
      status: 'pending',
      actual_pocket_id: null,
      partial_amount: null,
      remaining_after_partial: null,
      created_at: new Date().toISOString()
    })
    return
  }

  const dueDate = col.start_date > new Date().toISOString().slice(0, 10)
    ? col.start_date
    : nextDueDate(col.frequency, col.payment_day ?? 1)

  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: col.user_id,
    type: 'collection',
    reference_id: col.id,
    reference_type: 'collection',
    amount: col.installment_amount,
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
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
