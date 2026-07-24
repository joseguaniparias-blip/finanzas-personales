import { useState } from 'react'
import { Pencil, Undo2, AlertTriangle, type LucideIcon } from 'lucide-react'
import type { ScheduledEvent, Pocket } from '@/types'
import { AmountInput, parseAmount } from './AmountInput'
import { maskAmount } from './PrivacyToggle'
import { useSubmitLock } from '@/hooks/useSubmitLock'

export interface EventCorrection {
  amount?: number
  pocketId?: string
  date?: string
}

interface Props {
  event: ScheduledEvent
  label: string
  /** A Lucide icon component for system event types, or an emoji string. */
  icon: string | LucideIcon
  pockets: Pocket[]
  /** Apply an in-place edit (amount / pocket / date). */
  onEdit: (changes: EventCorrection) => void | Promise<void>
  /** Fully undo the confirmed payment and return it to pending. */
  onReverse: () => void | Promise<void>
  onClose: () => void
}

/**
 * Correct a payment that was already confirmed: edit its amount, pocket or date
 * in place, or undo it entirely. Used from the Home "Confirmados recientes"
 * list and from the History detail view.
 */
export function CorrectEventSheet({ event, label, icon: Icon, pockets, onEdit, onReverse, onClose }: Props) {
  const [mode, setMode] = useState<'main' | 'edit' | 'reverse'>('main')
  const [amount, setAmount] = useState(String(event.amount))
  const [pocketId, setPocketId] = useState(event.actual_pocket_id ?? pockets[0]?.id ?? '')
  const [date, setDate] = useState(event.due_date)
  const { submitting, submit } = useSubmitLock()

  const currentPocket = pockets.find(p => p.id === event.actual_pocket_id)
  const amountNum = parseAmount(amount)

  const saveEdit = () => submit(async () => {
    const changes: EventCorrection = {}
    if (amountNum > 0 && amountNum !== event.amount) changes.amount = amountNum
    if (pocketId && pocketId !== event.actual_pocket_id) changes.pocketId = pocketId
    if (date && date !== event.due_date) changes.date = date
    if (Object.keys(changes).length) await onEdit(changes)
    onClose()
  })

  const doReverse = () => submit(async () => { await onReverse(); onClose() })

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 px-6 pt-6 pb-8 overflow-y-auto overscroll-contain" style={{ maxHeight: '90dvh' }}>

        {/* Event info (shown in every mode) */}
        <div className="flex items-center gap-3 mb-5">
          {typeof Icon === 'string'
            ? <span className="text-2xl">{Icon}</span>
            : <Icon size={24} className="text-slate-200" />}
          <div className="flex-1">
            <p className="text-slate-100 font-semibold text-sm">{label}</p>
            <p className="text-emerald-400 font-bold text-lg">{maskAmount(event.amount, false)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{event.due_date}</p>
            <span className="text-[10px] text-emerald-500 uppercase tracking-wide">Confirmado</span>
          </div>
        </div>

        {mode === 'main' && (
          <>
            {currentPocket && (
              <p className="text-xs text-slate-400 mb-4">
                Bolsillo: <span className="text-slate-300">{currentPocket.icon} {currentPocket.name}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => setMode('edit')}
                className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                <Pencil size={16} /> Editar
              </button>
              <button
                onClick={() => setMode('reverse')}
                className="flex items-center justify-center gap-2 bg-amber-600/20 border border-amber-600/40 hover:bg-amber-600/30 text-amber-400 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                <Undo2 size={16} /> Deshacer
              </button>
            </div>
            <button onClick={onClose} className="w-full mt-2 text-slate-400 text-xs py-2">
              Cancelar
            </button>
          </>
        )}

        {mode === 'edit' && (
          <>
            <h3 className="text-slate-100 font-semibold mb-4">Corregir el pago</h3>
            <AmountInput label="Monto" value={amount} onChange={setAmount} className="mb-3" />

            <label className="block text-xs text-slate-400 mb-1">Bolsillo</label>
            <div className="space-y-2 mb-3">
              {pockets.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPocketId(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    pocketId === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <span>{p.icon}</span>
                  <div className="flex-1">
                    <p className="text-slate-200 text-sm font-medium">{p.name}</p>
                    <p className="text-slate-400 text-xs">{maskAmount(p.balance, false)}</p>
                  </div>
                </button>
              ))}
            </div>

            <label className="block text-xs text-slate-400 mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark] mb-4"
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('main')} className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm">
                Atrás
              </button>
              <button
                onClick={saveEdit}
                disabled={submitting || amountNum <= 0}
                className="py-3 rounded-xl bg-accent disabled:opacity-40 text-on-accent text-sm font-semibold"
              >
                Guardar cambios
              </button>
            </div>
          </>
        )}

        {mode === 'reverse' && (
          <>
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mb-4">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Se devolverá el dinero al bolsillo, se borrará el movimiento registrado y la ficha volverá a
                <span className="font-semibold"> pendiente</span> para que la registres de nuevo.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('main')} className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm">
                Atrás
              </button>
              <button
                onClick={doReverse}
                disabled={submitting}
                className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold"
              >
                Sí, deshacer
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
