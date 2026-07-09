import { useState } from 'react'
import { PLATFORM_DEFAULTS } from '@/types'

interface Props {
  platforms: string[]
  initial: Record<string, number>
  onNext: (balances: Record<string, number>) => void
  onBack: () => void
}

export function Step4PlatformBalances({ platforms, initial, onNext, onBack }: Props) {
  const [balances, setBalances] = useState<Record<string, number>>(initial)

  const update = (name: string, val: string) =>
    setBalances(b => ({ ...b, [name]: parseFloat(val) || 0 }))

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">📊</div>
        <h2 className="text-xl font-bold text-slate-100">Saldo en plataformas</h2>
        <p className="text-slate-400 text-sm mt-1">¿Cuánto tienes acumulado esta semana?</p>
      </div>
      <div className="space-y-3">
        {platforms.map(name => {
          const def = PLATFORM_DEFAULTS[name] ?? { color: '#94a3b8', icon: '📲' }
          return (
            <div key={name} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">{def.icon}</span>
              <span className="flex-1 text-sm font-medium" style={{ color: def.color }}>{name}</span>
              <input type="number" value={balances[name] || ''} onChange={e => update(name, e.target.value)}
                placeholder="$0" min="0"
                className="w-32 bg-slate-900 rounded-lg px-2 py-1.5 text-sm text-emerald-400 text-right focus:outline-none" />
            </div>
          )
        })}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => onNext(balances)}
          className="flex-2 bg-accent text-on-accent font-semibold py-3 px-6 rounded-xl text-sm">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
