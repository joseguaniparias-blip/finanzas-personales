import { useState } from 'react'
import { Check, ArrowLeftRight, SkipForward, Minus, AlertTriangle } from 'lucide-react'
import type { ScheduledEvent, Pocket } from '@/types'
import { AmountInput, parseAmount } from './AmountInput'
import { maskAmount } from './PrivacyToggle'

const CONFIRM_LABELS: Record<string, string> = {
  debt:            'Pagué',
  cadena:          'Pagué',
  saving:          'Guardé',
  collection:      'Cobré',
  platform_payout: 'Llegó',
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
  onClose: () => void
}

export function ConfirmEventSheet({
  event, label, icon, pockets, defaultPocketId,
  onConfirm, onPartial, onPostpone, onClose
}: Props) {
  const [mode, setMode] = useState<'main' | 'pocket' | 'partial'>('main')
  const [selectedPocket, setSelectedPocket] = useState(defaultPocketId)
  const [partialAmount, setPartialAmount] = useState('')

  const pocket = pockets.find(p => p.id === selectedPocket)
  const confirmLabel = CONFIRM_LABELS[event.type] ?? 'Confirmar'
  const isExpense = event.type === 'debt' || event.type === 'cadena' || event.type === 'saving'
  const insufficientBalance = isExpense && pocket !== undefined && pocket.balance < event.amount

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
      <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 p-6">

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
                onClick={() => onConfirm(selectedPocket)}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                <Check size={16} /> {confirmLabel}
              </button>
              <button
                onClick={() => setMode('partial')}
                className="flex items-center justify-center gap-2 bg-amber-600/20 border border-amber-600/40 hover:bg-amber-600/30 text-amber-400 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                <Minus size={16} /> Abono parcial
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <SkipForward size={14} /> Posponer
              </button>
            </div>

            <button onClick={onClose} className="w-full mt-4 text-slate-500 text-xs py-2">
              Cancelar
            </button>
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
                onClick={() => { onConfirm(selectedPocket); onClose() }}
                className="py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
              >
                Confirmar
              </button>
            </div>
          </>
        )}

        {mode === 'partial' && (
          <>
            <h3 className="text-slate-100 font-semibold mb-1">Abono parcial</h3>
            <p className="text-slate-500 text-xs mb-4">Total: {maskAmount(event.amount, false)}</p>
            <AmountInput
              label="¿Cuánto pagaste?"
              value={partialAmount}
              onChange={setPartialAmount}
              className="mb-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('main')} className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm">
                Atrás
              </button>
              <button
                disabled={!partialAmount || parseAmount(partialAmount) <= 0}
                onClick={() => { onPartial(selectedPocket, parseAmount(partialAmount)); onClose() }}
                className="py-3 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold"
              >
                Registrar abono
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
