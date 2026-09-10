import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn()
    },
    from: vi.fn()
  }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = (supabase as any).auth
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (supabase as any).from

/** A `from('user_profiles').insert(...)` chain that resolves to `result`. */
function mockInsert(result: { error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result)
  from.mockReturnValue({ insert })
  return insert
}

const NEW_USER = { id: 'u1', identities: [{ id: 'i1' }] }
const SESSION = { access_token: 't' }

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.getSession.mockResolvedValue({ data: { session: null } })
    auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    mockInsert({ error: null })
  })

  it('initializes with loading true then false', async () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    await act(async () => {})
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('exposes signIn, signUp, signOut functions', () => {
    const { result } = renderHook(() => useAuth())
    expect(typeof result.current.signIn).toBe('function')
    expect(typeof result.current.signUp).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
  })

  describe('signUp', () => {
    it('creates the profile and reports no confirmation needed when a session comes back', async () => {
      auth.signUp.mockResolvedValue({ data: { user: NEW_USER, session: SESSION }, error: null })
      const insert = mockInsert({ error: null })
      const { result } = renderHook(() => useAuth())
      await act(async () => {})

      let out!: Awaited<ReturnType<typeof result.current.signUp>>
      await act(async () => { out = await result.current.signUp('a@b.co', 'secreto', 'Ana') })

      expect(out.error).toBeNull()
      expect(out.needsConfirmation).toBe(false)
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', name: 'Ana' }))
    })

    it('reports a taken email even when Supabase hides it behind a fake user', async () => {
      // With "Confirm email" on, GoTrue answers an existing address with a
      // 200 and an obfuscated user (no identities) so it leaks nothing. Read
      // literally, that looks like success and the form goes silent.
      auth.signUp.mockResolvedValue({
        data: { user: { id: 'fake', identities: [] }, session: null },
        error: null,
      })
      const { result } = renderHook(() => useAuth())
      await act(async () => {})

      let out!: Awaited<ReturnType<typeof result.current.signUp>>
      await act(async () => { out = await result.current.signUp('a@b.co', 'secreto', 'Ana') })

      expect(out.error).not.toBeNull()
      expect(out.error!.message).toMatch(/ya (existe|tienes)/i)
    })

    it('asks the user to check their inbox when confirmation is required', async () => {
      auth.signUp.mockResolvedValue({
        data: { user: NEW_USER, session: null },
        error: null,
      })
      const { result } = renderHook(() => useAuth())
      await act(async () => {})

      let out!: Awaited<ReturnType<typeof result.current.signUp>>
      await act(async () => { out = await result.current.signUp('a@b.co', 'secreto', 'Ana') })

      expect(out.error).toBeNull()
      expect(out.needsConfirmation).toBe(true)
    })

    it('translates the error instead of passing Supabase English through', async () => {
      auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'email rate limit exceeded' },
      })
      const { result } = renderHook(() => useAuth())
      await act(async () => {})

      let out!: Awaited<ReturnType<typeof result.current.signUp>>
      await act(async () => { out = await result.current.signUp('a@b.co', 'secreto', 'Ana') })

      expect(out.error!.message).not.toContain('rate limit')
      expect(out.error!.message).toMatch(/correo/i)
    })

    it('does not fail the signup when the profile insert is rejected', async () => {
      // Without a session the insert hits RLS. Onboarding upserts the profile
      // anyway, so this must not block a valid registration.
      auth.signUp.mockResolvedValue({ data: { user: NEW_USER, session: null }, error: null })
      mockInsert({ error: { message: 'new row violates row-level security policy' } })
      const { result } = renderHook(() => useAuth())
      await act(async () => {})

      let out!: Awaited<ReturnType<typeof result.current.signUp>>
      await act(async () => { out = await result.current.signUp('a@b.co', 'secreto', 'Ana') })

      expect(out.error).toBeNull()
    })
  })

  describe('signIn', () => {
    it('translates a wrong password', async () => {
      auth.signInWithPassword.mockResolvedValue({
        data: {}, error: { message: 'Invalid login credentials' },
      })
      const { result } = renderHook(() => useAuth())
      await act(async () => {})

      let out!: Awaited<ReturnType<typeof result.current.signIn>>
      await act(async () => { out = await result.current.signIn('a@b.co', 'mala') })

      expect(out.error!.message).toMatch(/correo o contraseña/i)
    })
  })
})
