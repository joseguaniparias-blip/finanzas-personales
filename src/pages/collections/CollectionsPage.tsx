import { useState } from 'react'
import { Plus, HandCoins } from 'lucide-react'
import { useCollections } from '@/hooks/useCollections'
import { usePockets } from '@/hooks/usePockets'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { CollectionForm } from './CollectionForm'
import { CollectionDetail } from './CollectionDetail'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Collection } from '@/types'

interface Props { userId: string }

export function CollectionsPage({ userId }: Props) {
  const { collections, loading, addCollection, updateCollection, recordCollection } = useCollections(userId)
  const { pockets } = usePockets(userId)
  const { getPendingByRef } = useScheduledEvents(userId)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Collection | null>(null)
  const [editing, setEditing] = useState<Collection | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm || editing) {
    return (
      <CollectionForm
        userId={userId} pockets={pockets} initial={editing ?? undefined}
        onSave={async data => {
          if (editing) { await updateCollection(editing.id, data); setEditing(null) }
          else { await addCollection(data); setShowForm(false) }
        }}
        onCancel={() => { setShowForm(false); setEditing(null) }}
      />
    )
  }

  if (selected) {
    return (
      <CollectionDetail
        collection={selected} pockets={pockets}
        onBack={() => setSelected(null)}
        onPaymentRecorded={() => {
          recordCollection(selected.id, selected.installment_amount)
          setSelected(null)
        }}
      />
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const totalPending = collections.reduce((s, c) => {
    if (c.has_total && c.total_amount) return s + Math.max(0, c.total_amount - c.collected_amount)
    return s
  }, 0)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Cobros" right={
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
          <Plus size={14} /> Nuevo
        </button>
      } />

      {collections.length > 0 && totalPending > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 mb-5 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">TOTAL POR COBRAR</p>
          <p className="text-2xl font-bold text-emerald-400">{maskAmount(totalPending, false)}</p>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="text-center py-16">
          <HandCoins size={36} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin cobros activos</p>
          <p className="text-slate-600 text-xs mt-1">Registra dinero que te deben</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(c => {
            const pending = getPendingByRef(c.id)
            const overdue = pending && pending.due_date <= today
            const future = c.start_date > today
            return (
              <button key={c.id} onClick={() => setSelected(c)}
                className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors text-left">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-200 font-semibold text-sm">{c.name}</p>
                      {overdue && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">🔔 Vence hoy</span>}
                      {future && <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">🟡 Futuro</span>}
                      {!c.has_total && <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">⚪ Indefinido</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">👤 {c.person_name}</p>
                  </div>
                  <div className="text-right ml-2">
                    {c.has_total && c.total_amount ? (
                      <>
                        <p className="text-emerald-400 font-bold text-sm">{maskAmount(Math.max(0, c.total_amount - c.collected_amount), false)}</p>
                        <p className="text-xs text-slate-500">por cobrar</p>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-300 font-bold text-sm">{maskAmount(c.collected_amount, false)}</p>
                        <p className="text-xs text-slate-500">cobrado</p>
                      </>
                    )}
                  </div>
                </div>
                {c.has_total && c.total_amount && (
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, (c.collected_amount / c.total_amount) * 100).toFixed(1)}%` }} />
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
