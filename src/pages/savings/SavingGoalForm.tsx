import { useState } from 'react'
import type { SavingGoal, Pocket } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { DAYS_OF_WEEK } from '@/types'
import { useSubmitLock } from '@/hooks/useSubmitLock'

interface Props {
  userId: string
  pockets: Pocket[]
  initial?: SavingGoal
  onSave: (data: Omit<SavingGoal, 'id' | 'created_at' | 'saved_amount' | 'is_active'>) => Promise<void>
  onCancel: () => void
}

export function SavingGoalForm({ userId, pockets, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [hasTarget, setHasTarget] = useState(initial?.target_amount != null)
  const [targetAmount, setTargetAmount] = useState(initial?.target_amount?.toString() ?? '')
  const [contribution, setContribution] = useState(initial?.contribution_amount?.toString() ?? '')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'on_payout'>(initial?.frequency ?? 'monthly')
  const [triggerDay, setTriggerDay] = useState(initial?.trigger_day ?? 1)
  const [sourcePocketId, setSourcePocketId] = useState(initial?.source_pocket_id ?? pockets[0]?.id ?? '')
  const { submitting: saving, submit } = useSubmitLock()

  const targetNum = parseAmount(targetAmount)
  const contributionNum = parseAmount(contribution)
  const canSave = name.trim() && contributionNum > 0 && sourcePocketId && (!hasTarget || targetNum > 0)

  const handleSave = () => {
    if (!canSave) return
    submit(async () => {
      await onSave({
        user_id: userId,
        name: name.trim(),
        target_amount: hasTarget ? targetNum : null,
        contribution_amount: contributionNum,
        contribution_type: 'fixed',
        frequency,
        trigger_day: frequency !== 'on_payout' ? triggerDay : null,
        source_pocket_id: sourcePocketId,
      })
    })
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">{initial ? 'Editar meta' : 'Nueva meta de ahorro'}</h2>
        <button onClick={onCancel} className="text-slate-400 text-sm">Cancelar</button>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">Nombre del ahorro</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Fondo de emergencia, Vacaciones…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">¿Tiene meta de monto?</p>
            <p className="text-slate-400 text-xs mt-0.5">Un total definido a alcanzar</p>
          </div>
          <button onClick={() => setHasTarget(h => !h)}
            className={`w-11 h-6 rounded-full transition-colors relative ${hasTarget ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${hasTarget ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        {hasTarget && <AmountInput label="Meta total" value={targetAmount} onChange={setTargetAmount} className="mt-4" />}
      </div>

      <AmountInput label="Aporte por período" value={contribution} onChange={setContribution} className="mb-5" />

      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Frecuencia</p>
        <div className="grid grid-cols-3 gap-2">
          {(['weekly', 'monthly', 'on_payout'] as const).map(f => (
            <button key={f} onClick={() => setFrequency(f)}
              className={`py-2 rounded-xl text-xs font-medium transition-colors border ${frequency === f ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
              {f === 'weekly' ? 'Semanal' : f === 'monthly' ? 'Mensual' : '💸 Al cobrar'}
            </button>
          ))}
        </div>
      </div>

      {frequency === 'weekly' && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">Día de la semana</p>
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <button key={i} onClick={() => setTriggerDay(i)}
                className={`flex-1 py-2 rounded-lg text-xs transition-colors ${triggerDay === i ? 'bg-accent text-on-accent' : 'bg-slate-800 text-slate-400'}`}>{d}</button>
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

      <div className="mb-6">
        <p className="text-xs text-slate-400 mb-2">¿De qué bolsillo sale el aporte?</p>
        <div className="space-y-1">
          {pockets.filter(p => p.type !== 'platform').map(p => (
            <button key={p.id} onClick={() => setSourcePocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${sourcePocketId === p.id ? 'bg-blue-600/20 border border-blue-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
              <span>{p.icon}</span><span className="flex-1 text-left">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-accent disabled:opacity-40 hover:bg-accent-strong text-on-accent py-4 rounded-xl font-semibold text-sm transition-colors">
        {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear meta'}
      </button>
    </div>
  )
}
