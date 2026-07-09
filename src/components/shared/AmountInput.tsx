import { useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export function AmountInput({ value, onChange, placeholder = '0', label, className = '' }: Props) {
  const [focused, setFocused] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const isNeg = raw.startsWith('-')
    const digits = raw.replace(/\D/g, '')
    onChange(isNeg ? '-' + digits : digits)
  }

  const isNeg = value.startsWith('-')
  const absNum = parseInt(value.replace(/\D/g, '') || '0', 10)
  const displayValue = focused
    ? value
    : absNum > 0
      ? (isNeg ? '-' : '') + absNum.toLocaleString('es-CO')
      : value === '-' ? '-' : ''

  return (
    <div className={className}>
      {label && <label className="block text-xs text-slate-400 mb-1">{label}</label>}
      <div className="relative flex items-center bg-slate-800 rounded-xl border border-slate-700 focus-within:border-blue-500 transition-colors">
        <span className="pl-3 text-slate-400 text-sm font-medium">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 px-2 text-slate-100 text-base font-semibold focus:outline-none placeholder:text-slate-400"
        />
      </div>
    </div>
  )
}

export function parseAmount(raw: string): number {
  const isNeg = raw.startsWith('-')
  const abs = parseInt(raw.replace(/\D/g, '') || '0', 10)
  return isNeg ? -abs : abs
}
