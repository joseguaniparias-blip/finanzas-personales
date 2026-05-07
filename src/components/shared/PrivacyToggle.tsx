import { Eye, EyeOff } from 'lucide-react'

interface Props {
  hidden: boolean
  onToggle: () => void
}

export function PrivacyToggle({ hidden, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
      className="p-1.5 rounded-full bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
    >
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )
}

export function maskAmount(amount: number, hidden: boolean): string {
  if (hidden) return '••••••'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount)
}
