import { useState } from 'react'
import { ArrowLeft, Check, SkipForward, Trophy, Calendar, Trash2 } from 'lucide-react'
import type { Cadena, Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'

interface Props {
  cadena: Cadena
  pockets: Pocket[]
  onBack: () => void
  onPaymentRecorded: () => void
  onDelete: () => void
}

export function CadenaDetail({ cadena, pockets, onBack, onPaymentRecorded, onDelete }: Props) {
  const { getPendingByRef, confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent } = useScheduledEvents(cadena.user_id)
  const [confirmSheet, setConfirmSheet] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pendingEvent = getPendingByRef(cadena.id)
  const sourcePocket = pockets.find(p => p.id === cadena.source_pocket_id)
  const payoutPocket = pockets.find(p => p.id === cadena.payout_pocket_id)
  const freqLabel = cadena.frequency === 'monthly' ? 'Mensual' : 'Semanal'
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = pendingEvent && pendingEvent.due_date <= today
  const totalPot = cadena.contribution_amount * cadena.participants
  const isMyTurnNow = cadena.current_round === cadena.my_turn

  async function handleReschedule() {
    if (!pendingEvent || !newDate) return
    await rescheduleEvent(pendingEvent.id, newDate)
    setEditingDate(false)
    setNewDate('')
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-slate-100 text-lg font-bold">{cadena.name}</h2>
          <p className="text-slate-500 text-xs">{freqLabel} · {cadena.participants} participantes</p>
        </div>
        {cadena.status === 'completed' && (
          <span className="flex items-center gap-1 text-xs text-violet-400 bg-violet-400/10 px-2 py-1 rounded-full">
            <Trophy size={12} /> Completada
          </span>
        )}
      </div>

      {/* Progress rounds */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
        <div className="flex justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400">Ronda actual</p>
            <p className="text-violet-400 font-bold text-2xl">{cadena.current_round} / {cadena.participants}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Bote por ronda</p>
            <p className="text-slate-200 font-bold text-lg">{maskAmount(totalPot, false)}</p>
          </div>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full transition-all"
            style={{ width: `${((cadena.paid_rounds / cadena.participants) * 100).toFixed(1)}%` }} />
        </div>
        {isMyTurnNow && (
          <div className="mt-3 bg-violet-600/20 border border-violet-500/40 rounded-xl p-3 text-center">
            <p className="text-violet-300 text-sm font-semibold">🎉 ¡Esta ronda te toca cobrar!</p>
            <p className="text-violet-400 text-xs mt-0.5">{maskAmount(totalPot, false)} van a tu bolsillo</p>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5 space-y-3">
        <Row label="Aporte" value={maskAmount(cadena.contribution_amount, false)} />
        <Row label="Frecuencia" value={freqLabel} />
        <Row label="Mi turno de cobro" value={`Ronda #${cadena.my_turn}`} />
        {sourcePocket && <Row label="Sale de" value={`${sourcePocket.icon} ${sourcePocket.name}`} />}
        {payoutPocket && <Row label="Cobro a" value={`${payoutPocket.icon} ${payoutPocket.name}`} />}
        <Row label="Pagadas" value={`${cadena.paid_rounds} ronda${cadena.paid_rounds !== 1 ? 's' : ''}`} />
      </div>

      {/* Pending event card */}
      {pendingEvent && cadena.status === 'active' && (
        <div className={`rounded-xl p-4 mb-5 border ${isOverdue ? 'bg-violet-600/10 border-violet-600/30' : 'bg-slate-800 border-slate-700'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-xs font-medium ${isOverdue ? 'text-violet-400' : 'text-slate-400'}`}>
              {isOverdue ? '🔔 Aporte pendiente' : `📅 Próximo aporte · ${pendingEvent.due_date}`}
            </p>
            {/* Cambiar fecha */}
            {!editingDate && (
              <button
                onClick={() => { setEditingDate(true); setNewDate(pendingEvent.due_date) }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                <Calendar size={12} /> Cambiar fecha
              </button>
            )}
          </div>

          {/* Date picker inline */}
          {editingDate && (
            <div className="mb-3 flex items-center gap-2">
              <input
                type="date"
                value={newDate}
                min={today}
                onChange={e => setNewDate(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-violet-500"
              />
              <button
                onClick={handleReschedule}
                disabled={!newDate}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                Guardar
              </button>
              <button
                onClick={() => { setEditingDate(false); setNewDate('') }}
                className="text-slate-500 hover:text-slate-300 px-2 py-2 text-sm transition-colors">
                ✕
              </button>
            </div>
          )}

          <p className="text-slate-200 font-bold text-lg mb-4">{maskAmount(pendingEvent.amount, false)}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => setConfirmSheet(true)}
              className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Check size={14} /> Registrar aporte
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

      {/* Delete button */}
      {cadena.status === 'active' && !confirmDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center justify-center gap-2 border border-red-600/30 text-red-400 hover:bg-red-600/10 py-3 rounded-xl text-sm transition-colors">
          <Trash2 size={14} /> Eliminar cadena
        </button>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4">
          <p className="text-red-400 text-sm font-semibold mb-1">¿Eliminar esta cadena?</p>
          <p className="text-slate-400 text-xs mb-4">Se eliminará la cadena y los eventos pendientes. Esta acción no se puede deshacer.</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onDelete}
              className="bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Sí, eliminar
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmSheet && pendingEvent && (
        <ConfirmEventSheet
          event={pendingEvent}
          label={cadena.name}
          icon="🟣"
          pockets={pockets.filter(p => p.type !== 'platform')}
          defaultPocketId={cadena.source_pocket_id}
          onConfirm={async pocketId => { await confirmEvent(pendingEvent.id, pocketId); setConfirmSheet(false); onPaymentRecorded() }}
          onPartial={async (pocketId, amount) => { await partialEvent(pendingEvent.id, pocketId, amount); setConfirmSheet(false); onPaymentRecorded() }}
          onPostpone={() => { postponeEvent(pendingEvent.id); setConfirmSheet(false) }}
          onReschedule={async newDate => { await rescheduleEvent(pendingEvent.id, newDate); setConfirmSheet(false); onPaymentRecorded() }}
          onDelete={async () => { await deleteEvent(pendingEvent.id); setConfirmSheet(false); onPaymentRecorded() }}
          onClose={() => setConfirmSheet(false)}
        />
      )}
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
