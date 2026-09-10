import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/authErrors'

export interface SignUpResult {
  error: Error | null
  /**
   * True when Supabase created the account but withheld the session pending an
   * emailed confirmation link. The caller must say so — otherwise the form just
   * sits there and the user assumes the button is broken.
   */
  needsConfirmation: boolean
}

interface AuthHook {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}

/** An error carrying a message already written for the user. */
function userError(message: string): Error {
  return new Error(message)
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? userError(authErrorMessage(error)) : null }
  }

  const signUp = async (email: string, password: string, name: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    })
    if (error) {
      return { error: userError(authErrorMessage(error)), needsConfirmation: false }
    }

    // Supabase does not admit that an address is taken — that would let anyone
    // probe which emails have accounts. It returns 200 with a decoy user whose
    // `identities` array is empty. Taken at face value this reads as success,
    // the form clears its error, and the user is left tapping a button that
    // does nothing. Read the tell and say the true thing.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return {
        error: userError('Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.'),
        needsConfirmation: false,
      }
    }

    const needsConfirmation = Boolean(data.user) && !data.session

    if (data.user) {
      // Best effort. With email confirmation on there is no session yet, so RLS
      // rejects this insert — which is fine: OnboardingFlow upserts the profile
      // once the user is really signed in. Never fail a valid signup over it.
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: data.user.id,
        name,
        onboarding_completed: false,
        balance_hidden: false
      })
      if (profileError) {
        console.warn('[auth] perfil no creado en el registro, se creará en el onboarding:', profileError.message)
      }
    }

    return { error: null, needsConfirmation }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signIn, signUp, signOut }
}
