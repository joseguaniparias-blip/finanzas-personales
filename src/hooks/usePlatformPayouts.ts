import { useEffect } from 'react'
import { db } from '@/lib/db'

/**
 * Runs on app load. For each platform whose payout_day matches today,
 * creates a pending platform_payout scheduled event — regardless of
 * whether the balance is positive or negative.
 *
 * Logic:
 *  - balance > 0  → event shows positive amount → will transfer to payout pocket
 *  - balance ≤ 0  → event shows 0 → period closes, negative balance carries forward
 */
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

        // Find platform wallet pocket
        const platformPockets = await db.pockets
          .where('platform_id').equals(platform.id)
          .and(p => Boolean(p.is_active))
          .toArray()
        const platformPocket = platformPockets[0]
        if (!platformPocket) continue

        // Don't duplicate: skip if already have a pending payout event for this platform
        const existing = await db.scheduled_events
          .where('user_id').equals(userId)
          .and(e =>
            e.type === 'platform_payout' &&
            e.reference_id === platform.id &&
            e.status === 'pending'
          )
          .count()
        if (existing > 0) continue

        // Create payout event — amount is the current balance (can be 0 or negative)
        // The actual transfer amount is re-read at confirm time from the live balance
        await db.scheduled_events.add({
          id: crypto.randomUUID(),
          user_id: userId,
          type: 'platform_payout',
          reference_id: platform.id,
          reference_type: 'platform',
          amount: platformPocket.balance,   // informational; re-read at confirm
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
