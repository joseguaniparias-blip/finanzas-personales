import { useEffect } from 'react'
import { db } from '@/lib/db'

/**
 * Weekly close logic for platform wallets.
 *
 * Work week is Monday → Sunday. The platform balance accumulates work done
 * during the week. At end of Sunday it "closes":
 *  - positive balance  → snapshotted into a payout scheduled_event due on the
 *                        configured payout_day; platform balance reset to 0
 *  - negative balance  → stays on the platform pocket (debt carries to new week);
 *                        no payout event created
 *
 * Runs on app load; re-evaluates if a Sunday has passed since the last close.
 */
export function usePlatformPayouts(userId: string) {
  useEffect(() => {
    async function closePastWeeks() {
      const today = new Date()
      const lastSunday = mostRecentSunday(today)
      const lastSundayStr = isoDate(lastSunday)

      const platforms = await db.platforms
        .where('user_id').equals(userId)
        .and(p => Boolean(p.is_active))
        .toArray()

      for (const platform of platforms) {
        if (platform.payout_day === null) continue

        // Correct due_date: next occurrence of payout_day after the last closed Sunday
        const correctDueDate = isoDate(nextOccurrenceAfter(lastSunday, platform.payout_day))

        // ── Step 1: Deduplicate pending events and fix their due_date ──────────
        // Runs every load so stale/duplicate events from previous config changes
        // or race conditions are cleaned up automatically.
        const allPending = await db.scheduled_events
          .where('user_id').equals(userId)
          .filter(e => e.type === 'platform_payout' && e.reference_id === platform.id && e.status === 'pending')
          .toArray()

        const validPending   = allPending.filter(e => e.amount > 0)
        const invalidPending = allPending.filter(e => e.amount <= 0)
        for (const ev of invalidPending) await db.scheduled_events.delete(ev.id)

        if (validPending.length > 1) {
          // Merge all amounts into the first event, delete the rest
          const totalAmount = validPending.reduce((s, e) => s + e.amount, 0)
          await db.scheduled_events.update(validPending[0].id, { amount: totalAmount, due_date: correctDueDate })
          for (let i = 1; i < validPending.length; i++) {
            await db.scheduled_events.delete(validPending[i].id)
          }
        } else if (validPending.length === 1 && validPending[0].due_date !== correctDueDate) {
          await db.scheduled_events.update(validPending[0].id, { due_date: correctDueDate })
        }

        // ── Step 2: Close this week if not already done ────────────────────────
        if (platform.last_closed_sunday === lastSundayStr) continue

        const platformPockets = await db.pockets
          .where('platform_id').equals(platform.id)
          .and(p => Boolean(p.is_active))
          .toArray()
        const platformPocket = platformPockets[0]
        if (!platformPocket) {
          await db.platforms.update(platform.id, { last_closed_sunday: lastSundayStr })
          continue
        }

        const closingBalance = platformPocket.balance

        if (closingBalance > 0) {
          // Re-query after dedup — at most one pending event remains
          const existing = await db.scheduled_events
            .where('user_id').equals(userId)
            .filter(e => e.type === 'platform_payout' && e.reference_id === platform.id && e.status === 'pending')
            .first()

          if (existing) {
            await db.scheduled_events.update(existing.id, {
              amount: existing.amount + closingBalance,
              due_date: correctDueDate,
            })
          } else {
            await db.scheduled_events.add({
              id: crypto.randomUUID(),
              user_id: userId,
              type: 'platform_payout',
              reference_id: platform.id,
              reference_type: 'platform',
              amount: closingBalance,
              due_date: correctDueDate,
              status: 'pending',
              actual_pocket_id: null,
              partial_amount: null,
              remaining_after_partial: null,
              created_at: new Date().toISOString()
            })
          }

          // Reset platform balance — the closed amount is now "owed" via the event
          await db.pockets.update(platformPocket.id, { balance: 0 })
        }
        // closingBalance <= 0: debt remains on platform pocket, no payout event

        await db.platforms.update(platform.id, { last_closed_sunday: lastSundayStr })
      }
    }

    closePastWeeks()
  }, [userId])
}

/**
 * Returns the most recent Sunday whose week has fully ended.
 *  - If today is Sunday, the week is still in progress; last *closed* Sunday is 7 days ago.
 *  - If today is Mon-Sat, last closed Sunday is the most recent past Sunday.
 */
function mostRecentSunday(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dow = d.getDay() // 0=Sun
  const daysBack = dow === 0 ? 7 : dow
  d.setDate(d.getDate() - daysBack)
  return d
}

/** Returns the next occurrence of dayOfWeek (0=Sun..6=Sat) strictly after fromDate. */
function nextOccurrenceAfter(fromDate: Date, dayOfWeek: number): Date {
  const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  const fromDow = d.getDay()
  let diff = (dayOfWeek - fromDow + 7) % 7
  if (diff === 0) diff = 7
  d.setDate(d.getDate() + diff)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
