import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, TrendingUp, TrendingDown, CreditCard, HandCoins, PiggyBank, Users, Check, Settings, ChevronRight, X, Wallet, ArrowRight, Calendar, Repeat } from 'lucide-react'
import { usePockets } from '@/hooks/usePockets'
import { useTransactions } from '@/hooks/useTransactions'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePlatforms } from '@/hooks/usePlatforms'
import { useToday } from '@/hooks/useToday'
import { ConfirmEventSheet } from '@/components/shared/ConfirmEventSheet'
import { db } from '@/lib/db'
import type { ScheduledEvent, Platform, Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { toISODate } from '@/lib/date'

interface Props { userId: string }

type BalancePeriod = 'day' | 'week' | 'month'
type AgendaPeriod  = 'day' | 'week' | 'month' | 'specific'

const EVENT_META: Record<string, { color: string; icon: string; label: string }> = {
  debt:            { color: 'text-red-400',    icon: '🔴', label: 'Deuda' },
  collection:      { color: 'text-emerald-400', icon: '🟢', label: 'Cobro' },
  saving:          { color: 'text-blue-400',   icon: '💙', label: 'Ahorro' },
  cadena:          { color: 'text-violet-400', icon: '🟣', label: 'Cadena' },
  platform_payout: { color: 'text-orange-400', icon: '💰', label: 'Pago plataforma' },
  recurring:       { color: 'text-cyan-400',   icon: '🔁', label: 'Pago recurrente' },
}

const DOT_COLOR: Record<string, string> = {
  debt:            'bg-red-500',
  collection:      'bg-emerald-500',
  saving:          'bg-blue-500',
  cadena:          'bg-violet-500',
  platform_payout: 'bg-orange-500',
  recurring:       'bg-cyan-500',
}

const DAY_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function maskVal(amount: number, hidden: boolean) {
  if (hidden) return '••••••'
  return `$ ${amount.toLocaleString('es-CO')}`
}

function balanceDates(period: BalancePeriod): { from: string; to: string } {
  const today = new Date()
  const to = toISODate(today)
  if (period === 'day') return { from: to, to }
  if (period === 'week') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    return { from: toISODate(d), to }
  }
  return { from: today.toISOString().slice(0, 7) + '-01', to }
}

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHS_LONG  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function periodRangeLabel(period: BalancePeriod, from: string, to: string): string {
  const [ty, tm] = to.split('-')
  if (period === 'day') {
    const [, m, d] = to.split('-')
    return `Hoy · ${Number(d)} ${MONTHS_LONG[Number(m) - 1]} ${ty}`
  }
  if (period === 'month') {
    return `${MONTHS_LONG[Number(tm) - 1]} ${ty}`
  }
  const [, fm, fd] = from.split('-')
  const [, em, ed] = to.split('-')
  const sameMonth = fm === em
  const fromStr = sameMonth ? `${Number(fd)}` : `${Number(fd)} ${MONTHS_SHORT[Number(fm) - 1]}`
  return `${fromStr} – ${Number(ed)} ${MONTHS_SHORT[Number(em) - 1]} ${ty}`
}

function agendaEndDate(period: AgendaPeriod, specificDate: string, today: string): string {
  if (period === 'day') return today
  if (period === 'specific') return specificDate || today
  if (period === 'week') {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + 6)
    return toISODate(d)
  }
  // month: last day of current month
  const t = new Date(today)
  return toISODate(new Date(t.getFullYear(), t.getMonth() + 1, 0))
}

/** 7 ISO date strings starting from today */
function buildWeekDays(today: string): string[] {
  const result: string[] = []
  const base = new Date(today + 'T12:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    result.push(toISODate(d))
  }
  return result
}

function groupByDate(evs: ScheduledEvent[]): { date: string; items: ScheduledEvent[] }[] {
  const map = new Map<string, ScheduledEvent[]>()
  for (const ev of evs) {
    const list = map.get(ev.due_date) ?? []
    list.push(ev)
    map.set(ev.due_date, list)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({ date, items }))
}

