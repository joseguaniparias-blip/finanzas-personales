import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { SavingGoal } from '@/types'

type NewSavingGoal = Omit<SavingGoal, 'id' | 'created_at' | 'saved_amount' | 'is_active'>

interface SavingGoalsHook {
  goals: SavingGoal[]
  loading: boolean
  addGoal: (g: NewSavingGoal) => Promise<SavingGoal>
  updateGoal: (id: string, updates: Partial<SavingGoal>) => Promise<void>
  recordSaving: (id: string, amount: number) => Promise<void>
  closeGoal: (id: string) => Promise<void>
}

export function useSavingGoals(userId: string): SavingGoalsHook {
  const [goals, setGoals] = useState<SavingGoal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.saving_goals
      .where('user_id').equals(userId)
      .and(g => Boolean(g.is_active))
      .sortBy('created_at')
    setGoals(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addGoal = async (g: NewSavingGoal): Promise<SavingGoal> => {
    const goal: SavingGoal = {
      ...g,
      id: crypto.randomUUID(),
      saved_amount: 0,
      is_active: true,
      created_at: new Date().toISOString()
    }
    await db.saving_goals.add(goal)
    await scheduleNextSavingEvent(goal)
    await load()
    return goal
  }

  const updateGoal = async (id: string, updates: Partial<SavingGoal>) => {
    await db.saving_goals.update(id, updates)
    await load()
  }

  const recordSaving = async (id: string, amount: number) => {
    const goal = await db.saving_goals.get(id)
    if (!goal) return
    await db.saving_goals.update(id, { saved_amount: goal.saved_amount + amount })
    await load()
  }

  const closeGoal = async (id: string) => {
    await db.saving_goals.update(id, { is_active: false })
    await load()
  }

  return { goals, loading, addGoal, updateGoal, recordSaving, closeGoal }
}

async function scheduleNextSavingEvent(goal: SavingGoal) {
  if (goal.frequency === 'on_payout') return // triggered by platform payout

  const dueDate = nextDueDate(goal.frequency, goal.trigger_day ?? 1)
  await db.scheduled_events.add({
    id: crypto.randomUUID(),
    user_id: goal.user_id,
    type: 'saving',
    reference_id: goal.id,
    reference_type: 'saving_goal',
    amount: goal.contribution_amount,
    due_date: dueDate,
    status: 'pending',
    actual_pocket_id: null,
    partial_amount: null,
    remaining_after_partial: null,
    created_at: new Date().toISOString()
  })
}

function nextDueDate(frequency: string, triggerDay: number): string {
  const now = new Date()
  if (frequency === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth(), triggerDay)
    if (d <= now) d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  }
  // weekly
  const diff = (triggerDay - now.getDay() + 7) % 7 || 7
  const d = new Date(now)
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}
