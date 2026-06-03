import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useCadenas } from '@/hooks/useCadenas'
import { usePockets } from '@/hooks/usePockets'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { CadenaForm } from './CadenaForm'
import { CadenaDetail } from './CadenaDetail'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Cadena } from '@/types'
import { todayISO } from '@/lib/date'

interface Props { userId: string }

export function CadenaPage({ userId }: Props) {
  const { cadenas, loading, addCadena, updateCadena, deleteCadena } = useCadenas(userId)
  const { pockets } = usePockets(userId)
  const { getPendingByRef } = useScheduledEvents(userId)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Cadena | null>(null)
  const [editing, setEditing] = useState<Cadena | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargandoâ€¦</div>

  if (showForm || editing) {
    return (
      <CadenaForm
        userId={userId} pockets={pockets} initial={editing ?? undefined}
        onSave={async data => {
          if (editing) { await updateCadena(editing.id, data); setEditing(null) }
          else { await addCadena(data); setShowForm(false) }
        }}
        onCancel={() => { setShowForm(false); setEditing(null) }}
      />
    )
  }

  if (selected) {
    return (
      <CadenaDetail
        cadena={selected} pockets={pockets}
        onBack={() => setSelected(null)}
        onPaymentRecorded={() => setSelected(null)}
        onDelete={async () => {
          await deleteCadena(selected.id)
          setSelected(null)
        }}
      />
    )
  }

  const today = todayISO()

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Cadenas" right={
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
          <Plus size={14} /> Nueva cadena
        </button>
      } />

      {cadenas.length === 0 ? (
        <div className="text-center py-16">
          <Users size={36} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin cadenas activas</p>
          <p className="text-slate-600 text-xs mt-1">Registra tu cadena o cooperativa grupal</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cadenas.map(c => {
            const pending = getPendingByRef(c.id)
            const overdue = pending && pending.due_date <= today
            const isMyTurn = c.current_round === c.my_turn
            const totalPot = c.contribution_amount * c.participants
            return (
              <button key={c.id} onClick={() => setSelected(c)}
                className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors text-left">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-200 font-semibold text-sm">{c.name}</p>
                      {overdue && <span className="text-xs text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded-full">ðŸ”” Pendiente</span>}
                      {isMyTurn && <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">ðŸŽ‰ Te toca cobrar</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ronda {c.current_round}/{c.participants} Â· {c.frequency === 'monthly' ? 'Mensual' : 'Semanal'}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-violet-400 font-bold text-sm">{maskAmount(c.contribution_amount, false)}</p>
                    <p className="text-xs text-slate-500">por turno</p>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${((c.paid_rounds / c.participants) * 100).toFixed(1)}%` }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <p className="text-xs text-slate-600">{c.paid_rounds} rondas pagadas</p>
                  <p className="text-xs text-slate-500">Bote: {maskAmount(totalPot, false)}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
