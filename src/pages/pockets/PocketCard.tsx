import type { Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'

interface Props {
  pocket: Pocket
  hidden: boolean
  onEdit: (pocket: Pocket) => void
}

export function PocketCard({ pocket, hidden, onEdit }: Props) {
  return (
    <button
      onClick={() => onEdit(pocket)}
      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-slate-600 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{pocket.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-100">{pocket.name}</p>
            <p className="text-xs text-slate-400 capitalize">{pocket.type === 'cash' ? 'Efectivo' : pocket.type === 'bank' ? 'Banco/Digital' : 'Plataforma'}</p>
          </div>
        </div>
        <p className="text-base font-bold" style={{ color: pocket.color }}>
          {maskAmount(pocket.balance, hidden)}
        </p>
      </div>
    </button>
  )
}
