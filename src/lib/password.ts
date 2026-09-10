/**
 * Password rules, shared by the two places a password gets set: the recovery
 * screen and the change-password section in Configuración. Keeping them here
 * means the two screens cannot drift apart.
 */

/** Supabase's own floor. Asking for more here would only reject what it accepts. */
export const MIN_PASSWORD_LENGTH = 6

/**
 * @returns the problem in Spanish, or `null` when the pair is good.
 *
 * Length is checked before the match: when both are wrong, "no coinciden" would
 * send the user to fix the second field when the real problem is the first.
 *
 * Nothing is trimmed. A leading space is a legitimate character in a password,
 * and silently dropping it would let the user save one thing and later type
 * another.
 */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (password !== confirmation) {
    return 'Las contraseñas no coinciden.'
  }
  return null
}
