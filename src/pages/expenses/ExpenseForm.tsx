import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import type { Pocket, Category, Transaction } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { maskAmount } from '@/components/shared/PrivacyToggle'

interface Props {
  userId: string
  pockets: Pocket[]
  categories: Category[]
  seedDefaults: () => Promise<void>
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
  onDone: () => void
  onCancel: () => void
}

export function ExpenseForm({ userId, pockets, categories, seedDefaults, addTransaction, onDone, onCancel }: Props) {
  const [amount, setAmount] = useState('')
  const [pocketId, setPocketId] = useState(pockets[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [detailed, setDetailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { seedDefaults() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().slice(0, 10)
  const amountNum = parseAmount(amount)
  const pocket = pockets.find(p => p.id === pocketId)
  const category = categories.find(c => c.id === categoryId)
  const canSave = amountNum > 0 && pocketId

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await addTransaction({
        user_id: userId,
        type: 'expense',
        amount: amountNum,
        pocket_id: pocketId,
        category_id: categoryId,
        platform_id: null,
        reference_id: null,
        reference_type: null,
        note: note || null,
        receipt_url: null,
        date: today
      })
      setDone(true)
      setTimeout(onDone, 1200)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center">
          <Check size={32} className="text-red-400" />
        </div>
        <p className="text-red-400 font-semibold">Gasto registrado</p>
        <p className="text-slate-500 text-sm">{maskAmount(amountNum, false)}{category ? ` · ${category.icon} ${category.name}` : ''}</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">Registrar gasto</h2>
        <button onClick={onCancel} className="text-slate-500 text-sm">Cancelar</button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setDetailed(false)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${!detailed ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Rápido
        </button>
        <button
          onClick={() => setDetailed(true)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${detailed ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Detallado
        </button>
      </div>

      {/* Amount */}
      <AmountInput label="Monto" value={amount} onChange={setAmount} className="mb-5" />

      {/* Pocket */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Bolsillo</p>
        <div className="space-y-1">
          {pockets.filter(p => p.type !== 'platform').map(p => (
            <button
              key={p.id}
              onClick={() => setPocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                pocketId === p.id ? 'bg-blue-600/20 border border-blue-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <span>{p.icon}</span>
              <span className="flex-1 text-left">{p.name}</span>
              <span className="text-xs opacity-60">{maskAmount(p.balance, false)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Detailed fields */}
      {detailed && (
        <>
          {/* Category */}
          <div className="mb-5">
            <p className="text-xs text-slate-400 mb-2">Categoría</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                    categoryId === c.id ? 'bg-purple-600/20 border border-purple-500 text-purple-300' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span>{c.icon}</span> {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="mb-5">
            <p className="text-xs text-slate-400 mb-2">Nota</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Descripción opcional…"
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </>
      )}

      {/* Summary */}
      {amountNum > 0 && pocket && (
        <div className="bg-slate-800/50 rounded-xl p-3 mb-5 border border-slate-700 flex justify-between text-sm">
          <span className="text-slate-400">{pocket.icon} {pocket.name}{category ? ` · ${category.icon} ${category.name}` : ''}</span>
          <span className="text-red-400 font-medium">−{maskAmount(amountNum, false)}</span>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full bg-red-600 disabled:opacity-40 hover:bg-red-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors"
      >
        {saving ? 'Guardando…' : 'Registrar gasto'}
      </button>
    </div>
  )
}
