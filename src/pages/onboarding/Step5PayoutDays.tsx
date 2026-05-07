import { useState } from 'react'
import type { PayoutConfig } from '@/types'
import { PLATFORM_DEFAULTS, DAYS_OF_WEEK } from '@/types'

interface Props {
  platforms: string[]
  pocketOptions: Array<{ id: string; name: string }>
  initial: Record<string, PayoutConfig>
  onFinish: (config: Record<string, PayoutConfig>) => void
  onBack: () => void
}

export function Step5PayoutDays({ platforms, pocketOptions, initial, onFinish, onBack }: Props) {
  const [config, setConfig] = useState<Record<string, PayoutConfig>>(
    Object.fromEntries(platforms.map(p => [p, initial[p] ?? { day: 2, pocket_id: pocketOptions[0]?.id ?? '' }]))
  )

  const update = (platform: string, key: keyof PayoutConfig, val: number | string) =>
    setConfig(c => ({ ...c, [platform]: { ...c[platform], [key]: val } }))

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">📅</div>
        <h2 className="text-xl font-bold text-slate-100">Días de pago</h2>
        <p className="text-slate-400 text-sm mt-1">¿Qué día te transfiere cada plataforma?</p>
      </div>
      <div className="space-y-4">
        {platforms.map(name => {
          const def = PLATFORM_DEFAULTS[name] ?? { color: '#94a3b8', icon: '📲' }
          const cfg = config[name]
          return (
            <div key={name} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{def.icon}</span>
                <span className="font-semibold text-sm" style={{ color: def.color }}>{name}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">DÍA DE PAGO</p>
                <div className="flex gap-1.5">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <button key={i} onClick={() => update(name, 'day', i)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${cfg.day === i ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">DEPOSITAR EN</p>
                <select value={cfg.pocket_id} onChange={e => update(name, 'pocket_id', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none">
                  {pocketOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => onFinish(config)}
          className="flex-2 bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl text-sm">
          🚀 ¡Listo! Ir al inicio
        </button>
      </div>
    </div>
  )
}
