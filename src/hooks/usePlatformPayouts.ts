import { useEffect } from 'react'
import { db } from '@/lib/db'
import { toISODate } from '@/lib/date'

/**
 * Weekly close logic for platform wallets.
 *
 * Work week is Monday â†’ Sunday. The platform balance accumulates work done
 * during the week. At end of Sunday it "closes":
 *  - The closing balance is computed from TRANSACTIONS dated Mon-Sun of the
 *    closed week (NOT the current pocket balance, which may already include
 *    income from the new week if the user opens the app late).
 *  - positive closing â†’ snapshot into a payout scheduled_event due on the
 *    configured payout_day; pocket balance reduced by that amount (not zeroed,
 *    so any newer-week earnings are preserved).
 *  - non-positive    â†’ no payout event; pocket untouched.
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

      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

      for (const platform of platforms) {
        if (platform.payout_day === null) continue

        // â”€â”€ First install / new platform: set the baseline, don't close retroactively â”€â”€
        // The current pocket balance is treated as "this week's accumulation"
        // and will be closed at the END of the current week.
        if (!platform.last_closed_sunday) {
          await db.platforms.update(platform.id, { last_closed_sunday: lastSundayStr })
          continue
        }

        // â”€â”€ Stale marker check â”€â”€
        // If last_closed_sunday is more than 7 days behind the most recent Sunday,
        // the marker is stale (data restored, long absence, version upgrade).
        // Don't retroactively close â€” just refresh the baseline.
        const lastCloseDate = new Date(platform.last_closed_sunday + 'T00:00:00')
        const daysGap = Math.round((lastSunday.getTime() - lastCloseDate.getTime()) / 86400000)
        if (daysGap > 7) {
          await db.platforms.update(platform.id, { last_closed_sunday: lastSundayStr })
          continue
        }

        // â”€â”€ Step 1: Clean up pending events (merge duplicates, delete invalid) â”€â”€
        // Don't touch the due_date â€” let the user delete stale ones manually with
        // the "Eliminar este pendiente" button.
        const allPending = await db.scheduled_events
          .where('user_id').equals(userId)
          .filter(e => e.type === 'platform_payout' && e.reference_id === platform.id && e.status === 'pending')
          .toArray()

        for (const ev of allPending.filter(e => e.amount <= 0)) {
          await db.scheduled_events.delete(ev.id)
        }
        const validPending = allPending.filter(e => e.amount > 0)
        if (validPending.length > 1) {
          // Merge: sum amounts into the first event (keep its due_date), delete the rest
          const totalAmount = validPending.reduce((s, e) => s + e.amount, 0)
          await db.scheduled_events.update(validPending[0].id, { amount: totalAmount })
          for (let i = 1; i < validPending.length; i++) {
            await db.scheduled_events.delete(validPending[i].id)
          }
        }

        // â”€â”€ Step 2: Close this week if not already done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // â”€â”€ Compute closing balance from TRANSACTIONS in the closed week â”€â”€
        // (Mon â†’ Sun, inclusive). This is the correct closing snapshot even if
        // the user opens the app days later, by which point the pocket balance
        // already includes new-week earnings.
        const closeWeekStart = isoDate(addDays(lastSunday, -6))  // Monday
        const closeWeekEnd = lastSundayStr                       // Sunday
        const closeWeekTxs = await db.transactions
          .where('pocket_id').equals(platformPocket.id)
          .filter(t => t.date >= closeWeekStart && t.date <= closeWeekEnd)
          .toArray()
        const closingBalance = closeWeekTxs.reduce(
          (s, t) => s + (t.type === 'income' ? t.amount : -t.amount),
          0
        )

        // Date of the upcoming payout: next occurrence of payout_day AFTER the
        // closed Sunday â€” and ALWAYS in the future. If the natural next
        // occurrence is in the past (close ran late), advance by weeks.
        const payoutDate = nextOccurrenceAfter(lastSunday, platform.payout_day)
        while (payoutDate < todayDateOnly) {
          payoutDate.setDate(payoutDate.getDate() + 7)
        }
        const correctDueDate = isoDate(payoutDate)

        if (closingBalance > 0) {
          // Re-query after dedup â€” at most one pending event remains
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

          // Subtract the closed amount from the pocket (preserves new-week earnings)
          await db.pockets.update(platformPocket.id, {
            balance: platformPocket.balance - closingBalance
          })
        }
        // closingBalance <= 0: no payout event, pocket untouched

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
  return toISODate(d)
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + days)
  return r
}
