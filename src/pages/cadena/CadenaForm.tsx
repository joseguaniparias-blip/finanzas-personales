import { useState } from 'react'
import type { Cadena, Pocket } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { DAYS_OF_WEEK } from '@/types'
import { useSubmitLock } from '@/hooks/useSubmitLock'

interface Props {
  userId: string
  pockets: Pocket[]
  initial?: Cadena
  onSave: (data: Omit<Cadena, 'id' | 'created_at' | 'status' | 'current_round'>) => Promise<void>
  onCancel: () => void
}

export function CadenaForm({ userId, pockets, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [participants, setParticipants] = useState(initial?.participants ?? 5)
  const [contribution, setContribution] = useState(initial?.contribution_amount?.toString() ?? '')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>(initial?.frequency ?? 'weekly')
  const [myTurn, setMyTurn] = useState(initial?.my_turn ?? 1)
  const [payoutPocketId, setPayoutPocketId] = useState(initial?.payout_pocket_id ?? pockets[0]?.id ?? '')
  const [sourcePocketId, setSourcePocketId] = useState(initial?.source_pocket_id ?? pockets[0]?.id ?? '')
  const [startedBefore, setStartedBefore] = useState(initial?.started_before_app ?? false)
  const [paidRounds, setPaidRounds] = useState(initial?.paid_rounds ?? 0)
  const { submitting: saving, submit } = useSubmitLock()
  const [triggerDay, setTriggerDay] = useState(1)

  const contributionNum = parseAmount(contribution)
  const canSave = name.trim() && participants >= 2 && contributionNum > 0 && payoutPocketId && sourcePocketId

  const handleSave = () => {
    if (!canSave) return
    submit(async () => {
      await onSave({
        user_id: userId,
        name: name.trim(),
        participants,
        contribution_amount: contributionNum,
        frequency,
        my_turn: myTurn,
        payout_pocket_id: payoutPocketId,
        source_pocket_id: sourcePocketId,
        started_before_app: startedBefore,
        paid_rounds: startedBefore ? paidRounds : 0,
      })
    })
  }

  const nonPlatformPockets = pockets.filter(p => p.type !== 'platform')

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">{initial ? 'Editar cadena' : 'Nueva cadena / cooperativa'}</h2>
        <button onClick={onCancel} className="text-slate-400 text-sm">Cancelar</button>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">Nombre del grupo</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Cadena del trabajo, Cooperativa vecinos…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <div className="mb-5 flex items-center gap-3">
        <span className="text-slate-400 text-sm flex-1">Número de participantes</span>
        <button onClick={() => setParticipants(p => Math.max(2, p - 1))} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">−</button>
        <span className="text-slate-100 font-semibold w-8 text-center">{participants}</span>
        <button onClick={() => setParticipants(p => p + 1)} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">+</button>
      </div>

      <AmountInput label="Aporte por turno" value={contribution} onChange={setContribution} className="mb-5" />

      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Frecuencia</p>
        <div className="grid grid-cols-2 gap-2">
          {(['weekly', 'monthly'] as const).map(f => (
            <button key={f} onClick={() => setFrequency(f)}
              className={`py-2 rounded-xl text-xs font-medium transition-colors border ${frequency === f ? 'bg-violet-600/20 border-violet-500 text-violet-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
              {f === 'weekly' ? 'Semanal' : 'Mensual'}
            </button>
          ))}
        </div>
      </div>

      {frequency === 'weekly' && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">Día de aporte</p>
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <button key={i} onClick={() => setTriggerDay(i)}
                className={`flex-1 py-2 rounded-lg text-xs transition-colors ${triggerDay === i ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{d}</button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 flex items-center gap-3">
        <span className="text-slate-400 text-sm flex-1">Mi turno de cobrar (ronda #)</span>
        <button onClick={() => setMyTurn(t => Math.max(1, t - 1))} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">−</button>
        <span className="text-slate-100 font-semibold w-8 text-center">{myTurn}</span>
        <button onClick={() => setMyTurn(t => Math.min(participants, t + 1))} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">+</button>
      </div>

      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-2">¿De dónde sale el aporte?</p>
        <div className="space-y-1">
          {nonPlatformPockets.map(p => (
            <button key={p.id} onClick={() => setSourcePocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${sourcePocketId === p.id ? 'bg-violet-600/20 border border-violet-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
              <span>{p.icon}</span><span className="flex-1 text-left">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">¿A dónde llega cuando te toca cobrar?</p>
        <div className="space-y-1">
          {nonPlatformPockets.map(p => (
            <button key={p.id} onClick={() => setPayoutPocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${payoutPocketId === p.id ? 'bg-violet-600/20 border border-violet-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
              <span>{p.icon}</span><span className="flex-1 text-left">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">¿Ya tiene rondas pagadas?</p>
            <p className="text-slate-400 text-xs mt-0.5">Cadena iniciada antes de la app</p>
          </div>
          <button onClick={() => setStartedBefore(s => !s)}
            className={`w-11 h-6 rounded-full transition-colors relative ${startedBefore ? 'bg-amber-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${startedBefore ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        {startedBefore && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2">Rondas ya pagadas</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setPaidRounds(r => Math.max(0, r - 1))} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">−</button>
              <span className="text-slate-100 font-semibold w-8 text-center">{paidRounds}</span>
              <button onClick={() => setPaidRounds(r => Math.min(participants - 1, r + 1))} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">+</button>
            </div>
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-violet-600 disabled:opacity-40 hover:bg-violet-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors">
        {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear cadena'}
      </button>
    </div>
  )
}
