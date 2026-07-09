import { useState } from 'react'
import { PLATFORM_DEFAULTS } from '@/types'

interface Props { initial: string[]; onNext: (platforms: string[]) => void; onBack: () => void }

const ALL_PLATFORMS = Object.keys(PLATFORM_DEFAULTS)

export function Step2Platforms({ initial, onNext, onBack }: Props) {
  const [selected, setSelected] = useState<string[]>(initial)

  const toggle = (p: string) =>
    setSelected(s => s.includes(p) ? s.filter(x => x !== p) : [...s, p])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">📲</div>
        <h2 className="text-xl font-bold text-slate-100">¿En qué plataformas trabajas?</h2>
        <p className="text-slate-400 text-sm mt-1">Selecciona todas las que apliquen</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ALL_PLATFORMS.map(p => {
          const def = PLATFORM_DEFAULTS[p]
          const on = selected.includes(p)
          return (
            <button key={p} onClick={() => toggle(p)}
              className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${on ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
              <span className="text-xl">{def.icon}</span>
              <span style={{ color: on ? def.color : undefined }}>{p}</span>
            </button>
          )
        })}
        <button className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-slate-600 text-slate-400 text-sm">
          <span>➕</span> Otra
        </button>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => selected.length > 0 && onNext(selected)} disabled={selected.length === 0}
          className="flex-2 bg-blue-600 disabled:opacity-40 text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
