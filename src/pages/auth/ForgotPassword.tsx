import { useId, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/authErrors'

interface Props {
  onBack: () => void
}

/**
 * "Olvidé mi contraseña": takes an address and asks Supabase to mail a recovery
 * link.
 *
 * The confirmation is deliberately vague — "si hay una cuenta con ese correo".
 * Confirming that an address is registered would turn this box into a way to
 * enumerate the users of the app. Supabase already answers 200 for an unknown
 * address; saying more here would undo that.
 *
 * The one error worth showing is the send quota, because waiting actually fixes
 * it and the alternative is a user retrying into an empty tank.
 */
export function ForgotPassword({ onBack }: Props) {
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Supabase appends the recovery tokens to this URL. The app picks them up
      // on load and fires PASSWORD_RECOVERY. This origin must be listed under
      // Authentication → URL Configuration → Redirect URLs, or the link dies.
      redirectTo: typeof window === 'undefined' ? undefined : window.location.origin,
    })
    if (error) setError(authErrorMessage(error))
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-2xl font-bold text-slate-100">Recuperar contraseña</h1>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          {sent ? (
            <>
              <p role="status" className="text-accent text-xs bg-slate-800 border border-accent/40 rounded-lg p-3">
                Si hay una cuenta con ese correo, te llegará un enlace para poner una
                contraseña nueva. Revisa también la carpeta de spam.
              </p>
              <button
                onClick={onBack}
                className="w-full mt-5 bg-accent hover:bg-accent-strong text-on-accent font-semibold py-3 rounded-xl transition-colors"
              >
                Volver a ingresar
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-400 text-sm mb-5">
                Escribe tu correo y te mandamos un enlace para poner una contraseña nueva.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor={emailId} className="text-xs text-slate-400 mb-1 block">CORREO</label>
                  <input
                    id={emailId}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    autoComplete="email"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg p-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent-strong disabled:opacity-50 text-on-accent font-semibold py-3 rounded-xl transition-colors"
                >
                  {loading ? 'Enviando…' : 'Enviar enlace'}
                </button>
              </form>

              <div className="mt-5 text-center text-sm">
                <button onClick={onBack} className="text-blue-400 hover:text-blue-300 font-medium">
                  Volver a ingresar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
