import { useState } from 'react'
import type { Pocket, Debt } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { DAYS_OF_WEEK } from '@/types'

interface Props {
  userId: string
  pockets: Pocket[]
  initial?: Debt
  onSave: (data: Omit<Debt, 'id' | 'created_at' | 'paid_amount' | 'status'>) => Promise<void>
  onCancel: () => void
}

export function DebtForm({ userId, pockets, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [hasTotal, setHasTotal] = useState(initial?.has_total ?? true)
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount?.toString() ?? '')
  const [installment, setInstallment] = useState(initial?.installment_amount?.toString() ?? '')
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>(initial?.frequency ?? 'monthly')
  const [paymentDay, setPaymentDay] = useState(initial?.payment_day ?? 1)
  const [sourcePocketId, setSourcePocketId] = useState(initial?.source_pocket_id ?? pockets[0]?.id ?? '')
  const [startedBefore, setStartedBefore] = useState(initial?.started_before_app ?? false)
  const [startInstallment, setStartInstallment] = useState(initial?.start_installment ?? 1)
  const [saving, setSaving] = useState(false)

  const totalNum = parseAmount(totalAmount)
  const installmentNum = parseAmount(installment)
  const canSave = name.trim() && installmentNum > 0 && sourcePocketId && (!hasTotal || totalNum > 0)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        user_id: userId,
        name: name.trim(),
        has_total: hasTotal,
        total_amount: hasTotal ? totalNum : null,
        installment_amount: installmentNum,
        frequency,
        payment_day: paymentDay,
        source_pocket_id: sourcePocketId,
        started_before_app: startedBefore,
        start_installment: startedBefore ? startInstallment : 1
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">{initial ? 'Editar deuda' : 'Nueva deuda'}</h2>
        <button onClick={onCancel} className="text-slate-500 text-sm">Cancelar</button>
      </div>

      {/* Name */}
      <div className="mb-5">
        <label className="block text-xs text-slate-400 mb-1">Nombre</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ej: Crédito moto, Préstamo…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Has total toggle */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">¿Tiene monto total?</p>
            <p className="text-slate-500 text-xs mt-0.5">La deuda tiene un total definido</p>
          </div>
          <button
            onClick={() => setHasTotal(h => !h)}
            className={`w-11 h-6 rounded-full transition-colors relative ${hasTotal ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${hasTotal ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        {hasTotal && (
          <AmountInput label="Monto total de la deuda" value={totalAmount} onChange={setTotalAmount} className="mt-4" />
        )}
      </div>

      {/* Installment / amount */}
      <AmountInput
        label={frequency === 'once' ? 'Monto a pagar' : 'Cuota por período'}
        value={installment}
        onChange={setInstallment}
        className="mb-5"
      />

      {/* Frequency */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Frecuencia</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'once',    label: 'Pago único' },
            { value: 'monthly', label: 'Mensual' },
            { value: 'weekly',  label: 'Semanal' },
            { value: 'daily',   label: 'Diario' },
          ] as const).map(f => (
            <button
              key={f.value}
              onClick={() => setFrequency(f.value)}
              className={`py-2 rounded-xl text-xs font-medium transition-colors border ${
                frequency === f.value
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment day — only for recurring */}
      {frequency !== 'daily' && frequency !== 'once' && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">{frequency === 'weekly' ? 'Día de la semana' : 'Día del mes'}</p>
          {frequency === 'weekly' ? (
            <div className="flex gap-1">
              {DAYS_OF_WEEK.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setPaymentDay(i)}
                  className={`flex-1 py-2 rounded-lg text-xs transition-colors ${
                    paymentDay === i ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">Día</span>
              <input
                type="number"
                min={1}
                max={28}
                value={paymentDay}
                onChange={e => setPaymentDay(Number(e.target.value))}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-500 text-sm">de cada mes</span>
            </div>
          )}
        </div>
      )}

      {/* Source pocket */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Bolsillo de pago</p>
        <div className="space-y-1">
          {pockets.filter(p => p.type !== 'platform').map(p => (
            <button
              key={p.id}
              onClick={() => setSourcePocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                sourcePocketId === p.id ? 'bg-blue-600/20 border border-blue-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <span>{p.icon}</span>
              <span className="flex-1 text-left">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Before app toggle — only for recurring debts */}
      {frequency !== 'once' && <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">¿Ya tiene pagos hechos?</p>
            <p className="text-slate-500 text-xs mt-0.5">Para deudas que iniciaron antes de la app</p>
          </div>
          <button
            onClick={() => setStartedBefore(s => !s)}
            className={`w-11 h-6 rounded-full transition-colors relative ${startedBefore ? 'bg-amber-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${startedBefore ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        {startedBefore && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2">Cuotas ya pagadas (antes de la app)</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setStartInstallment(s => Math.max(1, s - 1))}
                className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">−</button>
              <span className="text-slate-100 font-semibold w-8 text-center">{startInstallment}</span>
              <button onClick={() => setStartInstallment(s => s + 1)}
                className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">+</button>
              <span className="text-slate-500 text-sm">cuota{startInstallment !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>}

      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors"
      >
        {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear deuda'}
      </button>
    </div>
  )
}
