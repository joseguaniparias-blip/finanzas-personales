import { useEffect } from 'react'
import { db } from '@/lib/db'

export function usePlatformPayouts(userId: string) {
  useEffect(() => {
    async function checkPayouts() {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)
      const todayDow = today.getDay() // 0=Sun … 6=Sat

      const platforms = await db.platforms
        .where('user_id').equals(userId)
        .and(p => Boolean(p.is_active))
        .toArray()

      for (const platform of platforms) {
        if (platform.payout_day === null || platform.payout_day !== todayDow) continue

        // Find platform pocket
        const platformPockets = await db.pockets
          .where('platform_id').equals(platform.id)
          .and(p => Boolean(p.is_active))
          .toArray()
        const platformPocket = platformPockets[0]
        if (!platformPocket || platformPocket.balance <= 0) continue

        // Check if we already have a pending payout event for today
        const existing = await db.scheduled_events
          .where('user_id').equals(userId)
          .and(e =>
            e.type === 'platform_payout' &&
            e.reference_id === platform.id &&
            e.status === 'pending'
          )
          .count()

        if (existing > 0) continue

        // Create the payout event
        await db.scheduled_events.add({
          id: crypto.randomUUID(),
          user_id: userId,
          type: 'platform_payout',
          reference_id: platform.id,
          reference_type: 'platform',
          amount: platformPocket.balance,
          due_date: todayStr,
          status: 'pending',
          actual_pocket_id: null,
          partial_amount: null,
          remaining_after_partial: null,
          created_at: new Date().toISOString()
        })
      }
    }

    checkPayouts()
  }, [userId])
}
