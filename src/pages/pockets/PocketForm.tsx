import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Pocket, PocketType } from '@/types'

interface Props {
  userId: string
  initial?: Pocket
  onSave: (data: Omit<Pocket, 'id' | 'created_at'>) => void
  onDelete?: () => void
  onCancel: () => void
}

const ICONS: Record<PocketType, { default: string; options: string[] }> = {
  cash:     { default: '💵', options: ['💵', '💰', '🪙'] },
  bank:     { default: '💳', options: ['💳', '🟢', '🏦', '📱'] },
  platform: { default: '📲', options: ['🛵', '🚗', '🍔', '📲'] }
}

const COLORS = ['#34d399', '#60a5fa', '#fb923c', '#a78bfa', '#f87171', '#fbbf24', '#94a3b8']

export function PocketForm({ userId, initial, onSave, onDelete, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<PocketType>(initial?.type ?? 'bank')
  const [balance, setBalance] = useState(initial?.balance?.toString() ?? '0')
  const [color, setColor] = useState(initial?.color ?? '#34d399')
  const [icon, setIcon] = useState(initial?.icon ?? '💳')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      user_id: userId,
      name: name.trim(),
      type,
      platform_id: null,
      balance: parseFloat(balance) || 0,
      color,
      icon,
      is_active: true
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 mb-1 block">NOMBRE</label>
        <input
          value={name} onChange={e => setName(e.target.value)} required
          placeholder="Ej: Nequi, Bancolombia, Efectivo"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">TIPO</label>
        <div className="flex gap-2">
          {(['cash', 'bank', 'platform'] as PocketType[]).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${type === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {t === 'cash' ? 'Efectivo' : t === 'bank' ? 'Banco/Digital' : 'Plataforma'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">ÍCONO</label>
        <div className="flex gap-2">
          {ICONS[type].options.map(ic => (
            <button key={ic} type="button" onClick={() => setIcon(ic)}
              className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-colors ${icon === ic ? 'bg-blue-600' : 'bg-slate-800'}`}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">COLOR</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-colors ${color === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">SALDO ACTUAL</label>
        <input type="number" value={balance} onChange={e => setBalance(e.target.value)}
          min="0" step="1000"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl font-medium text-sm">
          Cancelar
        </button>
        <button type="submit"
          className="flex-2 bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold text-sm">
          {initial ? 'Guardar cambios' : 'Agregar bolsillo'}
        </button>
      </div>

      {initial && onDelete && (
        <div className="pt-2">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Trash2 size={14} /> Eliminar bolsillo
            </button>
          ) : (
            <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 text-center">
              <p className="text-slate-300 text-sm mb-3">¿Eliminar <strong>{initial.name}</strong>?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">
                  No
                </button>
                <button type="button" onClick={onDelete}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">
                  Sí, eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
