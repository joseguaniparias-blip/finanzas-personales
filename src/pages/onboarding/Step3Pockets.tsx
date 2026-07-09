import { useState } from 'react'
import type { PocketDraft } from '@/types'

interface Props {
  initial: PocketDraft[]
  onNext: (pockets: PocketDraft[]) => void
  onBack: () => void
}

const PRESETS: PocketDraft[] = [
  { name: 'Efectivo', type: 'cash',  balance: 0, color: '#34d399', icon: '💵' },
  { name: 'Nequi',   type: 'bank',  balance: 0, color: '#34d399', icon: '🟢' },
  { name: 'Daviplata',type: 'bank', balance: 0, color: '#fbbf24', icon: '🟡' },
]

export function Step3Pockets({ initial, onNext, onBack }: Props) {
  const [pockets, setPockets] = useState<PocketDraft[]>(
    initial.length > 0 ? initial : PRESETS
  )

  const updateBalance = (idx: number, val: string) =>
    setPockets(ps => ps.map((p, i) => i === idx ? { ...p, balance: parseFloat(val) || 0 } : p))

  const addPocket = () =>
    setPockets(ps => [...ps, { name: '', type: 'bank', balance: 0, color: '#94a3b8', icon: '💳' }])

  const updateName = (idx: number, val: string) =>
    setPockets(ps => ps.map((p, i) => i === idx ? { ...p, name: val } : p))

  const remove = (idx: number) =>
    setPockets(ps => ps.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">💳</div>
        <h2 className="text-xl font-bold text-slate-100">Tus bolsillos</h2>
        <p className="text-slate-400 text-sm mt-1">¿Cuánto tienes ahora en cada uno?</p>
      </div>
      <div className="space-y-3">
        {pockets.map((p, i) => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
            <span className="text-xl">{p.icon}</span>
            <input value={p.name} onChange={e => updateName(i, e.target.value)}
              placeholder="Nombre"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none min-w-0" />
            <input type="number" value={p.balance || ''} onChange={e => updateBalance(i, e.target.value)}
              placeholder="$0" min="0"
              className="w-28 bg-slate-900 rounded-lg px-2 py-1.5 text-sm text-emerald-400 text-right focus:outline-none" />
            {pockets.length > 1 && (
              <button onClick={() => remove(i)} className="text-slate-400 hover:text-red-400 text-lg">×</button>
            )}
          </div>
        ))}
        <button onClick={addPocket}
          className="w-full text-slate-400 text-sm py-2 border border-dashed border-slate-700 rounded-xl hover:border-slate-500">
          + Agregar cuenta bancaria
        </button>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-sm">← Atrás</button>
        <button onClick={() => onNext(pockets.filter(p => p.name.trim()))}
          className="flex-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Siguiente →
        </button>
      </div>
    </div>
  )
}
