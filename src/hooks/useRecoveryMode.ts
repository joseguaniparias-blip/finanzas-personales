import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface RecoveryMode {
  /** True while the user is here from a password-recovery link. */
  recovering: boolean
  /** Call once the new password is saved — or if the user backs out. */
  endRecovery: () => void
}

/**
 * Answers one question: did this user arrive through a recovery link?
 *
 * Supabase turns a recovery link into a real session, so by the time the app
 * renders, the user looks signed in. Without this flag `AppRoutes` would drop
 * them straight into their dashboard and the password screen would never
 * appear — they would still be locked out, just further in.
 *
 * Deliberately separate from `useAuth`, which is instantiated twice (in
 * `AppRoutes` and in `AuthPage`). Recovery is a single global mode; hanging it
 * off a hook with two live instances would make it ambiguous which one decides.
 */
export function useRecoveryMode(): RecoveryMode {
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      // Only ever turn it ON here. `updateUser` fires USER_UPDATED moments
      // after the new password is saved, and the recovery session stays live;
      // re-reading state from events would trap the user on the screen.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  return { recovering, endRecovery: () => setRecovering(false) }
}
