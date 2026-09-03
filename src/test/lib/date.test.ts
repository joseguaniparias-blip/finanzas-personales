import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  startOfWeekISO, endOfWeekISO,
  startOfMonthISO, endOfMonthISO,
  weekdayName, monthName, formatRangeLabel,
} from '@/lib/date'

/** Congela "hoy" para que la elisión del año sea determinista. */
function freezeYear(y: number) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(y, 6, 15, 12, 0, 0))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('weekdayName / monthName', () => {
  it('nombra el día en español, sin desfase de zona horaria', () => {
    expect(weekdayName('2026-07-31')).toBe('viernes')
    expect(weekdayName('2026-08-02')).toBe('domingo')
    expect(monthName('2026-07-31')).toBe('julio')
    expect(monthName('2026-12-01')).toBe('diciembre')
  })
})

describe('formatRangeLabel — un solo día', () => {
  it('muestra día de la semana + fecha', () => {
    freezeYear(2026)
    expect(formatRangeLabel('2026-09-02', '2026-09-02')).toBe('Miércoles 2 de septiembre')
  })

  it('agrega el año cuando no es el año en curso', () => {
    freezeYear(2026)
    expect(formatRangeLabel('2025-01-06', '2025-01-06')).toBe('Lunes 6 de enero de 2025')
  })
})

describe('formatRangeLabel — semana', () => {
  it('muestra lunes → domingo aunque cruce de mes', () => {
    freezeYear(2023)
    // 2023-07-31 fue lunes; su semana cierra el domingo 6 de agosto.
    const from = startOfWeekISO('2023-08-02')
    const to = endOfWeekISO('2023-08-02')
    expect(from).toBe('2023-07-31')
    expect(to).toBe('2023-08-06')
    expect(formatRangeLabel(from, to)).toBe('Lunes 31 de julio → Domingo 6 de agosto')
  })

  it('repite el año en ambos extremos cuando el rango cruza de año', () => {
    freezeYear(2026)
    expect(formatRangeLabel('2025-12-29', '2026-01-04'))
      .toBe('Lunes 29 de diciembre de 2025 → Domingo 4 de enero de 2026')
  })
})

describe('formatRangeLabel — mes completo', () => {
  it('omite los días de la semana y muestra el tramo del mes', () => {
    freezeYear(2026)
    const from = startOfMonthISO('2026-09-15')
    const to = endOfMonthISO('2026-09-15')
    expect(formatRangeLabel(from, to)).toBe('1 – 30 de septiembre')
  })

  it('febrero bisiesto llega hasta el 29', () => {
    freezeYear(2024)
    expect(formatRangeLabel('2024-02-01', '2024-02-29')).toBe('1 – 29 de febrero')
  })

  it('agrega el año en meses de años anteriores', () => {
    freezeYear(2026)
    expect(formatRangeLabel('2025-11-01', '2025-11-30')).toBe('1 – 30 de noviembre de 2025')
  })
})

describe('formatRangeLabel — rango libre', () => {
  it('un rango parcial dentro de un mes conserva los días de la semana', () => {
    freezeYear(2026)
    expect(formatRangeLabel('2026-09-01', '2026-09-10'))
      .toBe('Martes 1 de septiembre → Jueves 10 de septiembre')
  })
})
