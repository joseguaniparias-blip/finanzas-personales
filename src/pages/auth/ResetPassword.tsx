import { NewPasswordForm } from '@/components/auth/NewPasswordForm'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/authErrors'

interface Props {
  /** Called once the password is saved, to hand the user back to the app. */
  onDone: () => void
}

/**
 * The screen a recovery link lands on.
 *
 * By the time this renders the user already holds a real session — Supabase
 * turns the link into one. That is exactly why `AppRoutes` has to check
 * `recovering` before anything else: left alone, the app would read that
 * session as an ordinary sign-in and drop the user into their dashboard with
 * the forgotten password still in place.
 */
export function ResetPassword({ onDone }: Props) {
  const handleSubmit = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(authErrorMessage(error))
    onDone()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-2xl font-bold text-slate-100">Nueva contraseña</h1>
          <p className="text-slate-400 text-sm mt-1">Elige una contraseña para tu cuenta</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <NewPasswordForm onSubmit={handleSubmit} submitLabel="Guardar contraseña" />
        </div>
      </div>
    </div>
  )
}
