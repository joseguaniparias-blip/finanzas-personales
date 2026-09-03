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

// ─── Etiquetas humanas de fecha (es-CO) ────────────────────────────────────
// Escritas a mano en vez de con Intl: el label debe ser idéntico en el móvil,
// en los tests y en cualquier runtime, sin depender de los datos de locale.

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Día de la semana en minúscula: 'lunes', 'domingo'… */
export function weekdayName(iso: string): string {
  return WEEKDAYS[new Date(iso + 'T12:00:00').getDay()]
}

/** Mes en minúscula: 'julio', 'septiembre'… */
export function monthName(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1]
}

function dayNum(iso: string): number {
  return Number(iso.slice(8, 10))
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Etiqueta legible de los días que abarca un rango, para que el usuario vea
 * exactamente qué está contando el filtro:
 *
 *   un día        → 'Miércoles 2 de septiembre'
 *   mes completo  → '1 – 30 de septiembre'
 *   cualquier otro→ 'Lunes 31 de julio → Domingo 6 de agosto'
 *
 * El año se omite cuando el rango cae dentro del año en curso.
 */
export function formatRangeLabel(from: string, to: string): string {
  const fromYear = Number(from.slice(0, 4))
  const toYear = Number(to.slice(0, 4))
  const crossesYears = fromYear !== toYear
  const showYear = crossesYears || toYear !== new Date().getFullYear()

  const long = (iso: string) => `${weekdayName(iso)} ${dayNum(iso)} de ${monthName(iso)}`

  if (from === to) {
    return cap(long(from)) + (showYear ? ` de ${fromYear}` : '')
  }

  // Mes calendario completo: los días de la semana solo estorban.
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  if (sameMonth && from === startOfMonthISO(from) && to === endOfMonthISO(to)) {
    return `${dayNum(from)} – ${dayNum(to)} de ${monthName(from)}` + (showYear ? ` de ${fromYear}` : '')
  }

  const left = cap(long(from)) + (crossesYears ? ` de ${fromYear}` : '')
  const right = cap(long(to)) + (showYear ? ` de ${toYear}` : '')
  return `${left} → ${right}`
}
