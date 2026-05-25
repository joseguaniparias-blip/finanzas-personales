import { useEffect, useState, useCallback, useRef } from 'react'
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

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    const data = await db.platforms
      .where('user_id').equals(userId)
      .and(p => Boolean(p.is_active))
      .sortBy('created_at')
    if (!mountedRef.current) return
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
    // Cascade soft-delete: deactivate the platform + its pockets, and remove
    // pending payout events. Without this, the linked pocket lingered in the
    // active list (with platform_id pointing to an inactive platform) and the
    // pending events kept appearing in the agenda as ghosts.
    await db.transaction('rw', db.platforms, db.pockets, db.scheduled_events, async () => {
      await db.platforms.update(id, { is_active: false })

      const linkedPockets = await db.pockets.where('platform_id').equals(id).toArray()
      for (const p of linkedPockets) {
        await db.pockets.update(p.id, { is_active: false })
      }

      const linkedEvents = await db.scheduled_events
        .where('user_id').equals(userId)
        .filter(e => e.type === 'platform_payout' && e.reference_id === id && e.status === 'pending')
        .toArray()
      for (const ev of linkedEvents) {
        await db.scheduled_events.delete(ev.id)
      }
    })
    await load()
  }

  return { platforms, loading, addPlatform, updatePlatform, deletePlatform }
}
