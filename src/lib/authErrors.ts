/**
 * Supabase auth errors, in Spanish and with a way out.
 *
 * GoTrue answers in English and in its own vocabulary ("email rate limit
 * exceeded"), which lands in front of a repartidor as a dead end: no idea what
 * broke, no idea what to do. Worse, the useless ones invite a retry loop that
 * makes the real problem worse. Every message here names the cause and the next
 * action.
 *
 * Unknown errors fall through unchanged — a strange message the user can read
 * back to us beats a generic "algo salió mal" that hides it.
 */

/** The shape both `AuthError` and a bare `{ message }` satisfy. */
export interface AuthErrorLike {
  message?: string
  code?: string
  status?: number
}

/** `code` is the stable identifier; `message` is prose and can change. */
const BY_CODE: Record<string, string> = {
  user_already_exists:        'Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
  email_exists:               'Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
  over_email_send_rate_limit: 'Se agotaron los correos disponibles por ahora. Espera unos minutos y vuelve a intentarlo.',
  over_request_rate_limit:    'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  invalid_credentials:        'Correo o contraseña incorrectos.',
  email_not_confirmed:        'Tienes que confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.',
  weak_password:              'La contraseña debe tener al menos 6 caracteres.',
  same_password:              'La contraseña nueva debe ser distinta a la actual.',
  validation_failed:          'Revisa que el correo y la contraseña estén bien escritos.',
}

/** Matched against the raw message, in order; first hit wins. */
const BY_MESSAGE: [RegExp, string][] = [
  [/email rate limit exceeded/i,
    'Se agotaron los correos disponibles por ahora. Espera unos minutos y vuelve a intentarlo.'],
  [/rate limit|too many requests/i,
    'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.'],
  [/user already registered|already registered|already exists/i,
    'Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.'],
  [/invalid login credentials/i,
    'Correo o contraseña incorrectos.'],
  [/email not confirmed/i,
    'Tienes que confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.'],
  [/password should be at least (\d+)/i,
    'La contraseña debe tener al menos $1 caracteres.'],
  [/unable to validate email address|invalid format/i,
    'El correo no tiene un formato válido.'],
  [/should be different from the old password|same password/i,
    'La contraseña nueva debe ser distinta a la actual.'],
  [/failed to fetch|network ?error|networkerror|load failed/i,
    'Sin conexión. Revisa tu internet y vuelve a intentarlo.'],
]

/** "…after 51 seconds." — the number is the only useful part, so keep it. */
const COOLDOWN = /you can only request this after (\d+) seconds?/i

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  const raw = error?.message?.trim() ?? ''

  if (error?.code && BY_CODE[error.code]) return BY_CODE[error.code]

  const cooldown = raw.match(COOLDOWN)
  if (cooldown) {
    return `Espera ${cooldown[1]} segundos antes de volver a intentarlo.`
  }

  for (const [pattern, text] of BY_MESSAGE) {
    const hit = raw.match(pattern)
    if (hit) return text.replace('$1', hit[1] ?? '')
  }

  return raw || 'No se pudo completar la operación. Vuelve a intentarlo.'
}
