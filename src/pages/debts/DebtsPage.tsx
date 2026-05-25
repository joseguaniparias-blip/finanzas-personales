import { useState } from 'react'
import { Plus, CreditCard, Pencil, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useDebts } from '@/hooks/useDebts'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { usePockets } from '@/hooks/usePockets'
import { DebtForm } from './DebtForm'
import { DebtDetail } from './DebtDetail'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Debt, ScheduledEvent } from '@/types'

interface Props { userId: string }

function formatDueDate(iso: string, today: string): { label: string; overdue: boolean } {
  if (iso < today) return { label: `Vencida ${formatShort(iso)}`, overdue: true }
  if (iso === today) return { label: 'Vence hoy', overdue: true }
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  if (iso === tomorrow.toISOString().slice(0, 10)) return { label: 'Mañana', overdue: false }
  return { label: formatShort(iso), overdue: false }
}

function formatShort(iso: string): string {
  const [, m, d] = iso.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${Number(d)} ${months[Number(m) - 1]}`
}

export function DebtsPage({ userId }: Props) {
  const { debts, loading, addDebt, updateDebt, closeDebt } = useDebts(userId)
  const { pockets } = usePockets(userId)
  const { events, confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent } = useScheduledEvents(userId)
  const [showForm, setShowForm] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm || editingDebt) {
    return (
      <DebtForm
        userId={userId} pockets={pockets} initial={editingDebt ?? undefined}
        onSave={async (data, firstDueDate) => {
          if (editingDebt) { await updateDebt(editingDebt.id, data); setEditingDebt(null) }
          else { await addDebt(data, firstDueDate); setShowForm(false) }
        }}
        onCancel={() => { setShowForm(false); setEditingDebt(null) }}
      />
    )
  }

  if (selectedDebt) {
    return (
      <DebtDetail
        debt={selectedDebt} pockets={pockets}
        onBack={() => setSelectedDebt(null)}
        onEdit={() => { setEditingDebt(selectedDebt); setSelectedDebt(null) }}
        onDelete={async () => { await closeDebt(selectedDebt.id); setSelectedDebt(null) }}
        onConfirm={async (eventId, pocketId) => {
          await confirmEvent(eventId, pocketId)
          setSelectedDebt(null)
        }}
        onPartial={async (eventId, pocketId, amount) => {
          await partialEvent(eventId, pocketId, amount)
        }}
        onPostpone={async (eventId) => { await postponeEvent(eventId) }}
        onReschedule={async (eventId, newDate) => { await rescheduleEvent(eventId, newDate) }}
        onDeleteEvent={async (eventId) => { await deleteEvent(eventId) }}
      />
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const totalDebt = debts.reduce((s, d) => {
    if (d.has_total && d.total_amount) return s + Math.max(0, d.total_amount - d.paid_amount)
    return s
  }, 0)

  // Next overdue count
  const overdueCount = debts.filter(d => {
    const ev = events.find(e => e.reference_id === d.id && e.status === 'pending')
    return ev && ev.due_date <= today
  }).length

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <PageHeader
        title="Deudas"
        right={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
            <Plus size={14} /> Nueva
          </button>
        }
      />

      {/* Summary */}
      {debts.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total por pagar</p>
              <p className="text-3xl font-bold text-red-400">{maskAmount(totalDebt, false)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Deudas activas</p>
              <p className="text-lg font-bold text-slate-300">{debts.length}</p>
            </div>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400 font-medium">
                {overdueCount} cuota{overdueCount > 1 ? 's' : ''} pendiente{overdueCount > 1 ? 's' : ''} de pago
              </p>
            </div>
          )}
        </div>
      )}

      {debts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Sin deudas activas</p>
          <p className="text-slate-600 text-xs mt-1">Registra créditos, préstamos o compromisos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map(d => {
            const pendingEvent = events.find(e => e.reference_id === d.id && e.status === 'pending') ?? null
            return (
              <DebtCard
                key={d.id}
                debt={d}
                pendingEvent={pendingEvent}
                today={today}
                onTap={() => setSelectedDebt(d)}
                onEdit={() => setEditingDebt(d)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Debt card ────────────────────────────────────────────────────────────────

function DebtCard({ debt, pendingEvent, today, onTap, onEdit }: {
  debt: Debt
  pendingEvent: ScheduledEvent | null
  today: string
  onTap: () => void
  onEdit: () => void
}) {
  const progress = debt.has_total && debt.total_amount
    ? Math.min(1, debt.paid_amount / debt.total_amount) : null
  const remaining = debt.has_total && debt.total_amount
    ? Math.max(0, debt.total_amount - debt.paid_amount) : null
  const pct = progress !== null ? Math.round(progress * 100) : null

  const due = pendingEvent ? formatDueDate(pendingEvent.due_date, today) : null
  const isOverdue = due?.overdue ?? false
  const isOnce = debt.frequency === 'once'

  return (
    <div className={`bg-slate-800 rounded-2xl border transition-colors ${isOverdue ? 'border-red-500/40' : 'border-slate-700'}`}>
      <button onClick={onTap} className="w-full p-4 text-left">

        {/* Top row: name + amount */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-slate-200 font-semibold text-sm truncate">{debt.name}</p>
              {isOnce && (
                <span className="flex-shrink-0 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Único</span>
              )}
              {!debt.has_total && !isOnce && (
                <span className="flex-shrink-0 text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Indefinida</span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {maskAmount(debt.installment_amount, false)}
              {!isOnce && ` / ${debt.frequency === 'monthly' ? 'mes' : debt.frequency === 'weekly' ? 'semana' : 'día'}`}
            </p>
          </div>

          <div className="flex items-start gap-2 flex-shrink-0">
            <button onClick={e => { e.stopPropagation(); onEdit() }}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors">
              <Pencil size={13} />
            </button>
            <div className="text-right">
              {debt.has_total && debt.total_amount ? (
                <>
                  <p className="text-red-400 font-bold text-base">{maskAmount(remaining!, false)}</p>
                  <p className="text-xs text-slate-500">por pagar</p>
                </>
              ) : (
                <>
                  <p className="text-slate-300 font-bold text-base">{maskAmount(debt.paid_amount, false)}</p>
                  <p className="text-xs text-slate-500">pagado</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {progress !== null && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>{pct}% completado</span>
              <span>{maskAmount(debt.paid_amount, false)} de {maskAmount(debt.total_amount!, false)}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Next payment row */}
        {pendingEvent && (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isOverdue ? 'bg-red-500/10' : 'bg-slate-700/50'}`}>
            {isOverdue
              ? <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
              : <Calendar size={12} className="text-slate-500 flex-shrink-0" />}
            <span className={`text-xs font-medium ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
              {due?.label}
            </span>
            <span className="ml-auto text-xs text-slate-500">{maskAmount(pendingEvent.amount, false)}</span>
          </div>
        )}

        {!pendingEvent && debt.status === 'active' && debt.frequency === 'once' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 rounded-xl px-3 py-2">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="text-xs text-emerald-400">Pago registrado</span>
          </div>
        )}
      </button>
    </div>
  )
}
