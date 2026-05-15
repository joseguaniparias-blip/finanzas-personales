import { useState } from 'react'
import { Plus, PiggyBank, Calendar, AlertCircle, Target } from 'lucide-react'
import { useSavingGoals } from '@/hooks/useSavingGoals'
import { usePockets } from '@/hooks/usePockets'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { SavingGoalForm } from './SavingGoalForm'
import { SavingGoalDetail } from './SavingGoalDetail'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { SavingGoal, ScheduledEvent } from '@/types'

interface Props { userId: string }

function formatShort(iso: string): string {
  const [, m, d] = iso.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${Number(d)} ${months[Number(m) - 1]}`
}

function formatDue(iso: string, today: string): { label: string; urgent: boolean } {
  if (iso < today) return { label: `Vencido ${formatShort(iso)}`, urgent: true }
  if (iso === today) return { label: 'Aporte hoy', urgent: true }
  const tom = new Date(); tom.setDate(tom.getDate() + 1)
  if (iso === tom.toISOString().slice(0, 10)) return { label: 'Mañana', urgent: false }
  return { label: formatShort(iso), urgent: false }
}

export function SavingsPage({ userId }: Props) {
  const { goals, loading, addGoal, updateGoal, recordSaving } = useSavingGoals(userId)
  const { pockets } = usePockets(userId)
  const { events } = useScheduledEvents(userId)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<SavingGoal | null>(null)
  const [editing, setEditing] = useState<SavingGoal | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm || editing) {
    return (
      <SavingGoalForm
        userId={userId} pockets={pockets} initial={editing ?? undefined}
        onSave={async data => {
          if (editing) { await updateGoal(editing.id, data); setEditing(null) }
          else { await addGoal(data); setShowForm(false) }
        }}
        onCancel={() => { setShowForm(false); setEditing(null) }}
      />
    )
  }

  if (selected) {
    return (
      <SavingGoalDetail
        goal={selected} pockets={pockets}
        onBack={() => setSelected(null)}
        onSavingRecorded={() => {
          recordSaving(selected.id, selected.contribution_amount)
          setSelected(null)
        }}
      />
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0)
  const totalTarget = goals.filter(g => g.target_amount).reduce((s, g) => s + (g.target_amount ?? 0), 0)
  const overdueCount = goals.filter(g => {
    const ev = events.find(e => e.reference_id === g.id && e.status === 'pending')
    return ev && ev.due_date <= today
  }).length

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <PageHeader title="Ahorros" right={
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
          <Plus size={14} /> Nueva meta
        </button>
      } />

      {/* Summary */}
      {goals.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total ahorrado</p>
              <p className="text-3xl font-bold text-blue-400">{maskAmount(totalSaved, false)}</p>
              {totalTarget > 0 && (
                <p className="text-xs text-slate-500 mt-1">de {maskAmount(totalTarget, false)} en metas</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Metas activas</p>
              <p className="text-lg font-bold text-slate-300">{goals.length}</p>
            </div>
          </div>
          {totalTarget > 0 && (
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalSaved / totalTarget) * 100)}%` }} />
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2 mt-3">
              <AlertCircle size={14} className="text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-400 font-medium">
                {overdueCount} aporte{overdueCount > 1 ? 's' : ''} pendiente{overdueCount > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <PiggyBank size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Sin metas de ahorro</p>
          <p className="text-slate-600 text-xs mt-1">Crea tu primer fondo de ahorro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const pendingEvent = events.find(e => e.reference_id === g.id && e.status === 'pending') ?? null
            return (
              <SavingGoalCard
                key={g.id}
                goal={g}
                pendingEvent={pendingEvent}
                today={today}
                onTap={() => setSelected(g)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Saving goal card ─────────────────────────────────────────────────────────

function SavingGoalCard({ goal: g, pendingEvent, today, onTap }: {
  goal: SavingGoal
  pendingEvent: ScheduledEvent | null
  today: string
  onTap: () => void
}) {
  const progress = g.target_amount ? Math.min(1, g.saved_amount / g.target_amount) : null
  const pct = progress !== null ? Math.round(progress * 100) : null
  const remaining = g.target_amount ? Math.max(0, g.target_amount - g.saved_amount) : null
  const due = pendingEvent ? formatDue(pendingEvent.due_date, today) : null
  const isUrgent = due?.urgent ?? false
  const isComplete = pct === 100

  const freqLabel = g.frequency === 'monthly' ? 'Mensual' : g.frequency === 'weekly' ? 'Semanal' : 'Al cobrar'

  return (
    <button onClick={onTap}
      className={`w-full text-left bg-slate-800 rounded-2xl border transition-colors ${isUrgent ? 'border-blue-500/40' : 'border-slate-700 hover:border-slate-600'}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-slate-200 font-semibold text-sm truncate">{g.name}</p>
              {isComplete && (
                <span className="flex-shrink-0 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">✓ Meta</span>
              )}
              {!g.target_amount && (
                <span className="flex-shrink-0 text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Sin meta</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">{freqLabel}</span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500">{maskAmount(g.contribution_amount, false)} / aporte</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-blue-400 font-bold text-base">{maskAmount(g.saved_amount, false)}</p>
            {g.target_amount ? (
              <p className="text-xs text-slate-500">de {maskAmount(g.target_amount, false)}</p>
            ) : (
              <p className="text-xs text-slate-500">ahorrado</p>
            )}
          </div>
        </div>

        {/* Progress */}
        {progress !== null && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Target size={10} className="text-slate-600" />
                <span className="text-xs text-slate-500">{pct}% de la meta</span>
              </div>
              {remaining !== null && remaining > 0 && (
                <span className="text-xs text-slate-500">{maskAmount(remaining, false)} restante</span>
              )}
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Next contribution */}
        {pendingEvent && (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isUrgent ? 'bg-blue-500/10' : 'bg-slate-700/50'}`}>
            {isUrgent
              ? <AlertCircle size={12} className="text-blue-400 flex-shrink-0" />
              : <Calendar size={12} className="text-slate-500 flex-shrink-0" />}
            <span className={`text-xs font-medium ${isUrgent ? 'text-blue-400' : 'text-slate-400'}`}>
              {due?.label}
            </span>
            <span className="ml-auto text-xs text-slate-500">{maskAmount(pendingEvent.amount, false)}</span>
          </div>
        )}
      </div>
    </button>
  )
}
