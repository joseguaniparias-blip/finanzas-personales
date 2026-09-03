import { describe, it, expect, afterEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangeFilter, buildPreset, type DateRange } from '@/components/shared/DateRangeFilter'

/** Miércoles 2 de septiembre de 2026 → semana lun 31 ago – dom 6 sep. */
function freezeToday() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 8, 2, 12, 0, 0))
}

afterEach(() => {
  vi.useRealTimers()
})

function Harness() {
  const [range, setRange] = useState<DateRange>(() => buildPreset('this_month'))
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
