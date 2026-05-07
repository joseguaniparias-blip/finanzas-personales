import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, TrendingUp, TrendingDown, CreditCard, HandCoins, PiggyBank, Users, Check } from 'lucide-react'
import { usePockets } from '@/hooks/usePockets'
import { useTransactions } from '@/hooks/useTransactions'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { useUserProfile } from '@/hooks/useUserProfile'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { db } from '@/lib/db'
import type { ScheduledEvent } from '@/types'

interface Props { userId: string }

type Period = 'day' | 'week' | 'month'

const EVENT_META: Record<string, { color: string; icon: string; label: string }> = {
  debt:       { color: 'text-blue-400',    icon: '🔴', label: 'Deuda' },
  collection: { color: 'text-emerald-400', icon: '🟢', label: 'Cobro' },
  saving:     { color: 'text-blue-400',    icon: '💙', label: 'Ahorro' },
  cadena:     { color: 'text-violet-400',  icon: '🟣', label: 'Cadena' },
}

function maskVal(amount: number, hidden: boolean) {
  if (hidden) return '••••••'
  return `$ ${amount.toLocaleString('es-CO')}`
}

function periodDates(period: Period): { from: string; to: string } {
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  if (period === 'day') return { from: to, to }
  if (period === 'week') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    return { from: d.toISOString().slice(0, 10), to }
  }
  return { from: today.toISOString().slice(0, 7) + '-01', to }
}

export function HomePage({ userId }: Props) {
  const { pockets, totalBalance } = usePockets(userId)
  const { transactions } = useTransactions(userId)
  const { todayEvents, confirmEvent, partialEvent, postponeEvent } = useScheduledEvents(userId)
  const { profile, setHidden } = useUserProfile(userId)
  const [period, setPeriod] = useState<Period>('month')
  const [eventNames, setEventNames] = useState<Record<string, string>>({})
  const [confirmingEvent, setConfirmingEvent] = useState<ScheduledEvent | null>(null)

  const hidden = profile?.balance_hidden ?? false

  // Resolve event reference names
  useEffect(() => {
    async function resolveNames() {
      const map: Record<string, string> = {}
      for (const ev of todayEvents) {
        if (ev.type === 'debt') {
          const d = await db.debts.get(ev.reference_id)
          if (d) map[ev.id] = d.name
        } else if (ev.type === 'collection') {
          const c = await db.collections.get(ev.reference_id)
          if (c) map[ev.id] = `${c.name} · ${c.person_name}`
        } else if (ev.type === 'saving') {
          const g = await db.saving_goals.get(ev.reference_id)
          if (g) map[ev.id] = g.name
        } else if (ev.type === 'cadena') {
          const ca = await db.cadenas.get(ev.reference_id)
          if (ca) map[ev.id] = ca.name
        }
      }
      setEventNames(map)
    }
    if (todayEvents.length > 0) resolveNames()
  }, [todayEvents])

  // Period income/expense from transactions
  const { from, to } = periodDates(period)
  const periodTxs = transactions.filter(t => t.date >= from && t.date <= to)
  const income  = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const periodLabel = period === 'day' ? 'hoy' : period === 'week' ? 'esta semana' : 'este mes'

  const nonPlatformPockets = pockets.filter(p => p.type !== 'platform')

  return (
    <div className="p-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-slate-500 text-xs">Bienvenido</p>
          <h1 className="text-slate-100 text-xl font-bold">{profile?.name ?? '…'}</h1>
        </div>
        <button onClick={() => setHidden(!hidden)}
          className="p-2.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-4 border border-slate-700">
        <p className="text-xs text-slate-400 mb-1">SALDO TOTAL</p>
        <p className="text-3xl font-bold text-slate-100 mb-4">{maskVal(totalBalance, hidden)}</p>

        {/* Period filter */}
        <div className="flex gap-1 mb-4">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-400'}`}>
              {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-600/10 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-0.5">↑ Ingresos</p>
            <p className="text-emerald-400 font-bold text-sm">{maskVal(income, hidden)}</p>
          </div>
          <div className="bg-red-600/10 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-0.5">↓ Gastos</p>
            <p className="text-red-400 font-bold text-sm">{maskVal(expense, hidden)}</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-2 text-right">Movimientos {periodLabel}</p>
      </div>

      {/* Bolsillos mini */}
      {nonPlatformPockets.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {nonPlatformPockets.map(p => (
            <Link key={p.id} to="/bolsillos"
              className="flex-shrink-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 min-w-[100px]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{p.icon}</span>
                <span className="text-xs text-slate-400 truncate">{p.name}</span>
              </div>
              <p className="text-slate-200 font-semibold text-xs">{maskVal(p.balance, hidden)}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Agenda hoy */}
      {todayEvents.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Pendiente hoy</p>
          <div className="space-y-2">
            {todayEvents.map(ev => {
              const meta = EVENT_META[ev.type] ?? { color: 'text-slate-400', icon: '📋', label: ev.type }
              const name = eventNames[ev.id] ?? '…'
              return (
                <div key={ev.id}
                  className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
                  <span className="text-lg">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-slate-500">{meta.label}</p>
                  </div>
                  <div className="text-right mr-2">
                    <p className={`${meta.color} font-bold text-sm`}>{maskVal(ev.amount, hidden)}</p>
                  </div>
                  <button onClick={() => setConfirmingEvent(ev)}
                    className="flex-shrink-0 flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    <Check size={12} /> Confirmar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modules grid */}
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Módulos</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { to: '/ingresos', icon: TrendingUp,  label: 'Ingresos', color: 'emerald' },
          { to: '/gastos',   icon: TrendingDown, label: 'Gastos',  color: 'red' },
          { to: '/deudas',   icon: CreditCard,   label: 'Deudas',  color: 'blue' },
          { to: '/cobros',   icon: HandCoins,    label: 'Cobros',  color: 'emerald' },
          { to: '/ahorros',  icon: PiggyBank,    label: 'Ahorros', color: 'blue' },
          { to: '/cadena',   icon: Users,        label: 'Cadena',  color: 'violet' },
        ].map(m => (
          <Link key={m.to} to={m.to}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-${m.color}-600/20 bg-${m.color}-600/5 hover:bg-${m.color}-600/10 transition-colors`}>
            <m.icon size={18} className={`text-${m.color}-400`} />
            <p className={`text-${m.color}-400 text-xs font-medium`}>{m.label}</p>
          </Link>
        ))}
      </div>

      {/* Confirm sheet */}
      {confirmingEvent && (
        <ConfirmEventSheet
          event={confirmingEvent}
          label={eventNames[confirmingEvent.id] ?? ''}
          icon={EVENT_META[confirmingEvent.type]?.icon ?? '📋'}
          pockets={nonPlatformPockets}
          defaultPocketId={nonPlatformPockets[0]?.id ?? ''}
          onConfirm={async pocketId => { await confirmEvent(confirmingEvent.id, pocketId); setConfirmingEvent(null) }}
          onPartial={async (pocketId, amount) => { await partialEvent(confirmingEvent.id, pocketId, amount); setConfirmingEvent(null) }}
          onPostpone={() => { postponeEvent(confirmingEvent.id); setConfirmingEvent(null) }}
          onClose={() => setConfirmingEvent(null)}
        />
      )}
    </div>
  )
}
