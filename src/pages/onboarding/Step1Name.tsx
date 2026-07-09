import { useState } from 'react'

interface Props { initial: string; onNext: (name: string) => void }

export function Step1Name({ initial, onNext }: Props) {
  const [name, setName] = useState(initial)
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">👋</div>
        <h2 className="text-xl font-bold text-slate-100">¡Bienvenido!</h2>
        <p className="text-slate-400 text-sm mt-1">Configura tu app en 5 pasos rápidos</p>
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1 block">TU NOMBRE</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base"
        />
      </div>
      <button onClick={() => name.trim() && onNext(name.trim())} disabled={!name.trim()}
        className="w-full bg-accent disabled:opacity-40 text-on-accent font-semibold py-3.5 rounded-xl">
        Siguiente →
      </button>
    </div>
  )
}
