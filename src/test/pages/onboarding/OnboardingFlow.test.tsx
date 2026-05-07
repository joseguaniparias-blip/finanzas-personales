import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingFlow } from '@/pages/onboarding/OnboardingFlow'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) }
  }
}))

describe('OnboardingFlow', () => {
  it('renders step 1 with name input', () => {
    render(<MemoryRouter><OnboardingFlow userId="u1" onComplete={vi.fn()} /></MemoryRouter>)
    expect(screen.getByPlaceholderText(/tu nombre/i)).toBeInTheDocument()
  })

  it('advances to step 2 after entering name', async () => {
    render(<MemoryRouter><OnboardingFlow userId="u1" onComplete={vi.fn()} /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/tu nombre/i), { target: { value: 'José' } })
    fireEvent.click(screen.getByText(/Siguiente/i))
    await waitFor(() => expect(screen.getByText(/plataformas/i)).toBeInTheDocument())
  })
})
