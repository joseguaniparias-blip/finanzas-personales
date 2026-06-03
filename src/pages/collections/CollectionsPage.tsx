import { useState } from 'react'
import { Plus, HandCoins, Calendar, AlertCircle, User } from 'lucide-react'
import { useCollections } from '@/hooks/useCollections'
import { usePockets } from '@/hooks/usePockets'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { CollectionForm } from './CollectionForm'
import { CollectionDetail } from './CollectionDetail'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Collection, ScheduledEvent } from '@/types'
import { todayISO, toISODate } from '@/lib/date'

interface Props { userId: string }

function formatShort(iso: string): string {
  const [, m, d] = iso.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${Number(d)} ${months[Number(m) - 1]}`
}

function formatDue(iso: string, today: string): { label: string; urgent: boolean } {
  if (iso < today) return { label: `Vencido ${formatShort(iso)}`, urgent: true }
  if (iso === today) return { label: 'Vence hoy', urgent: true }
  const tom = new Date(); tom.setDate(tom.getDate() + 1)
  if (iso === toISODate(tom)) return { label: 'MaÃ±ana', urgent: false }
  return { label: formatShort(iso), urgent: false }
}

export function CollectionsPage({ userId }: Props) {
  const { collections, loading, addCollection, updateCollection, closeCollection } = useCollections(userId)
  const { pockets } = usePockets(userId)
  const { events } = useScheduledEvents(userId)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Collection | null>(null)
  const [editing, setEditing] = useState<Collection | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargandoâ€¦</div>

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
        onDelete={async () => { await closeCollection(selected.id); setSelected(null) }}
        onPaymentRecorded={() => setSelected(null)}
      />
    )
  }

  const today = todayISO()
  const totalPending = collections.reduce((s, c) => {
    if (c.has_total && c.total_amount) return s + Math.max(0, c.total_amount - c.collected_amount)
    return s
  }, 0)
  const overdueCount = collections.filter(c => {
    const ev = events.find(e => e.reference_id === c.id && e.status === 'pending')
    return ev && ev.due_date <= today
  }).length

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <PageHeader title="Cobros" right={
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
          <Plus size={14} /> Nuevo
        </button>
      } />

      {/* Summary */}
      {collections.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total por cobrar</p>
              <p className="text-3xl font-bold text-emerald-400">{maskAmount(totalPending, false)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Cobros activos</p>
              <p className="text-lg font-bold text-slate-300">{collections.length}</p>
            </div>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-400 font-medium">
                {overdueCount} cobro{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {collections.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <HandCoins size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Sin cobros activos</p>
          <p className="text-slate-600 text-xs mt-1">Registra dinero que te deben</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(c => {
            const pendingEvent = events.find(e => e.reference_id === c.id && e.status === 'pending') ?? null
            return (
              <CollectionCard
                key={c.id}
                collection={c}
                pendingEvent={pendingEvent}
                today={today}
                onTap={() => setSelected(c)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ Collection card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CollectionCard({ collection: c, pendingEvent, today, onTap }: {
  collection: Collection
  pendingEvent: ScheduledEvent | null
  today: string
  onTap: () => void
}) {
  const progress = c.has_total && c.total_amount
    ? Math.min(1, c.collected_amount / c.total_amount) : null
  const remaining = c.has_total && c.total_amount
    ? Math.max(0, c.total_amount - c.collected_amount) : null
  const pct = progress !== null ? Math.round(progress * 100) : null
  const due = pendingEvent ? formatDue(pendingEvent.due_date, today) : null
  const isFuture = c.start_date > today

  return (
    <button onClick={onTap}
      className={`w-full text-left bg-slate-800 rounded-2xl border transition-colors ${due?.urgent ? 'border-amber-500/40' : 'border-slate-700 hover:border-slate-600'}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-slate-200 font-semibold text-sm truncate">{c.name}</p>
              {!c.has_total && <span className="flex-shrink-0 text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Indefinido</span>}
              {isFuture && <span className="flex-shrink-0 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Futuro</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <User size={10} className="text-slate-600" />
              <p className="text-xs text-slate-500">{c.person_name}</p>
              <span className="text-slate-700">Â·</span>
              <p className="text-xs text-slate-500">
                {maskAmount(c.installment_amount, false)}
                {c.frequency !== 'once' && `/${c.frequency === 'monthly' ? 'mes' : c.frequency === 'weekly' ? 'sem' : 'dÃ­a'}`}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {c.has_total && c.total_amount ? (
              <>
                <p className="text-emerald-400 font-bold text-base">{maskAmount(remaining!, false)}</p>
                <p className="text-xs text-slate-500">por cobrar</p>
              </>
            ) : (
              <>
                <p className="text-slate-300 font-bold text-base">{maskAmount(c.collected_amount, false)}</p>
                <p className="text-xs text-slate-500">cobrado</p>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        {progress !== null && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>{pct}% cobrado</span>
              <span>{maskAmount(c.collected_amount, false)} de {maskAmount(c.total_amount!, false)}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Next payment */}
        {pendingEvent && (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${due?.urgent ? 'bg-amber-500/10' : 'bg-slate-700/50'}`}>
            {due?.urgent
              ? <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
              : <Calendar size={12} className="text-slate-500 flex-shrink-0" />}
            <span className={`text-xs font-medium ${due?.urgent ? 'text-amber-400' : 'text-slate-400'}`}>
              {due?.label}
            </span>
            <span className="ml-auto text-xs text-slate-500">{maskAmount(pendingEvent.amount, false)}</span>
          </div>
        )}
      </div>
    </button>
  )
}
