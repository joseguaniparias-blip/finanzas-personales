import { useState } from 'react'
import type { RecurringPayment, RecurringFrequency, Pocket, Category } from '@/types'
import { DAYS_OF_WEEK } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { useSubmitLock } from '@/hooks/useSubmitLock'

interface Props {
  userId: string
  pockets: Pocket[]
  categories: Category[]
  initial?: RecurringPayment
  onSave: (data: Omit<RecurringPayment, 'id' | 'created_at' | 'is_active'>, firstDueDate?: string) => Promise<void>
  onCancel: () => void
}

const ICONS = ['📦','🏠','💡','📱','🎓','🎬','🍿','💧','📶','🚗','🛡️','💳','📰','🏥','💼']
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function RecurringPaymentForm({ userId, pockets, categories, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '📦')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [isVariable, setIsVariable] = useState(initial?.is_variable ?? false)
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? 'monthly')
  const [triggerDay, setTriggerDay] = useState(initial?.trigger_day ?? 1)
  const [yearMonth, setYearMonth] = useState(initial && initial.frequency === 'yearly' ? Math.floor(initial.trigger_day / 100) : 1)
  const [yearDay, setYearDay] = useState(initial && initial.frequency === 'yearly' ? (initial.trigger_day % 100) : 1)
  const [sourcePocketId, setSourcePocketId] = useState(initial?.source_pocket_id ?? pockets.find(p => p.type !== 'platform')?.id ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [firstDueDate, setFirstDueDate] = useState('')
  const { submitting: saving, submit } = useSubmitLock()

  const expenseCategories = categories.filter(c => (c.kind ?? 'expense') === 'expense')

  const amountNum = parseAmount(amount)
  const canSave = name.trim() && amountNum >= 0 && sourcePocketId

  const handleSave = () => {
    if (!canSave) return
    const finalTriggerDay = frequency === 'yearly' ? yearMonth * 100 + yearDay : triggerDay
    submit(async () => {
      await onSave({
        user_id: userId,
        name: name.trim(),
        icon,
        amount: amountNum,
        is_variable: isVariable,
        frequency,
        trigger_day: finalTriggerDay,
        source_pocket_id: sourcePocketId,
        category_id: categoryId || null,
      }, firstDueDate || undefined)
    })
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">{initial ? 'Editar pago' : 'Nuevo pago recurrente'}</h2>
        <button onClick={onCancel} className="text-slate-400 text-sm">Cancelar</button>
      </div>

      {/* Name + icon */}
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">Nombre</label>
        <div className="flex gap-2">
          <select value={icon} onChange={e => setIcon(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-3 text-slate-100 text-base focus:outline-none focus:border-blue-500">
            {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Arriendo, Netflix, Luz…"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      {/* Variable toggle */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">¿Monto variable?</p>
            <p className="text-slate-400 text-xs mt-0.5">Activa si cambia cada período (ej: servicios públicos)</p>
          </div>
          <button onClick={() => setIsVariable(v => !v)}
            className={`w-11 h-6 rounded-full transition-colors relative ${isVariable ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${isVariable ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <AmountInput
        label={isVariable ? 'Monto base (sugerencia)' : 'Monto'}
        value={amount} onChange={setAmount} className="mb-5"
      />

      {/* Frequency */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Frecuencia</p>
        <div className="grid grid-cols-3 gap-2">
          {(['weekly', 'monthly', 'yearly'] as RecurringFrequency[]).map(f => (
            <button key={f} onClick={() => setFrequency(f)}
              className={`py-2 rounded-xl text-xs font-medium transition-colors border ${frequency === f ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
              {f === 'weekly' ? 'Semanal' : f === 'monthly' ? 'Mensual' : 'Anual'}
            </button>
          ))}
        </div>
      </div>

      {/* Trigger day */}
      {frequency === 'weekly' && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">Día de la semana</p>
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <button key={i} onClick={() => setTriggerDay(i)}
                className={`flex-1 py-2 rounded-lg text-xs transition-colors ${triggerDay === i ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{d}</button>
            ))}
          </div>
        </div>
      )}
      {frequency === 'monthly' && (
        <div className="mb-5 flex items-center gap-3">
          <span className="text-slate-400 text-sm">Día</span>
          <input type="number" min={1} max={28} value={triggerDay} onChange={e => setTriggerDay(Number(e.target.value))}
            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-blue-500" />
          <span className="text-slate-400 text-sm">de cada mes</span>
        </div>
      )}
      {frequency === 'yearly' && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">Fecha del año</p>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={28} value={yearDay} onChange={e => setYearDay(Number(e.target.value))}
              className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-blue-500" />
            <select value={yearMonth} onChange={e => setYearMonth(Number(e.target.value))}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500">
              {MONTHS_SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Source pocket */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">¿De qué bolsillo sale el pago?</p>
        <div className="space-y-1">
          {pockets.filter(p => p.type !== 'platform').map(p => (
            <button key={p.id} onClick={() => setSourcePocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${sourcePocketId === p.id ? 'bg-blue-600/20 border border-blue-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
              <span>{p.icon}</span><span className="flex-1 text-left">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category (optional) */}
      {expenseCategories.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">Categoría (opcional)</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setCategoryId('')}
              className={`py-2 rounded-xl text-xs transition-colors border ${!categoryId ? 'bg-slate-600 border-slate-500 text-slate-200' : 'border-slate-700 text-slate-400'}`}>
              Sin categoría
            </button>
            {expenseCategories.map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                className={`py-2 rounded-xl text-xs transition-colors border flex flex-col items-center gap-0.5 ${categoryId === c.id ? 'bg-blue-600/20 border-blue-500 text-slate-200' : 'border-slate-700 text-slate-400'}`}>
                <span>{c.icon}</span>
                <span className="truncate w-full text-center px-1">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Optional first due date */}
      {!initial && (
        <div className="mb-6">
          <label className="block text-xs text-slate-400 mb-1">Primer vencimiento (opcional)</label>
          <input type="date" value={firstDueDate} onChange={e => setFirstDueDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
          <p className="text-xs text-slate-400 mt-1">Si lo dejas vacío, se agenda la próxima fecha según la frecuencia.</p>
        </div>
      )}

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors">
        {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear pago recurrente'}
      </button>
    </div>
  )
}
