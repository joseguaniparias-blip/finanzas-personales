import { useEffect, useState } from 'react'

/**
 * Returns the current local date as 'YYYY-MM-DD' and re-renders the component
 * exactly when local midnight passes.
 *
 * Why: components that compute "Hoy" off `new Date().toISOString().slice(0,10)`
 * only capture the date at render time. If the app stays open across midnight
 * (user leaves it idle on the phone), the agenda's "Hoy" stays stuck on the
 * old date until something else triggers a re-render. With this hook the
 * component automatically updates.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => isoDate(new Date()))

  useEffect(() => {
    function scheduleNextTick() {
      const now = new Date()
      // Midnight = 00:00:00.000 of tomorrow in local time
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 0
      )
      const msUntilMidnight = nextMidnight.getTime() - now.getTime() + 50 // small buffer
      return window.setTimeout(() => {
        setToday(isoDate(new Date()))
        timer = scheduleNextTick()
      }, msUntilMidnight)
    }
    let timer = scheduleNextTick()
    return () => clearTimeout(timer)
  }, [])

  return today
}

function isoDate(d: Date): string {
  // Local-date-only, NOT toISOString (which is UTC and can shift the date for
  // timezones like UTC-5 right after midnight).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
