import { useState } from 'react'
import { ArrowLeft, Check, SkipForward, Trash2 } from 'lucide-react'
import type { Collection, Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'

interface Props {
  collection: Collection
  pockets: Pocket[]
  onBack: () => void
  onDelete: () => void
  onPaymentRecorded: () => void
}

export function CollectionDetail({ collection, pockets, onBack, onDelete, onPaymentRecorded }: Props) {
  const { getPendingByRef, confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent } = useScheduledEvents(collection.user_id)
  const [confirmSheet, setConfirmSheet] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pendingEvent = getPendingByRef(collection.id)
  const destPocket = pockets.find(p => p.id === collection.dest_pocket_id)
  const progress = collection.has_total && collection.total_amount
    ? Math.min(1, collection.collected_amount / collection.total_amount) : null
  const remaining = collection.has_total && collection.total_amount
    ? Math.max(0, collection.total_amount - collection.collected_amount) : null

  const freqLabel = collection.frequency === 'once' ? 'Único' : collection.frequency === 'monthly' ? 'Mensual' : collection.frequency === 'weekly' ? 'Semanal' : 'Diario'
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = pendingEvent && pendingEvent.due_date <= today
  const isFuture = collection.start_date > today

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-slate-100 text-lg font-bold">{collection.name}</h2>
          <p className="text-slate-500 text-xs">👤 {collection.person_name}</p>
        </div>
        {collection.status === 'fully_collected' && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
            <Check size={12} /> Cobrado
          </span>
        )}
        {isFuture && (
          <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">🟡 Futuro</span>
        )}
      </div>

      {/* Progress */}
      {collection.has_total && collection.total_amount && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400">Cobrado</p>
              <p className="text-emerald-400 font-bold text-lg">{maskAmount(collection.collected_amount, false)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Por cobrar</p>
              <p className="text-blue-400 font-bold text-lg">{maskAmount(remaining!, false)}</p>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(progress! * 100).toFixed(1)}%` }} />
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5 space-y-3">
        <Row label="Cuota" value={maskAmount(collection.installment_amount, false)} />
        <Row label="Frecuencia" value={freqLabel} />
        {destPocket && <Row label="Bolsillo destino" value={`${destPocket.icon} ${destPocket.name}`} />}
        {!collection.has_total && <Row label="Total cobrado" value={maskAmount(collection.collected_amount, false)} />}
      </div>

      {/* Pending event */}
      {pendingEvent && collection.status === 'active' && !isFuture && (
        <div className={`rounded-xl p-4 mb-5 border ${isOverdue ? 'bg-emerald-600/10 border-emerald-600/30' : 'bg-slate-800 border-slate-700'}`}>
          <p className={`text-xs font-medium mb-3 ${isOverdue ? 'text-emerald-400' : 'text-slate-400'}`}>
            {isOverdue ? '🔔 Cobro pendiente' : `📅 Próximo cobro · ${pendingEvent.due_date}`}
          </p>
          <p className="text-slate-200 font-bold text-lg mb-4">{maskAmount(pendingEvent.amount, false)}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => setConfirmSheet(true)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Check size={14} /> Registrar cobro
            </button>
            <button onClick={() => { postponeEvent(pendingEvent.id); onPaymentRecorded() }}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-colors">
              <SkipForward size={14} /> Posponer
            </button>
          </div>
          <button onClick={async () => { await deleteEvent(pendingEvent.id); onPaymentRecorded() }}
            className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 py-2 rounded-xl text-xs transition-colors">
            <Trash2 size={12} /> Eliminar este evento
          </button>
        </div>
      )}

      {confirmSheet && pendingEvent && (
        <ConfirmEventSheet
          event={pendingEvent}
          label={`${collection.name} — ${collection.person_name}`}
          icon="🟢"
          pockets={pockets.filter(p => p.type !== 'platform')}
          defaultPocketId={collection.dest_pocket_id}
          onConfirm={async pocketId => { await confirmEvent(pendingEvent.id, pocketId); setConfirmSheet(false); onPaymentRecorded() }}
          onPartial={async (pocketId, amount) => { await partialEvent(pendingEvent.id, pocketId, amount); setConfirmSheet(false); onPaymentRecorded() }}
          onPostpone={() => { postponeEvent(pendingEvent.id); setConfirmSheet(false) }}
          onReschedule={async newDate => { await rescheduleEvent(pendingEvent.id, newDate); setConfirmSheet(false); onPaymentRecorded() }}
          onDelete={async () => { await deleteEvent(pendingEvent.id); setConfirmSheet(false); onPaymentRecorded() }}
          onClose={() => setConfirmSheet(false)}
        />
      )}

      {/* Delete */}
      <div className="mt-6">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 py-2.5 rounded-xl text-sm transition-colors">
            <Trash2 size={14} /> Eliminar cobro
          </button>
        ) : (
          <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 text-center">
            <p className="text-slate-300 text-sm mb-3">¿Eliminar <strong>{collection.name}</strong>?</p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  )
}
