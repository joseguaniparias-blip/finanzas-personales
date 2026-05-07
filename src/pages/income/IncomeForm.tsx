import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Platform, Pocket, Transaction } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { db } from '@/lib/db'

interface Props {
  userId: string
  platforms: Platform[]
  pockets: Pocket[]
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
  onDone: () => void
  onCancel: () => void
}

export function IncomeForm({ userId, platforms, pockets, addTransaction, onDone, onCancel }: Props) {
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? '')
  const [total, setTotal] = useState('')
  const [hasCash, setHasCash] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashPocketId, setCashPocketId] = useState(pockets.find(p => p.type === 'cash')?.id ?? pockets[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const totalNum = parseAmount(total)
  const cashNum = parseAmount(cashAmount)
  const digital = Math.max(0, totalNum - cashNum)
  const platform = platforms.find(p => p.id === platformId)
  const platformPocket = pockets.find(p => p.platform_id === platformId)

  const canSave = totalNum > 0 && platformId && (!hasCash || (cashNum > 0 && cashNum <= totalNum && cashPocketId))

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)

    try {
      // Cash portion → selected pocket
      if (hasCash && cashNum > 0) {
        await addTransaction({
          user_id: userId,
          type: 'income',
          amount: cashNum,
          pocket_id: cashPocketId,
          category_id: null,
          platform_id: platformId,
          reference_id: null,
          reference_type: 'income_cash',
          note: `Efectivo ${platform?.name ?? ''}`,
          receipt_url: null,
          date: today
        })
      }

      // Digital portion → platform wallet
      if (digital > 0 && platformPocket) {
        await db.pockets.update(platformPocket.id, { balance: platformPocket.balance + digital })
        // Record as transaction against platform pocket
        await db.transactions.add({
          id: crypto.randomUUID(),
          user_id: userId,
          type: 'income',
          amount: digital,
          pocket_id: platformPocket.id,
          category_id: null,
          platform_id: platformId,
          reference_id: null,
          reference_type: 'income_digital',
          note: `Digital ${platform?.name ?? ''}`,
          receipt_url: null,
          date: today,
          created_at: new Date().toISOString()
        })
      }

      setDone(true)
      setTimeout(onDone, 1200)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center">
          <Check size={32} className="text-emerald-400" />
        </div>
        <p className="text-emerald-400 font-semibold">Ingreso registrado</p>
        <p className="text-slate-500 text-sm">{maskAmount(totalNum, false)} de {platform?.name}</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">Registrar ingreso</h2>
        <button onClick={onCancel} className="text-slate-500 text-sm">Cancelar</button>
      </div>

      {/* Platform selector */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Plataforma</p>
        {platforms.length === 0 ? (
          <p className="text-slate-500 text-sm">No tienes plataformas activas</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {platforms.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatformId(p.id)}
                style={{ borderColor: platformId === p.id ? p.color : undefined, backgroundColor: platformId === p.id ? p.color + '20' : undefined }}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  platformId === p.id ? 'text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Total */}
      <AmountInput label="Total ganado hoy" value={total} onChange={setTotal} className="mb-5" />

      {/* Cash toggle */}
      <div className="bg-slate-800 rounded-xl p-4 mb-5 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-200 text-sm font-medium">¿Recibiste efectivo?</p>
            <p className="text-slate-500 text-xs mt-0.5">Propinas, pagos en mano…</p>
          </div>
          <button
            onClick={() => setHasCash(h => !h)}
            className={`w-11 h-6 rounded-full transition-colors relative ${hasCash ? 'bg-emerald-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${hasCash ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {hasCash && (
          <div className="mt-4 space-y-3">
            <AmountInput label="Monto en efectivo" value={cashAmount} onChange={setCashAmount} />
            <div>
              <p className="text-xs text-slate-400 mb-2">¿A qué bolsillo llega?</p>
              <div className="space-y-1">
                {pockets.filter(p => p.type !== 'platform').map(p => (
                  <button
                    key={p.id}
                    onClick={() => setCashPocketId(p.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      cashPocketId === p.id ? 'bg-blue-600/20 border border-blue-500 text-slate-200' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span className="flex-1 text-left">{p.name}</span>
                    <span className="text-xs opacity-60">{maskAmount(p.balance, false)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {totalNum > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 mb-5 border border-slate-700 space-y-2">
          {hasCash && cashNum > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Efectivo → {pockets.find(p => p.id === cashPocketId)?.name}</span>
              <span className="text-emerald-400 font-medium">{maskAmount(cashNum, false)}</span>
            </div>
          )}
          {digital > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Digital → billetera {platform?.name}</span>
              <span className="text-blue-400 font-medium">{maskAmount(digital, false)}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full bg-emerald-600 disabled:opacity-40 hover:bg-emerald-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors"
      >
        {saving ? 'Guardando…' : 'Guardar ingreso'}
      </button>
    </div>
  )
}
