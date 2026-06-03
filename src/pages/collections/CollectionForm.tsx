import { useState } from 'react'
import type { Collection, Pocket } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { DAYS_OF_WEEK } from '@/types'
import { useSubmitLock } from '@/hooks/useSubmitLock'
import { todayISO } from '@/lib/date'

interface Props {
  userId: string
  pockets: Pocket[]
  initial?: Collection
  onSave: (data: Omit<Collection, 'id' | 'created_at' | 'collected_amount' | 'status'> & { collected_amount?: number }) => Promise<void>
  onCancel: () => void
}

export function CollectionForm({ userId, pockets, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [personName, setPersonName] = useState(initial?.person_name ?? '')
  const [hasTotal, setHasTotal] = useState(initial?.has_total ?? true)
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount?.toString() ?? '')
  const [installment, setInstallment] = useState(initial?.installment_amount?.toString() ?? '')
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>(initial?.frequency ?? 'monthly')
  const [paymentDay, setPaymentDay] = useState(initial?.payment_day ?? 1)
  const [destPocketId, setDestPocketId] = useState(initial?.dest_pocket_id ?? pockets[0]?.id ?? '')
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO())
  const [startedBefore, setStartedBefore] = useState(initial?.started_before_app ?? false)
  const [startInstallment, setStartInstallment] = useState(initial?.start_installment ?? 1)
  const [collectedAmount, setCollectedAmount] = useState(initial?.collected_amount?.toString() ?? '')
  const { submitting: saving, submit } = useSubmitLock()

  const totalNum = parseAmount(totalAmount)
  const installmentNum = parseAmount(installment)
  const canSave = name.trim() && personName.trim() && installmentNum > 0 && destPocketId && (!hasTotal || totalNum > 0)

  const handleSave = () => {
    if (!canSave) return
    submit(async () => {
      await onSave({
        user_id: userId,
        name: name.trim(),
        person_name: personName.trim(),
        has_total: hasTotal,
        total_amount: hasTotal ? totalNum : null,
        installment_amount: installmentNum,
        frequency,
        payment_day: frequency === 'once' ? null : paymentDay,
        dest_pocket_id: destPocketId,
        start_date: startDate,
        started_before_app: startedBefore,
        start_installment: startedBefore ? startInstallment : 1,
        ...(initial && collectedAmount !== '' ? { collected_amount: parseAmount(collectedAmount) } : {})
      })
    })
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">{initial ? 'Editar cobro' : 'Nuevo cobro'}</h2>
        <button onClick={onCancel} className="text-slate-500 text-sm">Cancelar</button>
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">DescripciÃ³n</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: PrÃ©stamo a amigo, Cuotasâ€¦"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      {/* Person */}
      <div className="mb-5">
        <label className="block text-xs text-slate-400 mb-1">Â¿QuiÃ©n te debe?</label>
        <input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Nombre de la persona"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      {/* Has total */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">Â¿Tiene monto total?</p>
            <p className="text-slate-500 text-xs mt-0.5">Hay un total definido a cobrar</p>
          </div>
          <button onClick={() => setHasTotal(h => !h)}
            className={`w-11 h-6 rounded-full transition-colors relative ${hasTotal ? 'bg-emerald-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${hasTotal ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        {hasTotal && <AmountInput label="Monto total a cobrar" value={totalAmount} onChange={setTotalAmount} className="mt-4" />}
      </div>

      <AmountInput label={frequency === 'once' ? 'Monto a cobrar' : 'Cuota por perÃ­odo'} value={installment} onChange={setInstallment} className="mb-5" />

      {/* Frequency */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Frecuencia</p>
        <div className="grid grid-cols-4 gap-2">
          {(['once', 'weekly', 'monthly', 'daily'] as const).map(f => (
            <button key={f} onClick={() => setFrequency(f)}
              className={`py-2 rounded-xl text-xs font-medium transition-colors border ${frequency === f ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
              {f === 'once' ? 'Ãšnico' : f === 'weekly' ? 'Semanal' : f === 'monthly' ? 'Mensual' : 'Diario'}
            </button>
          ))}
        </div>
      </div>

      {/* Payment day */}
      {frequency === 'weekly' && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">DÃ­a de cobro</p>
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <button key={i} onClick={() => setPaymentDay(i)}
                className={`flex-1 py-2 rounded-lg text-xs transition-colors ${paymentDay === i ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{d}</button>
            ))}
          </div>
        </div>
      )}
      {frequency === 'monthly' && (
        <div className="mb-5 flex items-center gap-3">
          <span className="text-slate-400 text-sm">DÃ­a</span>
          <input type="number" min={1} max={28} value={paymentDay} onChange={e => setPaymentDay(Number(e.target.value))}
            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-blue-500" />
          <span className="text-slate-500 text-sm">de cada mes</span>
        </div>
      )}

      {/* Start date */}
      <div className="mb-5">
        <label className="block text-xs text-slate-400 mb-1">Fecha de inicio</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      {/* Dest pocket */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Â¿A quÃ© bolsillo llega el cobro?</p>
        <div className="space-y-1">
          {pockets.filter(p => p.type !== 'platform').map(p => (
            <button key={p.id} onClick={() => setDestPocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${destPocketId === p.id ? 'bg-emerald-600/20 border border-emerald-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
              <span>{p.icon}</span><span className="flex-1 text-left">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Edit collected total â€” only when editing existing collection */}
      {initial && (
        <div className="mb-5">
          <AmountInput
            label="Total ya cobrado (editable)"
            value={collectedAmount}
            onChange={setCollectedAmount}
          />
          <p className="text-slate-500 text-xs mt-1">Ajusta si las cuotas registradas no cuadran</p>
        </div>
      )}

      {/* Before app */}
      {frequency !== 'once' && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-sm font-medium">Â¿Ya tiene cobros hechos?</p>
              <p className="text-slate-500 text-xs mt-0.5">Para cobros iniciados antes de la app</p>
            </div>
            <button onClick={() => setStartedBefore(s => !s)}
              className={`w-11 h-6 rounded-full transition-colors relative ${startedBefore ? 'bg-amber-600' : 'bg-slate-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${startedBefore ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          {startedBefore && (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-2">Cuotas ya cobradas (antes de la app)</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setStartInstallment(s => Math.max(1, s - 1))} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">âˆ’</button>
                <span className="text-slate-100 font-semibold w-8 text-center">{startInstallment}</span>
                <button onClick={() => setStartInstallment(s => s + 1)} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 text-lg">+</button>
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-emerald-600 disabled:opacity-40 hover:bg-emerald-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors">
        {saving ? 'Guardandoâ€¦' : initial ? 'Guardar cambios' : 'Crear cobro'}
      </button>
    </div>
  )
}
