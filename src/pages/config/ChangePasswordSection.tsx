import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { NewPasswordForm } from '@/components/auth/NewPasswordForm'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/authErrors'

interface Props {
  onBack: () => void
}

/**
 * "Cambiar contraseña" for a user who is already signed in.
 *
 * Worth having on its own: it rides the existing session, so it sends no email
 * and never touches the project's send quota — unlike the recovery flow, which
 * does. Someone who simply wants a new password should not have to sign out and
 * wait for a link.
 */
export function ChangePasswordSection({ onBack }: Props) {
  const [done, setDone] = useState(false)

  const handleSubmit = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(authErrorMessage(error))
    setDone(true)
  }

  return (
    <div className="p-4">
      <PageHeader title="Cambiar contraseña" />

      {done ? (
        <div className="mt-4">
          <p role="status" className="text-accent text-sm bg-slate-800 border border-accent/40 rounded-xl p-4">
            Listo, tu contraseña quedó cambiada. Úsala la próxima vez que entres.
          </p>
          <button
            onClick={onBack}
            className="w-full mt-4 bg-accent hover:bg-accent-strong text-on-accent font-semibold py-3 rounded-xl transition-colors"
          >
            Volver a Configuración
          </button>
        </div>
      ) : (
        <div className="mt-4 bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <p className="text-slate-400 text-sm mb-5">
            Elige una contraseña nueva. La sesión de este dispositivo sigue abierta.
          </p>
          <NewPasswordForm onSubmit={handleSubmit} submitLabel="Guardar contraseña" />

          <button
            onClick={onBack}
            className="w-full mt-3 text-slate-400 hover:text-slate-200 text-sm py-2 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
