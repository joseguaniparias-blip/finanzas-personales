import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { Platform } from '@/types'

type NewPlatform = Omit<Platform, 'id' | 'created_at'>

interface PlatformsHook {
  platforms: Platform[]
  loading: boolean
  addPlatform: (p: NewPlatform) => Promise<Platform>
  updatePlatform: (id: string, updates: Partial<Platform>) => Promise<void>
  deletePlatform: (id: string) => Promise<void>
}

export function usePlatforms(userId: string): PlatformsHook {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.platforms
      .where('user_id').equals(userId)
      .and(p => Boolean(p.is_active))
      .sortBy('created_at')
    setPlatforms(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addPlatform = async (p: NewPlatform): Promise<Platform> => {
    const platform: Platform = { ...p, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    await db.platforms.add(platform)
    await load()
    return platform
  }

  const updatePlatform = async (id: string, updates: Partial<Platform>) => {
    await db.platforms.update(id, updates)

    // If the payout day changed, recompute the due_date of any pending
    // platform_payout event so the agenda reflects the new schedule.
    if (typeof updates.payout_day === 'number') {
      const platform = await db.platforms.get(id)
      if (platform) {
        // Use today as the base so the new due_date lands on the next FUTURE
        // occurrence of payout_day (not a past Tuesday).
        const today = new Date()
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        let diff = (updates.payout_day - d.getDay() + 7) % 7
        if (diff === 0) diff = 7
        d.setDate(d.getDate() + diff)
        const newDueDate = d.toISOString().slice(0, 10)

        const pending = await db.scheduled_events
          .where('user_id').equals(platform.user_id)
          .filter(e => e.type === 'platform_payout' && e.reference_id === id && e.status === 'pending')
          .toArray()
        for (const ev of pending) {
          if (ev.due_date !== newDueDate) {
            await db.scheduled_events.update(ev.id, { due_date: newDueDate })
          }
        }
      }
    }

    await load()
  }

  const deletePlatform = async (id: string) => {
    await db.platforms.update(id, { is_active: false })
    await load()
  }

  return { platforms, loading, addPlatform, updatePlatform, deletePlatform }
}
