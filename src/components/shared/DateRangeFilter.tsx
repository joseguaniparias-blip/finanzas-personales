import { useState } from 'react'
import { Calendar, X } from 'lucide-react'
import {
  todayISO, addDaysISO,
  startOfWeekISO, endOfWeekISO,
  startOfMonthISO, endOfMonthISO,
} from '@/lib/date'

export interface DateRange {
  from: string         // YYYY-MM-DD
  to: string           // YYYY-MM-DD
  label: string        // human label for the period
  preset: PresetKey    // which preset is active (or 'custom')
}

export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30'
  | 'custom'

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
  /** Which presets to expose. Default = all. */
  presets?: PresetKey[]
}

const PRESET_LABELS: Record<PresetKey, string> = {
  today:      'Hoy',
  yesterday:  'Ayer',
  this_week:  'Esta semana',
  last_week:  'Semana pasada',
  this_month: 'Este mes',
  last_month: 'Mes pasado',
  last_30:    'Últimos 30',
  custom:     'Personalizado',
}

const DEFAULT_PRESETS: PresetKey[] = [
  'today', 'yesterday', 'this_week', 'last_week',
  'this_month', 'last_month', 'last_30', 'custom',
]

export function buildPreset(preset: Exclude<PresetKey, 'custom'>): DateRange {
  const t = todayISO()
  switch (preset) {
    case 'today':      return { preset, from: t, to: t, label: 'Hoy' }
    case 'yesterday':  {
      const y = addDaysISO(t, -1)
      return { preset, from: y, to: y, label: 'Ayer' }
    }
    case 'this_week':  return { preset, from: startOfWeekISO(t), to: endOfWeekISO(t), label: 'Esta semana' }
    case 'last_week':  {
      const ref = addDaysISO(startOfWeekISO(t), -1) // last Sunday → in prior week
      return { preset, from: startOfWeekISO(ref), to: endOfWeekISO(ref), label: 'Semana pasada' }
    }
    case 'this_month': return { preset, from: startOfMonthISO(t), to: endOfMonthISO(t), label: 'Este mes' }
    case 'last_month': {
      const prev = addDaysISO(startOfMonthISO(t), -1) // last day of previous month
      return { preset, from: startOfMonthISO(prev), to: endOfMonthISO(prev), label: 'Mes pasado' }
    }
    case 'last_30':    return { preset, from: addDaysISO(t, -29), to: t, label: 'Últimos 30 días' }
  }
}

export function DateRangeFilter({ value, onChange, presets = DEFAULT_PRESETS }: Props) {
  const [showCustom, setShowCustom] = useState(false)

  const handlePreset = (p: PresetKey) => {
    if (p === 'custom') {
      setShowCustom(true)
      return
    }
    onChange(buildPreset(p))
  }

  return (
    <>
      {/* Horizontally scrolling chip row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {presets.map(p => {
          const active = value.preset === p
          return (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                active
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {p === 'custom' && <Calendar size={12} />}
              {PRESET_LABELS[p]}
            </button>
          )
        })}
      </div>

      {/* Active range summary (only for custom — presets are self-evident) */}
      {value.preset === 'custom' && (
        <p className="text-xs text-slate-400 mt-2">{value.from} → {value.to}</p>
      )}

      {showCustom && (
        <CustomRangeSheet
          initial={value}
          onApply={r => { onChange(r); setShowCustom(false) }}
          onClose={() => setShowCustom(false)}
        />
      )}
    </>
  )
}

function CustomRangeSheet({ initial, onApply, onClose }: {
  initial: DateRange
  onApply: (r: DateRange) => void
  onClose: () => void
}) {
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const valid = from && to && from <= to

  const apply = () => {
    if (!valid) return
    onApply({ preset: 'custom', from, to, label: `${from} → ${to}` })
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 px-6 pt-6 pb-8" style={{ maxHeight: '90dvh' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-slate-100 font-semibold text-sm">Rango personalizado</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Desde</label>
            <input type="date" value={from} max={to || undefined}
              onChange={e => setFrom(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hasta</label>
            <input type="date" value={to} min={from || undefined}
              onChange={e => setTo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <button onClick={apply} disabled={!valid}
          className="w-full mt-6 bg-accent disabled:opacity-40 hover:bg-accent-strong text-on-accent py-3 rounded-xl font-semibold text-sm transition-colors">
          Aplicar
        </button>
      </div>
    </div>
  )
}
