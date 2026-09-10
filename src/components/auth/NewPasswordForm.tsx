import { useId, useState } from 'react'
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/password'

interface Props {
  /** Saves the password. Reject with a user-ready message to show an error. */
  onSubmit: (password: string) => Promise<void>
  submitLabel: string
  /** Shown while the save is in flight. */
  submitRunningLabel?: string
}

const FIELD =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm ' +
  'text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent'

/**
 * The two password boxes, shared by the recovery screen and by "Cambiar
 * contraseña" in Configuración. One component so the two can never drift into
 * disagreeing about what a valid password is.
 *
 * Validation runs here before `onSubmit` — a mismatch is not worth a round trip,
 * and Supabase would answer it in English anyway.
 */
export function NewPasswordForm({ onSubmit, submitLabel, submitRunningLabel = 'Guardando…' }: Props) {
  const passwordId = useId()
  const confirmationId = useId()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateNewPassword(password, confirmation)
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSubmit(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={passwordId} className="text-xs text-slate-400 mb-1 block">
          CONTRASEÑA NUEVA
        </label>
        <input
          id={passwordId}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
          autoComplete="new-password"
          required
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor={confirmationId} className="text-xs text-slate-400 mb-1 block">
          REPITE LA CONTRASEÑA
        </label>
        <input
          id={confirmationId}
          type="password"
          value={confirmation}
          onChange={e => setConfirmation(e.target.value)}
          placeholder="La misma de arriba"
          autoComplete="new-password"
          required
          className={FIELD}
        />
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg p-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent hover:bg-accent-strong disabled:opacity-50 text-on-accent font-semibold py-3 rounded-xl transition-colors"
      >
        {saving ? submitRunningLabel : submitLabel}
      </button>
    </form>
  )
}
