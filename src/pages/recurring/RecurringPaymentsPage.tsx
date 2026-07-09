import { useState } from 'react'
import { Plus, Repeat, Pencil, Calendar, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react'
import { useRecurringPayments } from '@/hooks/useRecurringPayments'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { usePockets } from '@/hooks/usePockets'
import { useCategories } from '@/hooks/useCategories'
import { RecurringPaymentForm } from './RecurringPaymentForm'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { RecurringPayment, ScheduledEvent } from '@/types'
import { todayISO, addDaysISO } from '@/lib/date'

interface Props { userId: string }

function formatDueDate(iso: string, today: string): { label: string; overdue: boolean } {
  if (iso < today) return { label: `Vencido ${formatShort(iso)}`, overdue: true }
  if (iso === today) return { label: 'Vence hoy', overdue: true }
  if (iso === addDaysISO(today, 1)) return { label: 'Mañana', overdue: false }
  return { label: formatShort(iso), overdue: false }
}

function formatShort(iso: string): string {
  const [, m, d] = iso.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${Number(d)} ${months[Number(m) - 1]}`
}

function freqLabel(p: RecurringPayment): string {
  if (p.frequency === 'weekly')  return 'Semanal'
  if (p.frequency === 'monthly') return 'Mensual'
  return 'Anual'
}

export function RecurringPaymentsPage({ userId }: Props) {
  const { payments, loading, addPayment, updatePayment, closePayment } = useRecurringPayments(userId)
  const { pockets } = usePockets(userId)
  const { categories } = useCategories(userId)
  const { events, confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent } = useScheduledEvents(userId)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecurringPayment | null>(null)
  const [selected, setSelected] = useState<RecurringPayment | null>(null)
  const [confirmingEvent, setConfirmingEvent] = useState<ScheduledEvent | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm || editing) {
    return (
      <RecurringPaymentForm
        userId={userId} pockets={pockets} categories={categories}
        initial={editing ?? undefined}
        onSave={async (data, firstDueDate) => {
          if (editing) { await updatePayment(editing.id, data); setEditing(null) }
          else { await addPayment(data, firstDueDate); setShowForm(false) }
        }}
        onCancel={() => { setShowForm(false); setEditing(null) }}
      />
    )
  }

  if (selected) {
    const pendingEvent = events.find(e => e.reference_id === selected.id && e.status === 'pending') ?? null
    const sourcePocket = pockets.find(p => p.id === selected.source_pocket_id)
    const category = categories.find(c => c.id === selected.category_id)

    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelected(null)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-slate-100 text-lg font-bold flex items-center gap-2">
              <span>{selected.icon}</span> {selected.name}
            </h2>
            <p className="text-slate-400 text-xs">{freqLabel(selected)} · {selected.is_variable ? 'Monto variable' : 'Monto fijo'}</p>
          </div>
          <button onClick={() => setEditing(selected)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <Pencil size={16} />
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5 space-y-3">
          <Row label={selected.is_variable ? 'Monto base' : 'Monto'} value={maskAmount(selected.amount, false)} />
          <Row label="Frecuencia" value={freqLabel(selected)} />
          {sourcePocket && <Row label="Bolsillo origen" value={`${sourcePocket.icon} ${sourcePocket.name}`} />}
          {category && <Row label="Categoría" value={`${category.icon} ${category.name}`} />}
        </div>

        {pendingEvent && (
          <div className={`rounded-xl p-4 mb-5 border ${pendingEvent.due_date <= todayISO() ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
            <p className={`text-xs font-medium mb-3 ${pendingEvent.due_date <= todayISO() ? 'text-red-400' : 'text-slate-400'}`}>
              {pendingEvent.due_date <= todayISO() ? '⚠️ Pago pendiente' : `📅 Próximo pago · ${pendingEvent.due_date}`}
            </p>
            <p className="text-slate-200 font-bold text-lg mb-4">{maskAmount(pendingEvent.amount, false)}</p>
            <button onClick={() => setConfirmingEvent(pendingEvent)}
              className="w-full bg-accent hover:bg-accent-strong text-on-accent py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Registrar pago
            </button>
          </div>
        )}

        <button onClick={async () => { await closePayment(selected.id); setSelected(null) }}
          className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 py-2.5 rounded-xl text-xs transition-colors">
          <Trash2 size={12} /> Eliminar pago recurrente
        </button>

        {confirmingEvent && (
          <ConfirmEventSheet
            event={confirmingEvent}
            label={selected.name}
            icon={selected.icon}
            pockets={pockets.filter(p => p.type !== 'platform')}
            defaultPocketId={selected.source_pocket_id}
            onConfirm={async pocketId => { await confirmEvent(confirmingEvent.id, pocketId); setConfirmingEvent(null) }}
            onPartial={async (pocketId, amount) => { await partialEvent(confirmingEvent.id, pocketId, amount); setConfirmingEvent(null) }}
            onPostpone={() => { postponeEvent(confirmingEvent.id); setConfirmingEvent(null) }}
            onReschedule={async newDate => { await rescheduleEvent(confirmingEvent.id, newDate); setConfirmingEvent(null) }}
            onDelete={async () => { await deleteEvent(confirmingEvent.id); setConfirmingEvent(null) }}
            onClose={() => setConfirmingEvent(null)}
          />
        )}
      </div>
    )
  }

  const today = todayISO()
  const totalMonthly = payments
    .filter(p => p.frequency === 'monthly')
    .reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <PageHeader
        title="Pagos recurrentes"
        right={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-strong text-on-accent px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
            <Plus size={14} /> Nuevo
          </button>
        }
      />

      {payments.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-5 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total mensual</p>
          <p className="text-3xl font-bold text-blue-400">{maskAmount(totalMonthly, false)}</p>
          <p className="text-xs text-slate-400 mt-1">{payments.length} pago{payments.length !== 1 ? 's' : ''} activo{payments.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Repeat size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Sin pagos recurrentes</p>
          <p className="text-slate-400 text-xs mt-1">Arriendo, servicios, suscripciones…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(p => {
            const pendingEvent = events.find(e => e.reference_id === p.id && e.status === 'pending') ?? null
            const due = pendingEvent ? formatDueDate(pendingEvent.due_date, today) : null
            const isOverdue = due?.overdue ?? false
            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className={`w-full p-4 rounded-2xl border text-left transition-colors ${isOverdue ? 'bg-slate-800 border-red-500/40' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{p.icon}</span>
                      <p className="text-slate-200 font-semibold text-sm truncate">{p.name}</p>
                      {p.is_variable && (
                        <span className="flex-shrink-0 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Variable</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{maskAmount(p.amount, false)} · {freqLabel(p)}</p>
                  </div>
                </div>

                {pendingEvent && (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isOverdue ? 'bg-red-500/10' : 'bg-slate-700/50'}`}>
                    {isOverdue
                      ? <AlertCircle size={12} className="text-red-400" />
                      : <Calendar size={12} className="text-slate-400" />}
                    <span className={`text-xs font-medium ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                      {due?.label}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">{maskAmount(pendingEvent.amount, false)}</span>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-200 font-medium text-right">{value}</span>
    </div>
  )
}
