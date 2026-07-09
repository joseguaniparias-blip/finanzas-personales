import type { Pocket } from '@/types'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { ChevronRight } from 'lucide-react'

interface Props {
  pocket: Pocket
  hidden: boolean
  onEdit: (pocket: Pocket) => void
}

const TYPE_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  bank: 'Banco / Digital',
  platform: 'Plataforma',
}

export function PocketCard({ pocket, hidden, onEdit }: Props) {
  const isNegative = pocket.balance < 0
  const isPlatform = pocket.type === 'platform'

  return (
    <button
      onClick={() => onEdit(pocket)}
      className={`w-full rounded-2xl border p-4 text-left transition-colors hover:border-slate-500 ${
        isPlatform
          ? 'bg-orange-500/5 border-orange-500/20'
          : 'bg-slate-800 border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isPlatform ? 'bg-orange-500/15' : 'bg-slate-700'
        }`}>
          <span className="text-2xl">{pocket.icon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 text-sm font-semibold truncate">{pocket.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{TYPE_LABELS[pocket.type] ?? pocket.type}</p>
        </div>

        {/* Balance */}
        <div className="flex items-center gap-2">
          <p className={`text-base font-bold ${isNegative ? 'text-red-400' : isPlatform ? 'text-orange-400' : 'text-slate-100'}`}>
            {maskAmount(pocket.balance, hidden)}
          </p>
          <ChevronRight size={14} className="text-slate-400" />
        </div>
      </div>
    </button>
  )
}
