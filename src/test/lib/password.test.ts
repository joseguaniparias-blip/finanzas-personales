import { describe, it, expect } from 'vitest'
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/password'

describe('validateNewPassword', () => {
  it('accepts a long enough pair that matches', () => {
    expect(validateNewPassword('secreto123', 'secreto123')).toBeNull()
  })

  it('rejects a password shorter than the minimum, naming the number', () => {
    const msg = validateNewPassword('abc', 'abc')
    expect(msg).toContain(String(MIN_PASSWORD_LENGTH))
  })

  it('rejects a mismatch', () => {
    expect(validateNewPassword('secreto123', 'secreto124')).toMatch(/no coinciden/i)
  })

  it('complains about the length before the mismatch', () => {
    // Both are wrong. Telling the user "no coinciden" first would send them to
    // fix the wrong field, and the length error would only appear afterwards.
    expect(validateNewPassword('abc', 'xyz')).toContain(String(MIN_PASSWORD_LENGTH))
  })

  it('rejects an empty confirmation instead of passing it through', () => {
    expect(validateNewPassword('secreto123', '')).toMatch(/no coinciden|repite|confirma/i)
  })

  it('does not trim — a leading space is part of the password', () => {
    expect(validateNewPassword(' secreto123', 'secreto123')).toMatch(/no coinciden/i)
  })
})
