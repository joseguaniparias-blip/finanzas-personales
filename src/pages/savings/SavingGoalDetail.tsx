import { useState } from 'react'
import { ArrowLeft, Check, SkipForward, Trash2, PiggyBank } from 'lucide-react'
import type { SavingGoal, Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { todayISO } from '@/lib/date'

interface Props {
  goal: SavingGoal
  pockets: Pocket[]
  onBack: () => void
  onSavingRecorded: () => void
}

export function SavingGoalDetail({ goal, pockets, onBack, onSavingRecorded }: Props) {
  const { getPendingByRef, confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent } = useScheduledEvents(goal.user_id)
  const [confirmSheet, setConfirmSheet] = useState(false)

  const pendingEvent = getPendingByRef(goal.id)
  const sourcePocket = pockets.find(p => p.id === goal.source_pocket_id)
  const progress = goal.target_amount ? Math.min(1, goal.saved_amount / goal.target_amount) : null
  const remaining = goal.target_amount ? Math.max(0, goal.target_amount - goal.saved_amount) : null

  const freqLabel = goal.frequency === 'monthly' ? 'Mensual' : goal.frequency === 'weekly' ? 'Semanal' : 'Al cobrar plataforma'
  const today = todayISO()
  const isOverdue = pendingEvent && pendingEvent.due_date <= today

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-slate-100 text-lg font-bold">{goal.name}</h2>
          <p className="text-slate-400 text-xs">{freqLabel}</p>
        </div>
      </div>

      {goal.target_amount && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400">Ahorrado</p>
              <p className="text-blue-400 font-bold text-lg">{maskAmount(goal.saved_amount, false)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Falta</p>
              <p className="text-slate-300 font-bold text-lg">{maskAmount(remaining!, false)}</p>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(progress! * 100).toFixed(1)}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-2">Meta: {maskAmount(goal.target_amount, false)}</p>
        </div>
      )}

      {!goal.target_amount && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Total ahorrado</p>
          <p className="text-blue-400 font-bold text-2xl">{maskAmount(goal.saved_amount, false)}</p>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5 space-y-3">
        <Row label="Aporte" value={maskAmount(goal.contribution_amount, false)} />
        <Row label="Frecuencia" value={freqLabel} />
        {sourcePocket && <Row label="Bolsillo origen" value={`${sourcePocket.icon} ${sourcePocket.name}`} />}
      </div>

      {pendingEvent && (
        <div className={`rounded-xl p-4 mb-5 border ${isOverdue ? 'bg-blue-600/10 border-blue-600/30' : 'bg-slate-800 border-slate-700'}`}>
          <p className={`text-xs font-medium mb-3 ${isOverdue ? 'text-blue-400' : 'text-slate-400'}`}>
            {isOverdue ? '🔔 Aporte pendiente' : `📅 Próximo aporte · ${pendingEvent.due_date}`}
          </p>
          <p className="text-slate-200 font-bold text-lg mb-4">{maskAmount(pendingEvent.amount, false)}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => setConfirmSheet(true)}
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-strong text-on-accent py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Check size={14} /> Registrar aporte
            </button>
            <button onClick={() => { postponeEvent(pendingEvent.id); onSavingRecorded() }}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-xl text-sm transition-colors">
              <SkipForward size={14} /> Posponer
            </button>
          </div>
          <button onClick={async () => { await deleteEvent(pendingEvent.id); onSavingRecorded() }}
            className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 py-2 rounded-xl text-xs transition-colors">
            <Trash2 size={12} /> Eliminar este evento
          </button>
        </div>
      )}

      {confirmSheet && pendingEvent && (
        <ConfirmEventSheet
          event={pendingEvent}
          label={goal.name}
          icon={PiggyBank}
          pockets={pockets.filter(p => p.type !== 'platform')}
          defaultPocketId={goal.source_pocket_id}
          onConfirm={async pocketId => { await confirmEvent(pendingEvent.id, pocketId); setConfirmSheet(false); onSavingRecorded() }}
          onPartial={async (pocketId, amount) => { await partialEvent(pendingEvent.id, pocketId, amount); setConfirmSheet(false); onSavingRecorded() }}
          onPostpone={() => { postponeEvent(pendingEvent.id); setConfirmSheet(false) }}
          onReschedule={async newDate => { await rescheduleEvent(pendingEvent.id, newDate); setConfirmSheet(false); onSavingRecorded() }}
          onDelete={async () => { await deleteEvent(pendingEvent.id); setConfirmSheet(false); onSavingRecorded() }}
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
