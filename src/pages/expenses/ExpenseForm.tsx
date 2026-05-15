import { useState, useEffect } from 'react'
import { Check, Pencil, X, Plus } from 'lucide-react'
import type { Pocket, Category, Transaction } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { maskAmount } from '@/components/shared/PrivacyToggle'

interface Props {
  userId: string
  pockets: Pocket[]
  categories: Category[]
  seedDefaults: () => Promise<void>
  addCategory: (c: Omit<Category, 'id' | 'created_at'>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
  onDone: () => void
  onCancel: () => void
}

const QUICK_ICONS = ['⛽','🔧','📱','🛡️','🛣️','🍔','🛒','💊','📦','🎮','👕','🚌','☕','🍕','💡']

export function ExpenseForm({ userId, pockets, categories, seedDefaults, addCategory, deleteCategory, addTransaction, onDone, onCancel }: Props) {
  const [amount, setAmount] = useState('')
  const [pocketId, setPocketId] = useState(pockets[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [detailed, setDetailed] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Category manager state
  const [managingCats, setManagingCats] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')

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
        date
      })
      setDone(true)
      setTimeout(onDone, 1200)
    } finally {
      setSaving(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    await addCategory({ user_id: userId, name: newCatName.trim(), icon: newCatIcon, monthly_limit: null, is_default: false })
    setNewCatName('')
    setNewCatIcon('📦')
  }

  const handleRename = async () => {
    if (!editingCat || !editName.trim()) return
    // updateCategory not available here; use the pattern below via deleteCategory + addCategory
    // Actually we need updateCategory — see ExpensesPage for full hook
    setEditingCat(null)
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
        <button onClick={() => setDetailed(false)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${!detailed ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
          Rápido
        </button>
        <button onClick={() => setDetailed(true)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${detailed ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
          Detallado
        </button>
      </div>

      {/* Amount */}
      <AmountInput label="Monto" value={amount} onChange={setAmount} className="mb-4" />

      {/* Date */}
      <div className="mb-5">
        <label className="block text-xs text-slate-400 mb-1">Fecha</label>
        <input
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-red-500 [color-scheme:dark]"
        />
      </div>

      {/* Pocket */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Bolsillo</p>
        <div className="space-y-1">
          {pockets.filter(p => p.type !== 'platform').map(p => (
            <button key={p.id} onClick={() => setPocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                pocketId === p.id ? 'bg-blue-600/20 border border-blue-500 text-slate-200' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}>
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">Categoría</p>
              <button onClick={() => { setManagingCats(m => !m); setEditingCat(null) }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                <Pencil size={10} /> {managingCats ? 'Listo' : 'Gestionar'}
              </button>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map(c => (
                <div key={c.id} className="relative">
                  {managingCats ? (
                    <div className="flex items-center gap-1">
                      {editingCat?.id === c.id ? (
                        <div className="flex items-center gap-1">
                          <input value={editName} onChange={e => setEditName(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-100 w-24 focus:outline-none focus:border-blue-500" />
                          <button onClick={async () => {
                            if (editName.trim()) {
                              await deleteCategory(c.id)
                              await addCategory({ user_id: userId, name: editName.trim(), icon: c.icon, monthly_limit: c.monthly_limit, is_default: false })
                              if (categoryId === c.id) setCategoryId(null)
                            }
                            setEditingCat(null)
                          }} className="text-xs text-emerald-400 px-1">✓</button>
                          <button onClick={() => setEditingCat(null)} className="text-xs text-slate-500 px-1">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1.5">
                          <span className="text-xs">{c.icon}</span>
                          <span className="text-xs text-slate-300">{c.name}</span>
                          <button onClick={() => { setEditingCat(c); setEditName(c.name) }}
                            className="text-slate-500 hover:text-slate-300 ml-0.5"><Pencil size={9} /></button>
                          <button onClick={async () => { await deleteCategory(c.id); if (categoryId === c.id) setCategoryId(null) }}
                            className="text-slate-500 hover:text-red-400 ml-0.5"><X size={9} /></button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                        categoryId === c.id ? 'bg-purple-600/20 border border-purple-500 text-purple-300' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}>
                      <span>{c.icon}</span> {c.name}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add new category */}
            {managingCats && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-2">Nueva categoría</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QUICK_ICONS.map(ic => (
                    <button key={ic} onClick={() => setNewCatIcon(ic)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${newCatIcon === ic ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    placeholder="Nombre…"
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                  <button onClick={handleAddCategory} disabled={!newCatName.trim()}
                    className="flex items-center gap-1 bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                    <Plus size={12} /> Agregar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="mb-5">
            <p className="text-xs text-slate-400 mb-2">Nota</p>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Descripción opcional…" rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
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

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-red-600 disabled:opacity-40 hover:bg-red-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors">
        {saving ? 'Guardando…' : 'Registrar gasto'}
      </button>
    </div>
  )
}
