import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * The one behaviour worth an App-level test: a recovery link must win over
 * every other rendering decision.
 *
 * Supabase turns the link into a real session, so `user` is set and `loading`
 * has settled by the time this renders. If the recovery check ever slips below
 * the loading guard, the onboarding guard, or the routes, the user lands in
 * their dashboard and never sees the password screen — locked out again on the
 * next launch, with no way back in.
 */

const recovering = { value: false }
const endRecovery = vi.fn()

vi.mock('@/hooks/useRecoveryMode', () => ({
  useRecoveryMode: () => ({ recovering: recovering.value, endRecovery }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    loading: true,          // still loading…
    signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
  }),
}))

vi.mock('@/pages/auth/ResetPassword', () => ({
  ResetPassword: () => <div>PANTALLA DE CONTRASEÑA NUEVA</div>,
}))

// Everything below only needs to not explode while the guard is evaluated.
vi.mock('@/lib/sync', () => ({
  setupSyncHooks: vi.fn(), pullFromSupabase: vi.fn().mockResolvedValue(undefined),
  flushSyncQueue: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/wipe', () => ({ checkRemoteWipe: vi.fn().mockResolvedValue(false) }))
vi.mock('@/hooks/usePlatformPayouts', () => ({ usePlatformPayouts: vi.fn() }))
vi.mock('@/hooks/useOrphanCleanup', () => ({ useOrphanCleanup: vi.fn() }))
// The onboarding effect queries the profile regardless of the guard, so the
// chain has to resolve rather than blow up in an unhandled rejection.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
    auth: {},
  },
}))
vi.mock('@/lib/db', () => ({ db: { user_profiles: { get: vi.fn().mockResolvedValue(null) } } }))

const App = (await import('@/App')).default

beforeEach(() => { recovering.value = false; endRecovery.mockClear() })

describe('recovery guard in App', () => {
  it('shows the password screen even while auth is still loading', async () => {
    recovering.value = true
    render(<App />)
    expect(await screen.findByText('PANTALLA DE CONTRASEÑA NUEVA')).toBeInTheDocument()
    // The loading guard would otherwise have won.
    expect(screen.queryByText(/cargando/i)).toBeNull()
  })

  it('stays out of the way when there is no recovery link', () => {
    recovering.value = false
    render(<App />)
    expect(screen.queryByText('PANTALLA DE CONTRASEÑA NUEVA')).toBeNull()
  })
})
