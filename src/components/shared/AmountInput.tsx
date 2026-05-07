import { useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export function AmountInput({ value, onChange, placeholder = '0', label, className = '' }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    onChange(raw)
  }

  const formatted = value
    ? Number(value).toLocaleString('es-CO')
    : ''

  return (
    <div className={className}>
      {label && <label className="block text-xs text-slate-400 mb-1">{label}</label>}
      <div className="relative flex items-center bg-slate-800 rounded-xl border border-slate-700 focus-within:border-blue-500 transition-colors">
        <span className="pl-3 text-slate-500 text-sm font-medium">$</span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={formatted}
          onChange={handleChange}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 px-2 text-slate-100 text-base font-semibold focus:outline-none placeholder:text-slate-600"
        />
      </div>
    </div>
  )
}

export function parseAmount(raw: string): number {
  return parseInt(raw.replace(/\D/g, '') || '0', 10)
}
