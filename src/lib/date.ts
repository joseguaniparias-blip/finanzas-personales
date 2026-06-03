// Local-date helpers. Never use `toISOString().slice(0,10)` for "today"
// in this app — it returns UTC, which rolls to the next day at 7pm
// Colombia time (UTC-5) and breaks the agenda / forms.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

// ─── Week / month range helpers (semana Lun → Dom, mes 1 → último) ──────────

/** Monday of the ISO date's week. Week starts on MONDAY. */
export function startOfWeekISO(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const dow = d.getDay()            // 0 = Sun, 1 = Mon, … 6 = Sat
  const offset = dow === 0 ? -6 : 1 - dow   // distance back to Monday
  d.setDate(d.getDate() + offset)
  return toISODate(d)
}

/** Sunday of the ISO date's week (six days after Monday). */
export function endOfWeekISO(iso: string): string {
  return addDaysISO(startOfWeekISO(iso), 6)
}

/** First day of the ISO date's calendar month. */
export function startOfMonthISO(iso: string): string {
  const [y, m] = iso.split('-')
  return `${y}-${m}-01`
}

/** Last day of the ISO date's calendar month. */
export function endOfMonthISO(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  // Day 0 of next month = last day of current month, in local time.
  return toISODate(new Date(y, m, 0))
}

/** ISO date `months` months before `iso`, clamped to last day if shorter. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + months, d)
  // If target month is shorter, JS rolls forward — clamp.
  if (target.getDate() !== d) target.setDate(0)
  return toISODate(target)
}
