import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

function Boom(): React.ReactElement {
  throw new Error('kaboom')
}

afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renders children normally when there is no error', () => {
    render(<ErrorBoundary><p>contenido ok</p></ErrorBoundary>)
    expect(screen.getByText('contenido ok')).toBeInTheDocument()
  })

  it('shows the recovery screen when a child throws in render', () => {
    // React logs the caught error to console.error; silence the expected noise.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    expect(screen.getByText(/Recargar app/i)).toBeInTheDocument()
    // the failing child is not rendered
    expect(screen.queryByText('kaboom')).not.toBeNull() // surfaced only inside the technical detail
  })
})
