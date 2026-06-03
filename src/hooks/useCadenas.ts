import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import type { Cadena } from '@/types'
import { toISODate } from '@/lib/date'

type NewCadena = Omit<Cadena, 'id' | 'created_at' | 'status' | 'current_round'>

interface CadenasHook {
  cadenas: Cadena[]
  loading: boolean
  addCadena: (c: NewCadena) => Promise<Cadena>
  updateCadena: (id: string, updates: Partial<Cadena>) => Promise<void>
  recordPayment: (id: string) => Promise<void>
  closeCadena: (id: string) => Promise<void>
  deleteCadena: (id: string) => Promise<void>
}

export function useCadenas(userId: string): CadenasHook {
  const [cadenas, setCadenas] = useState<Cadena[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    const data = await db.cadenas
      .where('user_id').equals(userId)
      .and(c => c.status === 'active')
      .sortBy('created_at')
    if (!mountedRef.current) return
    setCadenas(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addCadena = async (c: NewCadena): Promise<Cadena> => {
    const cadena: Cadena = {
      ...c,
      id: crypto.randomUUID(),
      current_round: c.started_before_app ? c.paid_rounds + 1 : 1,
      status: 'active',
      created_at: new Date().toISOString()
    }
    await db.cadenas.add(cadena)
    await scheduleNextCadenaEvent(cadena)
    await load()
    return cadena
  }

  const updateCadena = async (id: string, updates: Partial<Cadena>) => {
    await db.cadenas.update(id, updates)
    await load()
  }

  const recordPayment = async (id: string) => {
    const cadena = await db.cadenas.get(id)
    if (!cadena) return
    const newPaid = cadena.paid_rounds + 1
    const newCurrent = cadena.current_round + 1
    const updates: Partial<Cadena> = { paid_rounds: newPaid, current_round: newCurrent }
    if (newCurrent > cadena.participants) {
      updates.status = 'completed'
    }
    await db.cadenas.update(id, updates)
    await load()
  }

  const closeCadena = async (id: string) => {
    // 'cancelled' = el usuario abandonó / cerró manualmente.
    // 'completed' se reserva para cuando todas las rondas naturalmente terminaron
    // (ver recordPayment que setea completed cuando current_round > participants).
    await db.transaction('rw', db.cadenas, db.scheduled_events, async () => {
      const linked = await db.scheduled_events
        .where('user_id').equals(userId)
        .filter(e => e.reference_id === id && e.status === 'pending')
        .toArray()
      for (const e of linked) await db.scheduled_events.delete(e.id)
      await db.cadenas.update(id, { status: 'cancelled' })
    })
    await load()
  }

  const deleteCadena = async (id: string) => {
    // Remove all pending scheduled events linked to this cadena
    const linked = await db.scheduled_events
      .where('user_id').equals(userId)
      .filter(e => e.reference_id === id && e.status === 'pending')
      .toArray()
    for (const e of linked) await db.scheduled_events.delete(e.id)
    await db.cadenas.delete(id)
    await load()
  }

  return { cadenas, loading, addCadena, updateCadena, recordPayment, closeCadena, deleteCadena }
}

async function scheduleNextCadenaEvent(cadena: Cadena) {
  const dueDate = nextDueDate(cadena.frequency)
  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: cadena.user_id,
    type: 'cadena',
    reference_id: cadena.id,
    reference_type: 'cadena',
    amount: cadena.contribution_amount,
    due_date: dueDate,
    status: 'pending',
    actual_pocket_id: null,
    partial_amount: null,
    remaining_after_partial: null,
    created_at: new Date().toISOString()
  })
}

function nextDueDate(frequency: string): string {
  const now = new Date()
  if (frequency === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return toISODate(d)
  }
  const d = new Date(now)
  d.setDate(d.getDate() + 7)
  return toISODate(d)
}
