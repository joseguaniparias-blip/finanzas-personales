import { useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import type { Pocket } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { useSubmitLock } from '@/hooks/useSubmitLock'
import { todayISO } from '@/lib/date'

interface Props {
  pockets: Pocket[]   // should already exclude platform-type pockets
  defaultFromId?: string
  onTransfer: (params: {
    fromPocketId: string; toPocketId: string; amount: number; date: string; note: string | null
  }) => Promise<void>
  onClose: () => void
}

export function TransferSheet({ pockets, defaultFromId, onTransfer, onClose }: Props) {
  const [fromId, setFromId] = useState(defaultFromId ?? pockets[0]?.id ?? '')
  const [toId, setToId] = useState(pockets.find(p => p.id !== (defaultFromId ?? pockets[0]?.id))?.id ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const { submitting, submit } = useSubmitLock()

  const fromPocket = pockets.find(p => p.id === fromId)
  const toPocket   = pockets.find(p => p.id === toId)
  const amountNum  = parseAmount(amount)
  const exceedsBalance = fromPocket ? amountNum > fromPocket.balance : false
  const canTransfer = fromId && toId && fromId !== toId && amountNum > 0 && !exceedsBalance

  const handle = () => {
    if (!canTransfer) return
    submit(async () => {
      await onTransfer({
        fromPocketId: fromId,
        toPocketId: toId,
        amount: amountNum,
        date,
        note: note.trim() || null,
      })
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 px-6 pt-6 pb-8 overflow-y-auto overscroll-contain" style={{ maxHeight: '90dvh' }}>

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-slate-100 font-semibold text-sm">Transferir entre bolsillos</p>
            <p className="text-xs text-slate-400">Sin afectar ingresos ni gastos</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        {/* From */}
        <p className="text-xs text-slate-400 mb-2">Desde</p>
        <div className="space-y-1 mb-4">
          {pockets.map(p => (
            <button key={p.id} onClick={() => { setFromId(p.id); if (toId === p.id) setToId('') }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors border ${fromId === p.id ? 'bg-blue-600/20 border-blue-500 text-slate-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
              <span>{p.icon}</span>
              <span className="flex-1 text-left">{p.name}</span>
              <span className="text-xs text-slate-400">{maskAmount(p.balance, false)}</span>
            </button>
          ))}
        </div>

        {/* Arrow */}
        <div className="flex justify-center mb-3 text-slate-400">
          <ArrowRight size={18} />
        </div>

        {/* To */}
        <p className="text-xs text-slate-400 mb-2">Hacia</p>
        <div className="space-y-1 mb-5">
          {pockets.filter(p => p.id !== fromId).map(p => (
            <button key={p.id} onClick={() => setToId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors border ${toId === p.id ? 'bg-emerald-600/20 border-emerald-500 text-slate-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
              <span>{p.icon}</span>
              <span className="flex-1 text-left">{p.name}</span>
              <span className="text-xs text-slate-400">{maskAmount(p.balance, false)}</span>
            </button>
          ))}
        </div>

        <AmountInput label="Monto" value={amount} onChange={setAmount} className="mb-1" />
        {exceedsBalance && (
          <p className="text-xs text-red-400 mb-3">El monto supera el saldo de {fromPocket?.name}.</p>
        )}

        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1">Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
        </div>

        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-1">Nota (opcional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: para el arriendo"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-400" />
        </div>

        {fromPocket && toPocket && amountNum > 0 && !exceedsBalance && (
          <div className="bg-slate-800 rounded-xl p-3 mb-4 border border-slate-700 text-xs text-slate-400">
            <p>
              <span className="text-slate-300">{fromPocket.icon} {fromPocket.name}</span>: {maskAmount(fromPocket.balance, false)} → <span className="text-red-400">{maskAmount(fromPocket.balance - amountNum, false)}</span>
            </p>
            <p className="mt-1">
              <span className="text-slate-300">{toPocket.icon} {toPocket.name}</span>: {maskAmount(toPocket.balance, false)} → <span className="text-emerald-400">{maskAmount(toPocket.balance + amountNum, false)}</span>
            </p>
          </div>
        )}

        <button onClick={handle} disabled={!canTransfer || submitting}
          className="w-full bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors">
          {submitting ? 'Transfiriendo…' : 'Transferir'}
        </button>
      </div>
    </div>
  )
}
