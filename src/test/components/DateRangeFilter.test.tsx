import { describe, it, expect, afterEach, vi } from 'vitest'
import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangeFilter, buildPreset, type DateRange } from '@/components/shared/DateRangeFilter'

/** Miércoles 2 de septiembre de 2026 → semana lun 31 ago – dom 6 sep. */
function freezeToday(at = new Date(2026, 8, 2, 12, 0, 0)) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(at)
}

afterEach(() => {
  vi.useRealTimers()
})

function Harness({ initial = 'this_month' as Parameters<typeof buildPreset>[0] }) {
  const [range, setRange] = useState<DateRange>(() => buildPreset(initial))
  return <DateRangeFilter value={range} onChange={setRange} />
}

describe('DateRangeFilter — referencia de días', () => {
  it('muestra los días exactos de cada preset, no solo su nombre', async () => {
    freezeToday()
    const user = userEvent.setup()
    render(<Harness />)

    // Arranca en "Este mes"
    expect(screen.getByText('1 – 30 de septiembre')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(screen.getByText('Miércoles 2 de septiembre')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Esta semana' }))
    expect(screen.getByText('Lunes 31 de agosto → Domingo 6 de septiembre')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Semana pasada' }))
    expect(screen.getByText('Lunes 24 de agosto → Domingo 30 de agosto')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mes pasado' }))
    expect(screen.getByText('1 – 31 de agosto')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Últimos 30' }))
    expect(screen.getByText('Martes 4 de agosto → Miércoles 2 de septiembre')).toBeInTheDocument()
  })
})

/** Avanza el reloj falso y deja que React procese los timers de useToday. */
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('DateRangeFilter — cruce de medianoche', () => {
  it('"Hoy" pasa al día nuevo sin que el usuario toque nada', async () => {
    freezeToday(new Date(2026, 8, 2, 23, 59, 50))
    render(<Harness initial="today" />)
    expect(screen.getByText('Miércoles 2 de septiembre')).toBeInTheDocument()

    await advance(20_000) // cruza las 00:00

    expect(screen.getByText('Jueves 3 de septiembre')).toBeInTheDocument()
  })

  it('la semana en curso se recalcula al terminar el domingo', async () => {
    // Domingo 6 de septiembre, 23:59:50 → al pasar a lunes 7 arranca semana nueva.
    freezeToday(new Date(2026, 8, 6, 23, 59, 50))
    render(<Harness initial="this_week" />)
    expect(screen.getByText('Lunes 31 de agosto → Domingo 6 de septiembre')).toBeInTheDocument()

    await advance(20_000)

    expect(screen.getByText('Lunes 7 de septiembre → Domingo 13 de septiembre')).toBeInTheDocument()
  })

  it('un rango personalizado NO se mueve solo', async () => {
    freezeToday(new Date(2026, 8, 2, 23, 59, 50))
    function CustomHarness() {
      const [range, setRange] = useState<DateRange>({
        preset: 'custom', from: '2026-08-10', to: '2026-08-20',
        label: 'Lunes 10 de agosto → Jueves 20 de agosto',
      })
      return <DateRangeFilter value={range} onChange={setRange} />
    }
    render(<CustomHarness />)
    expect(screen.getByText('Lunes 10 de agosto → Jueves 20 de agosto')).toBeInTheDocument()

    await advance(20_000)

    expect(screen.getByText('Lunes 10 de agosto → Jueves 20 de agosto')).toBeInTheDocument()
  })
})
