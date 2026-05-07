import { useState } from 'react'
import { ArrowLeft, Check, SkipForward, Trophy } from 'lucide-react'
import type { Cadena, Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'

interface Props {
  cadena: Cadena
  pockets: Pocket[]
  onBack: () => void
  onPaymentRecorded: () => void
}

export function CadenaDetail({ cadena, pockets, onBack, onPaymentRecorded }: Props) {
  const { getPendingByRef, confirmEvent, partialEvent, postponeEvent } = useScheduledEvents(cadena.user_id)
  const [confirmSheet, setConfirmSheet] = useState(false)

  const pendingEvent = getPendingByRef(cadena.id)
  const sourcePocket = pockets.find(p => p.id === cadena.source_pocket_id)
  const payoutPocket = pockets.find(p => p.id === cadena.payout_pocket_id)
  const freqLabel = cadena.frequency === 'monthly' ? 'Mensual' : 'Semanal'
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = pendingEvent && pendingEvent.due_date <= today
  const totalPot = cadena.contribution_amount * cadena.participants
  const isMyTurnNow = cadena.current_round === cadena.my_turn

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

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5 space-y-3">
        <Row label="Aporte" value={maskAmount(cadena.contribution_amount, false)} />
        <Row label="Frecuencia" value={freqLabel} />
        <Row label="Mi turno de cobro" value={`Ronda #${cadena.my_turn}`} />
        {sourcePocket && <Row label="Sale de" value={`${sourcePocket.icon} ${sourcePocket.name}`} />}
        {payoutPocket && <Row label="Cobro a" value={`${payoutPocket.icon} ${payoutPocket.name}`} />}
        <Row label="Pagadas" value={`${cadena.paid_rounds} ronda${cadena.paid_rounds !== 1 ? 's' : ''}`} />
      </div>

      {pendingEvent && cadena.status === 'active' && (
        <div className={`rounded-xl p-4 mb-5 border ${isOverdue ? 'bg-violet-600/10 border-violet-600/30' : 'bg-slate-800 border-slate-700'}`}>
          <p className={`text-xs font-medium mb-3 ${isOverdue ? 'text-violet-400' : 'text-slate-400'}`}>
            {isOverdue ? '🔔 Aporte pendiente' : `📅 Próximo aporte · ${pendingEvent.due_date}`}
          </p>
          <p className="text-slate-200 font-bold text-lg mb-4">{maskAmount(pendingEvent.amount, false)}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmSheet(true)}
              className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Check size={14} /> Registrar aporte
            </button>
            <button onClick={() => { postponeEvent(pendingEvent.id); onPaymentRecorded() }}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-colors">
              <SkipForward size={14} /> Posponer
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
