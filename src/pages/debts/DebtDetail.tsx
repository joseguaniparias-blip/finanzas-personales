import { useState, useEffect } from 'react'
import { ArrowLeft, Check, SkipForward, Pencil, Trash2 } from 'lucide-react'
import type { Debt, Pocket, ScheduledEvent } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { db } from '@/lib/db'
import { DAYS_OF_WEEK } from '@/types'

interface Props {
  debt: Debt
  pockets: Pocket[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onConfirm: (eventId: string, pocketId: string) => void
  onPartial: (eventId: string, pocketId: string, amount: number) => void
  onPostpone: (eventId: string) => void
}

export function DebtDetail({ debt, pockets, onBack, onEdit, onDelete, onConfirm, onPartial, onPostpone }: Props) {
  const [pendingEvent, setPendingEvent] = useState<ScheduledEvent | null>(null)
  const [confirmEvent, setConfirmEvent] = useState<ScheduledEvent | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const event = await db.scheduled_events
        .where('reference_id').equals(debt.id)
        .and(e => e.status === 'pending')
        .first()
      setPendingEvent(event ?? null)
    }
    load()
  }, [debt.id])

  const sourcePocket = pockets.find(p => p.id === debt.source_pocket_id)
  const progress = debt.has_total && debt.total_amount ? Math.min(1, debt.paid_amount / debt.total_amount) : null
  const remaining = debt.has_total && debt.total_amount ? Math.max(0, debt.total_amount - debt.paid_amount) : null
  const installmentsDone = Math.floor(debt.paid_amount / debt.installment_amount)
  const installmentsTotal = debt.has_total && debt.total_amount ? Math.ceil(debt.total_amount / debt.installment_amount) : null

  const frequencyLabel = debt.frequency === 'monthly' ? 'Mensual' : debt.frequency === 'weekly' ? 'Semanal' : 'Diario'
  const dayLabel = debt.frequency === 'weekly' ? DAYS_OF_WEEK[debt.payment_day] : `Día ${debt.payment_day}`

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-slate-100 text-lg font-bold flex-1">{debt.name}</h2>
        <button onClick={onEdit} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <Pencil size={16} />
        </button>
        {debt.status === 'paid_off' && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
            <Check size={12} /> Saldada
          </span>
        )}
      </div>

      {/* Progress card */}
      {debt.has_total && debt.total_amount && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400">Pagado</p>
              <p className="text-emerald-400 font-bold text-lg">{maskAmount(debt.paid_amount, false)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Restante</p>
              <p className="text-red-400 font-bold text-lg">{maskAmount(remaining!, false)}</p>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(progress! * 100).toFixed(1)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{installmentsDone} cuota{installmentsDone !== 1 ? 's' : ''} pagadas</span>
            {installmentsTotal && <span>{installmentsTotal - installmentsDone} restantes</span>}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5 space-y-3">
        <InfoRow label="Cuota" value={maskAmount(debt.installment_amount, false)} />
        <InfoRow label="Frecuencia" value={`${frequencyLabel} · ${dayLabel}`} />
        {sourcePocket && <InfoRow label="Bolsillo" value={`${sourcePocket.icon} ${sourcePocket.name}`} />}
        {!debt.has_total && (
          <InfoRow label="Total pagado" value={maskAmount(debt.paid_amount, false)} />
        )}
      </div>

      {/* Pending event action */}
      {pendingEvent && debt.status === 'active' && (
        <div className="bg-amber-600/10 border border-amber-600/30 rounded-xl p-4 mb-5">
          <p className="text-xs text-amber-400 font-medium mb-3">
            {pendingEvent.due_date <= new Date().toISOString().slice(0, 10) ? '⚠️ Cuota pendiente' : `📅 Próxima cuota · ${pendingEvent.due_date}`}
          </p>
          <p className="text-slate-200 font-bold text-lg mb-4">{maskAmount(pendingEvent.amount, false)}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirmEvent(pendingEvent)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <Check size={14} /> Registrar pago
            </button>
            <button
              onClick={() => { onPostpone(pendingEvent.id); setPendingEvent(null) }}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-colors"
            >
              <SkipForward size={14} /> Posponer
            </button>
          </div>
        </div>
      )}

      {confirmEvent && (
        <ConfirmEventSheet
          event={confirmEvent}
          label={debt.name}
          icon="💳"
          pockets={pockets.filter(p => p.type !== 'platform')}
          defaultPocketId={debt.source_pocket_id}
          onConfirm={(pocketId) => { onConfirm(confirmEvent.id, pocketId); setConfirmEvent(null); setPendingEvent(null) }}
          onPartial={(pocketId, amount) => { onPartial(confirmEvent.id, pocketId, amount); setConfirmEvent(null) }}
          onPostpone={() => { onPostpone(confirmEvent.id); setConfirmEvent(null) }}
          onClose={() => setConfirmEvent(null)}
        />
      )}

      {/* Delete */}
      <div className="mt-6">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 py-2.5 rounded-xl text-sm transition-colors">
            <Trash2 size={14} /> Eliminar deuda
          </button>
        ) : (
          <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 text-center">
            <p className="text-slate-300 text-sm mb-3">¿Eliminar <strong>{debt.name}</strong>?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">No</button>
              <button onClick={onDelete}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Sí, eliminar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  )
}
