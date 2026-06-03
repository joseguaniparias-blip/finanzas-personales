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
