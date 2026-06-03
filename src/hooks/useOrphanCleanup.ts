import { useEffect, useRef } from 'react'
import { db } from '@/lib/db'
import type { ScheduledEvent } from '@/types'

/**
 * One-shot orphan + duplicate cleanup for scheduled_events.
 *
 * Runs ONCE per session at app start (mount of App.tsx with a real userId).
 * Previously this logic lived inside `useScheduledEvents.load` which fires
 * on every mount of every page that consumes the hook — O(events) DB
 * round-trips on each route change, causing flicker and load.
 *
 * What it cleans up:
 *  - Orphan events: reference_id no longer exists or is inactive/cancelled
 *  - Duplicate events: multiple pending events for the same (type, reference_id)
 *    → keeps the one with the earliest due_date, deletes the rest
 *    (excludes platform_payout — that type has dedicated merge logic in
 *    usePlatformPayouts)
 */
export function useOrphanCleanup(userId: string) {
  const ranForUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return
    if (ranForUserRef.current === userId) return // already cleaned this session
    ranForUserRef.current = userId

    async function cleanup() {
      const allPending = await db.scheduled_events
        .where('user_id').equals(userId)
        .and(e => e.status === 'pending')
        .sortBy('due_date')

      const toDelete: string[] = []

      // ── Orphan detection ──
      for (const ev of allPending) {
        let orphan = false
        if (ev.type === 'debt') {
          const r = await db.debts.get(ev.reference_id)
          orphan = !r || r.status !== 'active'
        } else if (ev.type === 'collection') {
          const r = await db.collections.get(ev.reference_id)
          orphan = !r || r.status !== 'active'
        } else if (ev.type === 'saving') {
          const r = await db.saving_goals.get(ev.reference_id)
          // is_active stored as 0/1 by the Dexie hook
          orphan = !r || !r.is_active
        } else if (ev.type === 'cadena') {
          const r = await db.cadenas.get(ev.reference_id)
          orphan = !r || r.status !== 'active'
        } else if (ev.type === 'platform_payout') {
          const r = await db.platforms.get(ev.reference_id)
          orphan = !r || !r.is_active
        } else if (ev.type === 'recurring') {
          const r = await db.recurring_payments.get(ev.reference_id)
          orphan = !r || !r.is_active
        }
        if (orphan) toDelete.push(ev.id)
      }

      // ── Dedup (excluding platform_payout) ──
      const orphanSet = new Set(toDelete)
      const alive = allPending.filter(e => !orphanSet.has(e.id))
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
      }
    }

    cleanup().catch(err => console.warn('[useOrphanCleanup] failed:', err))
  }, [userId])
}
