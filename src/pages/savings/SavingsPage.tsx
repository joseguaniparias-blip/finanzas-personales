import { useState } from 'react'
import { Plus, PiggyBank } from 'lucide-react'
import { useSavingGoals } from '@/hooks/useSavingGoals'
import { usePockets } from '@/hooks/usePockets'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { SavingGoalForm } from './SavingGoalForm'
import { SavingGoalDetail } from './SavingGoalDetail'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { SavingGoal } from '@/types'

interface Props { userId: string }

export function SavingsPage({ userId }: Props) {
  const { goals, loading, addGoal, updateGoal, recordSaving } = useSavingGoals(userId)
  const { pockets } = usePockets(userId)
  const { getPendingByRef } = useScheduledEvents(userId)
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

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Ahorros" right={
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
          <Plus size={14} /> Nueva meta
        </button>
      } />

      {goals.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 mb-5 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">TOTAL AHORRADO</p>
          <p className="text-2xl font-bold text-blue-400">{maskAmount(totalSaved, false)}</p>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-16">
          <PiggyBank size={36} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin metas de ahorro</p>
          <p className="text-slate-600 text-xs mt-1">Crea tu primer fondo de ahorro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const pending = getPendingByRef(g.id)
            const overdue = pending && pending.due_date <= today
            const progress = g.target_amount ? Math.min(1, g.saved_amount / g.target_amount) : null
            return (
              <button key={g.id} onClick={() => setSelected(g)}
                className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors text-left">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-200 font-semibold text-sm">{g.name}</p>
                      {overdue && <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-full">🔔 Pendiente</span>}
                      {!g.target_amount && <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">⚪ Sin meta</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {g.frequency === 'monthly' ? 'Mensual' : g.frequency === 'weekly' ? 'Semanal' : 'Al cobrar'}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-blue-400 font-bold text-sm">{maskAmount(g.saved_amount, false)}</p>
                    {g.target_amount && (
                      <p className="text-xs text-slate-500">de {maskAmount(g.target_amount, false)}</p>
                    )}
                  </div>
                </div>
                {progress !== null && (
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(progress * 100).toFixed(1)}%` }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
