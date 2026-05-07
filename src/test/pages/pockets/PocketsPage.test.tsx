import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PocketsPage } from '@/pages/pockets/PocketsPage'
import { db } from '@/lib/db'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) } }
}))

beforeEach(async () => { await db.pockets.clear() })

describe('PocketsPage', () => {
  it('shows empty state when no pockets', async () => {
    render(<MemoryRouter><PocketsPage userId="u1" /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/Agrega tu primer bolsillo/i)).toBeInTheDocument())
  })

  it('renders pockets from db', async () => {
    await db.pockets.add({
      id: '1', user_id: 'u1', name: 'Nequi', type: 'bank',
      platform_id: null, balance: 120000, color: '#34d399',
      icon: '🟢', is_active: true, created_at: ''
    })
    render(<MemoryRouter><PocketsPage userId="u1" /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Nequi')).toBeInTheDocument())
  })
})
