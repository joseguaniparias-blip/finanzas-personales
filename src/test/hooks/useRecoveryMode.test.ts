import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecoveryMode } from '@/hooks/useRecoveryMode'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
    }
  }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onAuthStateChange = (supabase as any).auth.onAuthStateChange

/** Captures the listener so a test can fire Supabase events at it. */
function captureListener() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fire: (event: string, session: unknown) => void = () => {}
  const unsubscribe = vi.fn()
  onAuthStateChange.mockImplementation((cb: typeof fire) => {
    fire = cb
    return { data: { subscription: { unsubscribe } } }
  })
  return { fire: (e: string, s: unknown = {}) => fire(e, s), unsubscribe }
}

describe('useRecoveryMode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts off', () => {
    captureListener()
    const { result } = renderHook(() => useRecoveryMode())
    expect(result.current.recovering).toBe(false)
  })

  it('turns on when Supabase reports a recovery link', () => {
    const { fire } = captureListener()
    const { result } = renderHook(() => useRecoveryMode())

    act(() => { fire('PASSWORD_RECOVERY') })

    expect(result.current.recovering).toBe(true)
  })

  it('ignores the ordinary sign-in event', () => {
    const { fire } = captureListener()
    const { result } = renderHook(() => useRecoveryMode())

    act(() => { fire('SIGNED_IN') })

    expect(result.current.recovering).toBe(false)
  })

  it('turns off when the flow ends', () => {
    const { fire } = captureListener()
    const { result } = renderHook(() => useRecoveryMode())
    act(() => { fire('PASSWORD_RECOVERY') })

    act(() => { result.current.endRecovery() })

    expect(result.current.recovering).toBe(false)
  })

  it('stays off after ending, even though the recovery session is still live', () => {
    // updateUser fires USER_UPDATED right after the new password is saved. If
    // that re-armed recovery mode the user would be trapped on the screen.
    const { fire } = captureListener()
    const { result } = renderHook(() => useRecoveryMode())
    act(() => { fire('PASSWORD_RECOVERY') })
    act(() => { result.current.endRecovery() })

    act(() => { fire('USER_UPDATED') })

    expect(result.current.recovering).toBe(false)
  })

  it('unsubscribes on unmount', () => {
    const { unsubscribe } = captureListener()
    const { unmount } = renderHook(() => useRecoveryMode())
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
