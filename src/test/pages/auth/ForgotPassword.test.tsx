import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const resetPasswordForEmail = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a) } }
}))

const { ForgotPassword } = await import('@/pages/auth/ForgotPassword')

beforeEach(() => resetPasswordForEmail.mockReset())

async function submit(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/correo/i), email)
  await user.click(screen.getByRole('button', { name: /enviar/i }))
}

describe('ForgotPassword', () => {
  it('sends the recovery email and confirms', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })
    render(<ForgotPassword onBack={vi.fn()} />)
    await submit('a@b.co')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', expect.anything())
    expect(await screen.findByRole('status')).toHaveTextContent(/enlace/i)
  })

  it('says exactly the same thing when the address has no account', async () => {
    // Anything else turns this box into a detector of which emails are
    // registered. Supabase already answers 200 for an unknown address; the UI
    // must not undo that.
    resetPasswordForEmail.mockResolvedValue({ error: null })
    render(<ForgotPassword onBack={vi.fn()} />)
    await submit('nadie@ejemplo.com')
    const unknown = (await screen.findByRole('status')).textContent

    expect(unknown).toMatch(/si hay una cuenta/i)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('surfaces the email quota, which the user can actually act on', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'email rate limit exceeded' } })
    render(<ForgotPassword onBack={vi.fn()} />)
    await submit('a@b.co')

    const alert = await screen.findByRole('alert')
    expect(alert).not.toHaveTextContent(/rate limit/i)
    expect(alert).toHaveTextContent(/unos minutos|espera/i)
  })

  it('goes back to the sign-in screen', async () => {
    const onBack = vi.fn()
    render(<ForgotPassword onBack={onBack} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /volver|ingresar/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
