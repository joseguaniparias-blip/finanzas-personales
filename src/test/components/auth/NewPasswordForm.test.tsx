import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewPasswordForm } from '@/components/auth/NewPasswordForm'

const onSubmit = vi.fn()

beforeEach(() => { onSubmit.mockReset(); onSubmit.mockResolvedValue(undefined) })

/** Fills both boxes and presses the button. */
async function fill(password: string, confirmation: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/contraseña nueva/i), password)
  await user.type(screen.getByLabelText(/repite/i), confirmation)
  await user.click(screen.getByRole('button', { name: /guardar/i }))
}

describe('NewPasswordForm', () => {
  it('submits the password when both boxes agree', async () => {
    render(<NewPasswordForm onSubmit={onSubmit} submitLabel="Guardar contraseña" />)
    await fill('secreto123', 'secreto123')
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('secreto123'))
  })

  it('refuses a mismatch without calling the server', async () => {
    render(<NewPasswordForm onSubmit={onSubmit} submitLabel="Guardar contraseña" />)
    await fill('secreto123', 'secreto124')
    expect(await screen.findByRole('alert')).toHaveTextContent(/no coinciden/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('refuses a short password without calling the server', async () => {
    render(<NewPasswordForm onSubmit={onSubmit} submitLabel="Guardar contraseña" />)
    await fill('abc', 'abc')
    expect(await screen.findByRole('alert')).toHaveTextContent(/6/)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows what the server said when saving fails', async () => {
    onSubmit.mockRejectedValue(new Error('La contraseña nueva debe ser distinta a la actual.'))
    render(<NewPasswordForm onSubmit={onSubmit} submitLabel="Guardar contraseña" />)
    await fill('secreto123', 'secreto123')
    expect(await screen.findByRole('alert')).toHaveTextContent(/distinta a la actual/i)
  })

  it('lets the user fix a rejected password and try again', async () => {
    render(<NewPasswordForm onSubmit={onSubmit} submitLabel="Guardar contraseña" />)
    await fill('abc', 'abc')
    expect(onSubmit).not.toHaveBeenCalled()

    const user = userEvent.setup()
    await user.clear(screen.getByLabelText(/contraseña nueva/i))
    await user.clear(screen.getByLabelText(/repite/i))
    await user.type(screen.getByLabelText(/contraseña nueva/i), 'secreto123')
    await user.type(screen.getByLabelText(/repite/i), 'secreto123')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('secreto123'))
  })
})
