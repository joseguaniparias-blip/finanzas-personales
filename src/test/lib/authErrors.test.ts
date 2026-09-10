import { describe, it, expect } from 'vitest'
import { authErrorMessage } from '@/lib/authErrors'

describe('authErrorMessage', () => {
  it('explains the Supabase email quota instead of showing it raw', () => {
    const msg = authErrorMessage({ message: 'email rate limit exceeded' })
    expect(msg).not.toContain('rate limit')
    expect(msg).toMatch(/correo/i)
    // The user needs to know that waiting fixes it — otherwise they retry in a
    // loop and burn what little quota is left.
    expect(msg).toMatch(/unos minutos|más tarde|espera/i)
  })

  it('tells a returning user to sign in instead of registering', () => {
    expect(authErrorMessage({ message: 'User already registered' }))
      .toMatch(/ya (existe|tienes)/i)
    expect(authErrorMessage({ code: 'user_already_exists', message: 'whatever' }))
      .toMatch(/ya (existe|tienes)/i)
  })

  it('translates a wrong password', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' }))
      .toMatch(/correo o contraseña/i)
  })

  it('surfaces the wait in the security cooldown', () => {
    const msg = authErrorMessage({
      message: 'For security purposes, you can only request this after 51 seconds.',
    })
    expect(msg).toContain('51')
  })

  it('names a short password', () => {
    expect(authErrorMessage({ message: 'Password should be at least 6 characters' }))
      .toMatch(/6/)
  })

  it('reads a network failure as a connectivity problem', () => {
    expect(authErrorMessage({ message: 'Failed to fetch' }))
      .toMatch(/conexión|internet/i)
  })

  it('falls back to the original text rather than swallowing it', () => {
    expect(authErrorMessage({ message: 'algo rarísimo pasó' }))
      .toBe('algo rarísimo pasó')
  })

  it('never returns an empty string', () => {
    expect(authErrorMessage({ message: '' })).toBeTruthy()
    expect(authErrorMessage(null)).toBeTruthy()
  })
})
