import { useState } from 'react'
import { Check, ArrowLeftRight, SkipForward, Minus, AlertTriangle, Trash2, CalendarDays } from 'lucide-react'
import type { ScheduledEvent, Pocket } from '@/types'
import { AmountInput, parseAmount } from './AmountInput'
import { maskAmount } from './PrivacyToggle'
import { useSubmitLock } from '@/hooks/useSubmitLock'

const CONFIRM_LABELS: Record<string, string> = {
  debt:            'Pagué',
  cadena:          'Pagué',
  saving:          'Guardé',
  collection:      'Cobré',
  platform_payout: 'Llegó',
}

const PARTIAL_LABELS: Record<string, string> = {
  debt:       'Otro monto',
  cadena:     'Otro monto',
  saving:     'Otro monto',
  collection: 'Otro monto',
}

interface Props {
  event: ScheduledEvent
  label: string
  icon: string
  pockets: Pocket[]
  defaultPocketId: string
  onConfirm: (pocketId: string) => void
  onPartial: (pocketId: string, amount: number) => void
  onPostpone: () => void
  onReschedule?: (newDate: string) => void
  onDelete?: () => void
  onClose: () => void
}

export function ConfirmEventSheet({
  event, label, icon, pockets, defaultPocketId,
  onConfirm, onPartial, onPostpone, onReschedule, onDelete, onClose
}: Props) {
  const [mode, setMode] = useState<'main' | 'pocket' | 'partial' | 'reschedule' | 'delete'>('main')
  const [selectedPocket, setSelectedPocket] = useState(defaultPocketId)
  const [partialAmount, setPartialAmount] = useState('')
  const [newDate, setNewDate] = useState(event.due_date)
  const { submitting, submit } = useSubmitLock()
  const lockedAction = (fn: () => void | Promise<void>) => () => submit(async () => { await fn() })

  const pocket = pockets.find(p => p.id === selectedPocket)
  const confirmLabel = CONFIRM_LABELS[event.type] ?? 'Confirmar'
  const partialLabel = PARTIAL_LABELS[event.type] ?? 'Otro monto'
  const isExpense = event.type === 'debt' || event.type === 'cadena' || event.type === 'saving'
  const insufficientBalance = isExpense && pocket !== undefined && pocket.balance < event.amount
  const partialNum = parseAmount(partialAmount)
  const isOverpayment = partialNum > event.amount

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 px-6 pt-6 pb-8 overflow-y-auto overscroll-contain" style={{ maxHeight: '90dvh' }}>

        {mode === 'main' && (
          <>
            {/* Event info */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-2xl">{icon}</span>
              <div className="flex-1">
                <p className="text-slate-100 font-semibold text-sm">{label}</p>
                <p className="text-emerald-400 font-bold text-lg">{maskAmount(event.amount, false)}</p>
              </div>
              <p className="text-xs text-slate-500">{event.due_date}</p>
            </div>

            {pocket && (
              <p className="text-xs text-slate-500 mb-3">
                Bolsillo: <span className="text-slate-300">{pocket.icon} {pocket.name}</span>
                <span className={`ml-2 ${insufficientBalance ? 'text-red-400' : 'text-slate-500'}`}>
                  · {maskAmount(pocket.balance, false)}
                </span>
              </p>
            )}

            {insufficientBalance && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 mb-4">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  Saldo insuficiente — faltan {maskAmount(event.amount - (pocket?.balance ?? 0), false)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={lockedAction(() => onConfirm(selectedPocket))}
                disabled={submitting}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                <Check size={16} /> {confirmLabel}
              </button>
              <button
                onClick={() => setMode('partial')}
                disabled={submitting}
                className="flex items-center justify-center gap-2 bg-amber-600/20 border border-amber-600/40 hover:bg-amber-600/30 disabled:opacity-50 text-amber-400 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                <Minus size={16} /> {partialLabel}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => setMode('pocket')}
                className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm transition-colors"
              >
                <ArrowLeftRight size={14} /> Otro bolsillo
              </button>
              <button
                onClick={() => { onPostpone(); onClose() }}
                className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm transition-colors"
              >
                <SkipForward size={14} /> Posponer 1 día
              </button>
            </div>

            {(onReschedule || onDelete) && (
              <div className="grid grid-cols-2 gap-3">
                {onReschedule && (
                  <button
                    onClick={() => setMode('reschedule')}
                    className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm transition-colors"
                  >
                    <CalendarDays size={14} /> Cambiar fecha
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => setMode('delete')}
                    className="flex items-center justify-center gap-2 bg-red-600/10 border border-red-600/30 hover:bg-red-600/20 text-red-400 py-3 rounded-xl text-sm transition-colors"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                )}
              </div>
            )}

            <button onClick={onClose} className="w-full mt-4 text-slate-500 text-xs py-2">
              Cancelar
            </button>
          </>
        )}

        {mode === 'reschedule' && (
          <>
            <h3 className="text-slate-100 font-semibold mb-1">Cambiar fecha</h3>
            <p className="text-slate-500 text-xs mb-4">Fecha actual: {event.due_date}</p>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark] mb-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('main')} className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm">
                Atrás
              </button>
              <button
                disabled={!newDate || newDate === event.due_date}
                onClick={() => { onReschedule?.(newDate); onClose() }}
                className="py-3 rounded-xl bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold"
              >
                Guardar fecha
              </button>
            </div>
          </>
        )}

        {mode === 'delete' && (
          <>
            <h3 className="text-slate-100 font-semibold mb-1">¿Eliminar este evento?</h3>
            <p className="text-slate-500 text-xs mb-4">
              Se quitará de la agenda. No se modifica el saldo ni el registro original (deuda/cobro/cadena).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('main')} className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm">
                Cancelar
              </button>
              <button
                onClick={lockedAction(() => { onDelete?.(); onClose() })}
                disabled={submitting}
                className="py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold"
              >
                Eliminar evento
              </button>
            </div>
          </>
        )}

        {mode === 'pocket' && (
          <>
            <h3 className="text-slate-100 font-semibold mb-4">¿Desde qué bolsillo?</h3>
            <div className="space-y-2 mb-4">
              {pockets.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPocket(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    selectedPocket === p.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <span>{p.icon}</span>
                  <div className="flex-1">
                    <p className="text-slate-200 text-sm font-medium">{p.name}</p>
                    <p className="text-slate-500 text-xs">{maskAmount(p.balance, false)}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('main')} className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm">
                Atrás
              </button>
              <button
                onClick={lockedAction(() => { onConfirm(selectedPocket); onClose() })}
                disabled={submitting}
                className="py-3 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold"
              >
                Confirmar
              </button>
            </div>
          </>
        )}

        {mode === 'partial' && (
          <>
            <h3 className="text-slate-100 font-semibold mb-1">Registrar otro monto</h3>
            <p className="text-slate-500 text-xs mb-4">Cuota: {maskAmount(event.amount, false)}</p>
            <AmountInput
              label={event.type === 'collection' ? '¿Cuánto cobraste?' : '¿Cuánto pagaste?'}
              value={partialAmount}
              onChange={setPartialAmount}
              className="mb-3"
            />
            {partialNum > 0 && partialNum < event.amount && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mb-4">
                <p className="text-xs text-amber-400">
                  Abono parcial — quedarán {maskAmount(event.amount - partialNum, false)} para después
                </p>
              </div>
            )}
            {isOverpayment && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 mb-4">
                <p className="text-xs text-emerald-400">
                  Pagaste {maskAmount(partialNum - event.amount, false)} más que la cuota — quedará registrado completo
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('main')} className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm">
                Atrás
              </button>
              <button
                disabled={!partialAmount || partialNum <= 0 || submitting}
                onClick={lockedAction(() => { onPartial(selectedPocket, partialNum); onClose() })}
                className="py-3 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold"
              >
                Registrar
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
