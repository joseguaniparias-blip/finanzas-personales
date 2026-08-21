import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const resetAllData = vi.fn().mockResolvedValue(undefined)
const deleteAccount = vi.fn().mockResolvedValue(undefined)
const downloadExport = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/wipe', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wipe')>('@/lib/wipe')
  return {
    ...actual,
    resetAllData: (...a: unknown[]) => resetAllData(...a),
    deleteAccount: (...a: unknown[]) => deleteAccount(...a),
    countUserData: vi.fn().mockResolvedValue({ transactions: 412, pockets: 1, debts: 0 }),
  }
})
vi.mock('@/lib/exportData', () => ({ downloadExport: () => downloadExport() }))

const { DangerConfirm } = await import('@/pages/config/DangerZone')

beforeEach(() => {
  resetAllData.mockClear(); deleteAccount.mockClear(); downloadExport.mockClear()
})

function renderConfirm(mode: 'reset' | 'delete_account' = 'reset') {
  const onDone = vi.fn()
  render(
    <MemoryRouter>
      <DangerConfirm userId="user-1" mode={mode} onBack={vi.fn()} onDone={onDone} />
    </MemoryRouter>
  )
  return { onDone }
}

describe('DangerConfirm', () => {
  it('names the real damage instead of a generic warning', async () => {
    renderConfirm()
    await waitFor(() => {
      expect(screen.getByText(/412 movimientos/)).toBeInTheDocument()
    })
    // zero-count entities are not listed
    expect(screen.queryByText(/0 deudas/)).not.toBeInTheDocument()
    // singular is respected
    expect(screen.getByText(/1 bolsillo(?!s)/)).toBeInTheDocument()
  })

  it('keeps the red button disabled until BORRAR is typed exactly', async () => {
    const user = userEvent.setup()
    renderConfirm()
    const button = screen.getByRole('button', { name: /empezar de cero/i })
    expect(button).toBeDisabled()

    const input = screen.getByLabelText(/escribe borrar/i)
    await user.type(input, 'borra')
    expect(button).toBeDisabled()

    await user.type(input, 'r')
    expect(button).toBeEnabled()
  })

  it('runs the reset once armed', async () => {
    const user = userEvent.setup()
    const { onDone } = renderConfirm()
    await user.type(screen.getByLabelText(/escribe borrar/i), 'BORRAR')
    await user.click(screen.getByRole('button', { name: /empezar de cero/i }))
    await waitFor(() => expect(resetAllData).toHaveBeenCalledWith('user-1', expect.anything()))
    expect(deleteAccount).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('runs account deletion in delete_account mode', async () => {
    const user = userEvent.setup()
    renderConfirm('delete_account')
    await user.type(screen.getByLabelText(/escribe borrar/i), 'BORRAR')
    await user.click(screen.getByRole('button', { name: /eliminar mi cuenta para siempre/i }))
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('user-1', expect.anything()))
    expect(resetAllData).not.toHaveBeenCalled()
  })

  it('offers a backup before destroying anything', async () => {
    const user = userEvent.setup()
    renderConfirm()
    await user.click(screen.getByRole('button', { name: /descargar mis datos/i }))
    await waitFor(() => expect(downloadExport).toHaveBeenCalled())
  })

  it('says nothing was deleted locally when the wipe fails', async () => {
    resetAllData.mockRejectedValueOnce(new Error('No se pudo borrar "transactions" en la nube: boom'))
    const user = userEvent.setup()
    const { onDone } = renderConfirm()
    await user.type(screen.getByLabelText(/escribe borrar/i), 'BORRAR')
    await user.click(screen.getByRole('button', { name: /empezar de cero/i }))

    await waitFor(() => {
      expect(screen.getByText(/No se borró nada en este dispositivo/i)).toBeInTheDocument()
    })
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeEnabled()
  })

  it('blocks the wipe while offline', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const user = userEvent.setup()
    renderConfirm()
    await user.type(screen.getByLabelText(/escribe borrar/i), 'BORRAR')
    expect(screen.getByRole('button', { name: /empezar de cero/i })).toBeDisabled()
    expect(screen.getByText(/Necesitas conexión/i)).toBeInTheDocument()
    spy.mockRestore()
  })
})