function formatAgendaDate(iso: string, today: string): string {
  if (iso === today) return 'Hoy'
  const tomorrow = new Date(today + 'T12:00:00')
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (iso === toISODate(tomorrow)) return 'Mañana'
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]}`
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  days: string[]
  allEvents: ScheduledEvent[]
  selectedDay: string | null
  today: string
  onSelectDay: (date: string | null) => void
}

function MiniCalendar({ days, allEvents, selectedDay, today, onSelectDay }: MiniCalendarProps) {
  return (
    <div className="grid grid-cols-7 gap-1 mb-3 bg-slate-800/60 rounded-xl p-2 border border-slate-700/50">
      {days.map(date => {
        const isToday    = date === today
        const isPast     = date < today
        const isSelected = selectedDay === date
        const dayEvents  = allEvents.filter(e => e.due_date === date)
        const types      = [...new Set(dayEvents.map(e => e.type))].slice(0, 3)
        const dayOfWeek  = new Date(date + 'T12:00:00').getDay()
        const dayNum     = Number(date.split('-')[2])

        return (
          <button
            key={date}
            onClick={() => onSelectDay(isSelected ? null : date)}
            className={`flex flex-col items-center py-2 px-0.5 rounded-lg transition-all ${
              isSelected
                ? 'bg-blue-600 ring-1 ring-blue-500'
                : isToday
                  ? 'bg-slate-700'
                  : 'hover:bg-slate-700/60'
            }`}
          >
            <span className={`text-[9px] font-semibold mb-0.5 uppercase tracking-wide ${
              isSelected ? 'text-blue-200' : isPast ? 'text-slate-600' : 'text-slate-500'
            }`}>
              {DAY_LABELS[dayOfWeek]}
            </span>
            <span className={`text-sm font-bold leading-none mb-1.5 ${
              isSelected
                ? 'text-white'
                : isToday
                  ? 'text-slate-100'
                  : isPast
                    ? 'text-slate-600'
                    : 'text-slate-300'
            }`}>
              {dayNum}
            </span>
            {/* Event type dots */}
            <div className="flex gap-0.5 items-center min-h-[6px]">
              {types.map(type => (
                <div
                  key={type}
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPast ? 'bg-slate-600' : (DOT_COLOR[type] ?? 'bg-slate-500')
                  }`}
                />
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export function HomePage({ userId }: Props) {
  const { pockets, totalBalance } = usePockets(userId)
  const { transactions } = useTransactions(userId)
  const { events, confirmEvent, partialEvent, postponeEvent, rescheduleEvent, deleteEvent } = useScheduledEvents(userId)
  const { profile, setHidden } = useUserProfile(userId)
  const { platforms } = usePlatforms(userId)

  const [balancePeriod, setBalancePeriod] = useState<BalancePeriod>('month')
  const [agendaPeriod, setAgendaPeriod] = useState<AgendaPeriod>('day')
  const [calendarDayFilter, setCalendarDayFilter] = useState<string | null>(null)
  const [specificDate, setSpecificDate] = useState<string>('')
  const [eventNames, setEventNames] = useState<Record<string, string>>({})
  const [confirmingEvent, setConfirmingEvent] = useState<ScheduledEvent | null>(null)
  const [confirmingPayout, setConfirmingPayout] = useState<ScheduledEvent | null>(null)

  const hidden = profile?.balance_hidden ?? false
  // 'today' as YYYY-MM-DD in LOCAL time, auto-refreshing at midnight so the
  // agenda stays correct even if the app stays open across midnight.
  const today = useToday()

  // Init specificDate to today on mount
  useEffect(() => {
    if (!specificDate) setSpecificDate(today)
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  const weekDaysList = buildWeekDays(today)

  // Compute which events to show in agenda.
  // We separate strictly-overdue events (due_date < today) from the "current"
  // agenda so they don't pile up under "Hoy". The overdue section is hidden
  // when the user pinned a specific date (specific view / calendar day filter).
  const agendaEnd = agendaEndDate(agendaPeriod, specificDate || today, today)
  const showOverdueSection = agendaPeriod !== 'specific' && !calendarDayFilter

  const overdueEvents = showOverdueSection
    ? events.filter(e => e.due_date < today)
    : []

  const agendaEvents = events.filter(e => {
    if (agendaPeriod === 'specific') return e.due_date === (specificDate || today)
    if (agendaPeriod === 'week' && calendarDayFilter) return e.due_date === calendarDayFilter
    if (agendaPeriod === 'day') return e.due_date === today
    // week or month: from today (inclusive) to agendaEnd
    return e.due_date >= today && e.due_date <= agendaEnd
  })
  const groupedAgenda = groupByDate(agendaEvents)
  const groupedOverdue = groupByDate(overdueEvents)

  // Switch period and reset mini-calendar filter
  const handleAgendaPeriodChange = (p: AgendaPeriod) => {
    setAgendaPeriod(p)
    setCalendarDayFilter(null)
  }

  // Resolve display names for all events
  useEffect(() => {
    async function resolveNames() {
      const map: Record<string, string> = {}
      for (const ev of events) {
        if (map[ev.id]) continue
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
        } else if (ev.type === 'platform_payout') {
          const pl = await db.platforms.get(ev.reference_id)
          if (pl) map[ev.id] = pl.name
        } else if (ev.type === 'recurring') {
          const rp = await db.recurring_payments.get(ev.reference_id)
          if (rp) map[ev.id] = rp.name
        }
      }
      setEventNames(map)
    }
    if (events.length > 0) resolveNames()
  }, [events])

  // Balance period income/expense
  const { from, to } = balanceDates(balancePeriod)
  const periodTxs = transactions.filter(t => t.date >= from && t.date <= to)
  const income  = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const nonPlatformPockets = pockets.filter(p => p.type !== 'platform')
  // Show a platform card if the wallet has any balance OR there's a pending payout event for it
  const platformPockets    = pockets.filter(p => {
    if (p.type !== 'platform') return false
    if (p.balance !== 0) return true
    return events.some(e => e.type === 'platform_payout' && e.reference_id === p.platform_id && e.status === 'pending')
  })

  const emptyLabel =
    agendaPeriod === 'day'      ? ' hoy'
    : agendaPeriod === 'specific' ? ''
    : agendaPeriod === 'week' && calendarDayFilter
      ? ` el ${formatAgendaDate(calendarDayFilter, today).toLowerCase()}`
    : agendaPeriod === 'week'   ? ' esta semana'
    : ' este mes'

  // Renders one event card. `isOverdue` lets us style overdue payouts/events
  // a bit dimmer without re-implementing the whole card. The card is always
  // confirmable when its date is <= today (the user can still act on overdue).
  function renderEventCard(ev: ScheduledEvent, isOverdue: boolean) {
    const meta = EVENT_META[ev.type] ?? { color: 'text-slate-400', icon: '📋', label: ev.type }
    const name = eventNames[ev.id] ?? '…'
    const canConfirm = ev.due_date <= today

    if (ev.type === 'platform_payout') {
      if (ev.amount <= 0) return null
      const balance = ev.amount
      return (
        <button key={ev.id} onClick={() => setConfirmingPayout(ev)}
          className={`w-full text-left flex items-center gap-3 rounded-xl p-3 border transition-colors ${
            isOverdue
              ? 'bg-orange-500/10 border-orange-500/40 hover:bg-orange-500/15'
              : 'bg-orange-500/5 border-orange-500/25 hover:bg-orange-500/10'
          }`}>
          <span className="text-lg leading-none">💰</span>
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-orange-400">Transferir {maskVal(balance, hidden)}</p>
          </div>
          {canConfirm ? (
            <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-500/20 text-orange-300">
              <Check size={12} /> Cobrar
            </span>
          ) : (
            <span className="flex-shrink-0 text-xs text-slate-500">Ver →</span>
          )}
        </button>
      )
    }

    return (
      <div key={ev.id}
        className={`flex items-center gap-3 rounded-xl p-3 border ${
          isOverdue ? 'bg-slate-800/80 border-red-900/40' : 'bg-slate-800 border-slate-700'
        }`}>
        <span className="text-lg leading-none">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-200 text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-slate-500">{meta.label}</p>
        </div>
        <div className="text-right mr-2">
          <p className={`${meta.color} font-bold text-sm`}>{maskVal(ev.amount, hidden)}</p>
        </div>
        {canConfirm && (
          <button onClick={() => setConfirmingEvent(ev)}
            className="flex-shrink-0 flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <Check size={12} /> Ok
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-slate-500 text-xs">Bienvenido</p>
          <h1 className="text-slate-100 text-xl font-bold">{profile?.name ?? '…'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setHidden(!hidden)}
            className="p-2.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <Link to="/configuracion"
            className="p-2.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-4 border border-slate-700">
        <p className="text-xs text-slate-400 mb-1">SALDO TOTAL</p>
        <p className="text-3xl font-bold text-slate-100 mb-4">{maskVal(totalBalance, hidden)}</p>

        {/* Period tabs */}
        <div className="flex gap-1 mb-2">
          {(['day', 'week', 'month'] as BalancePeriod[]).map(p => (
            <button key={p} onClick={() => setBalancePeriod(p)}
              className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${balancePeriod === p ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-400'}`}>
              {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* Date range label */}
        <p className="text-xs text-slate-500 mb-4 text-center tracking-wide">
          📅 {periodRangeLabel(balancePeriod, from, to)}
        </p>

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
      </div>

      {/* Bolsillos mini (efectivo + bancos) */}
      {nonPlatformPockets.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {nonPlatformPockets.map(p => (
            <Link key={p.id} to="/bolsillos"
              className="flex-shrink-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 min-w-[100px]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{p.icon}</span>
                <span className="text-xs text-slate-400 truncate">{p.name}</span>
              </div>
              <p className={`font-semibold text-xs ${p.balance < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                {maskVal(p.balance, hidden)}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Billeteras de plataforma */}
      {platformPockets.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Billeteras plataforma</p>
            <Link to="/bolsillos" className="flex items-center gap-0.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Ver todas <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {platformPockets.map(p => {
              const pendingPayout = events.find(e => e.type === 'platform_payout' && e.reference_id === p.platform_id && e.status === 'pending')
              const isNegative = p.balance < 0
              return (
                <div key={p.id}
                  className={`flex-shrink-0 rounded-xl px-3 py-2 min-w-[130px] border ${isNegative ? 'bg-red-600/5 border-red-600/30' : 'bg-orange-600/5 border-orange-600/20'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{p.icon}</span>
                    <span className="text-xs text-slate-400 truncate">{p.name}</span>
                  </div>
                  <p className={`font-semibold text-xs ${isNegative ? 'text-red-400' : 'text-orange-400'}`}>
                    {maskVal(p.balance, hidden)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">esta semana</p>
                  {pendingPayout ? (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-700/50">
                      <p className="text-emerald-400 font-semibold text-xs">{maskVal(pendingPayout.amount, hidden)}</p>
                      <p className="text-[10px] text-slate-500">por cobrar {formatShortDate(pendingPayout.due_date)}</p>
                    </div>
                  ) : p.balance > 0 ? (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-700/50">
                      <p className="text-[10px] text-slate-400 font-medium">Saldo pendiente por cobrar</p>
                      <p className="text-[10px] text-slate-500">Cierra el domingo</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Agenda / Calendario */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Agenda</p>
          <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
            {(['day', 'week', 'month'] as AgendaPeriod[]).map(p => (
              <button key={p} onClick={() => handleAgendaPeriodChange(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${agendaPeriod === p ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-400'}`}>
                {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
            {/* Fecha específica */}
            <button
              onClick={() => handleAgendaPeriodChange('specific')}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center ${agendaPeriod === 'specific' ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-400'}`}
              title="Fecha específica"
            >
              <Calendar size={11} />
            </button>
          </div>
        </div>

        {/* Mini-calendar — only for week view */}
        {agendaPeriod === 'week' && (
          <MiniCalendar
            days={weekDaysList}
            allEvents={events.filter(e => weekDaysList.includes(e.due_date))}
            selectedDay={calendarDayFilter}
            today={today}
            onSelectDay={setCalendarDayFilter}
          />
        )}

        {/* Date picker — only for specific view */}
        {agendaPeriod === 'specific' && (
          <div className="mb-3">
            <input
              type="date"
              value={specificDate}
              onChange={e => setSpecificDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
            />
          </div>
        )}

        {/* Events list */}
        {agendaEvents.length === 0 && overdueEvents.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
            <p className="text-slate-500 text-sm">Sin eventos{emptyLabel} 🎉</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Overdue section (only when there are overdue events and we're not pinned to a specific date) */}
            {groupedOverdue.length > 0 && (
              <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                    ⚠️ Vencidos
                    <span className="text-[10px] text-red-500 font-normal normal-case">
                      ({overdueEvents.length})
                    </span>
                  </p>
                </div>
                {groupedOverdue.map(({ date, items }) => (
                  <div key={date}>
                    <p className="text-[10px] font-semibold mb-1.5 text-red-500/80">
                      {formatAgendaDate(date, today)}
                    </p>
                    <div className="space-y-2">
                      {items.map(ev => renderEventCard(ev, true))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current / upcoming agenda */}
            {groupedAgenda.length > 0 && (
              <div className="space-y-4">
                {groupedAgenda.map(({ date, items }) => {
                  const isToday = date === today
                  return (
                    <div key={date}>
                      <p className={`text-xs font-semibold mb-1.5 ${isToday ? 'text-slate-300' : 'text-slate-500'}`}>
                        {formatAgendaDate(date, today)}
                      </p>
                      <div className="space-y-2">
                        {items.map(ev => renderEventCard(ev, false))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
          { to: '/recurrentes', icon: Repeat,    label: 'Recurrentes', color: 'cyan' },
        ].map(m => (
          <Link key={m.to} to={m.to}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-${m.color}-600/20 bg-${m.color}-600/5 hover:bg-${m.color}-600/10 transition-colors`}>
            <m.icon size={18} className={`text-${m.color}-400`} />
            <p className={`text-${m.color}-400 text-xs font-medium`}>{m.label}</p>
          </Link>
        ))}
      </div>

      {/* Platform payout sheet */}
      {confirmingPayout && (
        <PlatformPayoutSheet
          event={confirmingPayout}
          platforms={platforms}
          pockets={pockets}
          onConfirm={async pocketId => { await confirmEvent(confirmingPayout.id, pocketId); setConfirmingPayout(null) }}
          onPostpone={() => { postponeEvent(confirmingPayout.id); setConfirmingPayout(null) }}
          onDelete={async () => { await deleteEvent(confirmingPayout.id); setConfirmingPayout(null) }}
          onEditAmount={async newAmount => {
            // Reconciliation: any delta between old event.amount and newAmount
            // moves in/out of the platform wallet so total money is preserved.
            const oldAmount = confirmingPayout.amount
            const delta = newAmount - oldAmount   // positive → event grows, pocket shrinks
            const wallet = pockets.find(p => p.platform_id === confirmingPayout.reference_id)
            await db.transaction('rw', db.scheduled_events, db.pockets, async () => {
              await db.scheduled_events.update(confirmingPayout.id, { amount: newAmount })
              if (wallet) {
                const fresh = await db.pockets.get(wallet.id)
                if (fresh) await db.pockets.update(wallet.id, { balance: fresh.balance - delta })
              }
            })
            setConfirmingPayout(null)
          }}
          onClose={() => setConfirmingPayout(null)}
        />
      )}

      {/* Generic confirm sheet */}
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
          onReschedule={async newDate => { await rescheduleEvent(confirmingEvent.id, newDate); setConfirmingEvent(null) }}
          onDelete={async () => { await deleteEvent(confirmingEvent.id); setConfirmingEvent(null) }}
          onClose={() => setConfirmingEvent(null)}
        />
      )}
    </div>
  )
}

// ─── Platform Payout Sheet ────────────────────────────────────────────────────

interface PayoutSheetProps {
  event: ScheduledEvent
  platforms: Platform[]
  pockets: Pocket[]
  onConfirm: (pocketId: string) => void
  onPostpone: () => void
  onDelete: () => void
  onEditAmount: (newAmount: number) => Promise<void>
  onClose: () => void
}

function PlatformPayoutSheet({ event, platforms, pockets, onConfirm, onPostpone, onDelete, onEditAmount, onClose }: PayoutSheetProps) {
  const platform = platforms.find(p => p.id === event.reference_id)
  const walletPocket = pockets.find(p => p.platform_id === event.reference_id)
  const payoutPocket = pockets.find(p => p.id === platform?.payout_pocket_id)
  const fallbackPocket = pockets.find(p => p.type !== 'platform')

  // IMPORTANT: use event.amount (locked in at weekly close), NOT the platform
  // pocket's current balance — that balance is the IN-PROGRESS new week's
  // earnings, not what's being paid out today.
  const amount = event.amount
  const willTransfer = amount > 0
  const targetPocket = payoutPocket ?? fallbackPocket

  const [editingAmount, setEditingAmount] = useState(false)
  const [editValue, setEditValue] = useState(amount.toString())
  const [savingEdit, setSavingEdit] = useState(false)

  const handleConfirm = () => onConfirm(targetPocket?.id ?? '')

  const saveEdit = async () => {
    const newAmount = Number(editValue.replace(/[^0-9.-]/g, ''))
    if (isNaN(newAmount) || newAmount < 0) return
    setSavingEdit(true)
    try {
      await onEditAmount(newAmount)
    } finally {
      setSavingEdit(false)
      setEditingAmount(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 px-6 pt-6 pb-8 overflow-y-auto overscroll-contain" style={{ maxHeight: '90dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Wallet size={18} className="text-orange-400" />
            </div>
            <div>
              <p className="text-slate-100 font-semibold text-sm">Día de pago · {platform?.name ?? 'Plataforma'}</p>
              <p className="text-xs text-slate-500">Cierre de período semanal</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Balance summary */}
        <div className={`rounded-2xl p-4 mb-5 border ${willTransfer ? 'bg-orange-500/8 border-orange-500/25' : 'bg-slate-800 border-slate-700'}`}>
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Saldo en billetera {platform?.name}</p>
            {!editingAmount && (
              <button onClick={() => { setEditValue(amount.toString()); setEditingAmount(true) }}
                className="text-[10px] text-slate-500 hover:text-orange-300 underline">
                Editar monto
              </button>
            )}
          </div>
          {editingAmount ? (
            <div className="mt-2">
              <input
                type="number"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                autoFocus
                className="w-full bg-slate-800 border border-orange-500 rounded-lg px-3 py-2 text-slate-100 text-lg font-bold focus:outline-none focus:border-orange-400 mb-2"
              />
              <p className="text-[10px] text-slate-500 mb-2">
                La diferencia con {maskAmount(amount, false)} se ajustará en la billetera {platform?.name} para que no se pierda plata.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setEditingAmount(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-xs">
                  Cancelar
                </button>
                <button onClick={saveEdit} disabled={savingEdit || !editValue}
                  className="flex-1 py-2 rounded-lg bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold">
                  {savingEdit ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className={`text-2xl font-bold mb-1 ${willTransfer ? 'text-orange-400' : 'text-red-400'}`}>
                {maskAmount(amount, false)}
              </p>
              {willTransfer ? (
                <div className="flex items-center gap-1.5 mt-3 text-sm text-slate-300">
                  <span className="text-slate-500 text-xs">Se transferirá</span>
                  <span className="text-orange-300 font-semibold">{maskAmount(amount, false)}</span>
                  <ArrowRight size={12} className="text-slate-500" />
                  <span className="text-xs">{targetPocket?.icon} {targetPocket?.name ?? '–'}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-2">
                  Saldo negativo — se arrastra a la siguiente semana y se descuenta de tus próximos ingresos.
                </p>
              )}
              {walletPocket && (
                <p className="text-[10px] text-slate-500 mt-3">
                  Billetera {platform?.name} esta semana: <span className={walletPocket.balance < 0 ? 'text-red-400' : 'text-slate-400'}>{maskAmount(walletPocket.balance, false)}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Work period info */}
        <div className="bg-slate-800 rounded-xl p-3 mb-5 border border-slate-700">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Período de trabajo</p>
          <p className="text-xs text-slate-400">
            Lo acumulado de lunes a domingo en la billetera <span className="text-slate-200">{platform?.name}</span> se transfiere a tu bolsillo en el día de cobro.
            {!willTransfer && <span className="text-slate-500"> El saldo negativo se arrastra al siguiente período.</span>}
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onPostpone}
            className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm transition-colors">
            Posponer
          </button>
          <button onClick={handleConfirm}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
              willTransfer
                ? 'bg-orange-500 hover:bg-orange-400 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}>
            <Check size={16} />
            {willTransfer ? `Cobrar ${maskAmount(amount, false)}` : 'Cerrar período'}
          </button>
        </div>
        <button onClick={onDelete}
          className="w-full mt-3 flex items-center justify-center gap-2 text-red-500 hover:text-red-400 py-2.5 rounded-xl text-xs transition-colors">
          Eliminar este pendiente
        </button>
      </div>
    </div>
  )
}
