import { useState, useEffect, useCallback } from 'react'
import { ArrowUpRight, ArrowDownRight, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { usePockets } from '@/hooks/usePockets'
import { useCategories } from '@/hooks/useCategories'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import type { Transaction, Pocket, Category } from '@/types'

interface Props { userId: string }

type Period = 'day' | 'week' | 'month'
type TypeFilter = 'all' | 'income' | 'expense'

function periodDates(period: Period): { from: string; to: string } {
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  if (period === 'day') return { from: to, to }
  if (period === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - 6)
    return { from: d.toISOString().slice(0, 10), to }
  }
  return { from: today.toISOString().slice(0, 7) + '-01', to }
}

function groupByDate(txs: Transaction[]): { date: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const list = map.get(tx.date) ?? []
    list.push(tx)
    map.set(tx.date, list)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }))
}

function formatDate(iso: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (iso === today) return 'Hoy'
  if (iso === yesterday) return 'Ayer'
  const [y, m, d] = iso.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`
}

async function reverseTxOnPocket(tx: Transaction) {
  const pocket = await db.pockets.get(tx.pocket_id)
  if (!pocket) return
  const delta = tx.type === 'income' ? -tx.amount : tx.amount
  await db.pockets.update(tx.pocket_id, { balance: pocket.balance + delta })
}

async function applyTxOnPocket(tx: Pick<Transaction, 'type' | 'amount' | 'pocket_id'>) {
  const pocket = await db.pockets.get(tx.pocket_id)
  if (!pocket) return
  const delta = tx.type === 'income' ? tx.amount : -tx.amount
  await db.pockets.update(tx.pocket_id, { balance: pocket.balance + delta })
}

export function HistoryPage({ userId }: Props) {
  const { pockets, load: reloadPockets } = usePockets(userId)
  const { categories } = useCategories(userId)
  const [period, setPeriod] = useState<Period>('month')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [pocketFilter, setPocketFilter] = useState<string>('all')
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = periodDates(period)
    let data = await db.transactions
      .where('user_id').equals(userId)
      .and(t => t.date >= from && t.date <= to)
      .sortBy('date')
    data = data.reverse()
    setTxs(data)
    setLoading(false)
  }, [userId, period])

  useEffect(() => { load() }, [load])

  const pocketMap = Object.fromEntries(pockets.map(p => [p.id, p])) as Record<string, Pocket>
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c])) as Record<string, Category>

  const filtered = txs.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (pocketFilter !== 'all' && t.pocket_id !== pocketFilter) return false
    return true
  })

  const totalIncome  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const groups = groupByDate(filtered)

  const txLabel = (tx: Transaction): string => {
    if (tx.note) return tx.note
    if (tx.category_id && categoryMap[tx.category_id]) {
      const cat = categoryMap[tx.category_id]
      return `${cat.icon} ${cat.name}`
    }
    if (tx.type === 'income') return 'Ingreso'
    if (tx.type === 'expense') return 'Gasto'
    return 'Movimiento'
  }

  const nonPlatformPockets = pockets.filter(p => p.type !== 'platform')

  const handleDelete = async (tx: Transaction) => {
    await reverseTxOnPocket(tx)
    await db.transactions.delete(tx.id)
    await reloadPockets()
    setSelectedTx(null)
    load()
  }

  const handleUpdate = async (old: Transaction, updated: Partial<Transaction>) => {
    await reverseTxOnPocket(old)
    await db.transactions.update(old.id, updated)
    const merged = { ...old, ...updated }
    await applyTxOnPocket(merged)
    await reloadPockets()
    setEditingTx(null)
    setSelectedTx(null)
    load()
  }

  if (editingTx) {
    return (
      <TransactionEditForm
        tx={editingTx}
        pockets={nonPlatformPockets}
        categories={categories}
        onSave={updated => handleUpdate(editingTx, updated)}
        onCancel={() => setEditingTx(null)}
      />
    )
  }

  if (selectedTx) {
    return (
      <TransactionDetailView
        tx={selectedTx}
        pocket={pocketMap[selectedTx.pocket_id]}
        category={selectedTx.category_id ? categoryMap[selectedTx.category_id] : undefined}
        onBack={() => setSelectedTx(null)}
        onEdit={() => setEditingTx(selectedTx)}
        onDelete={() => handleDelete(selectedTx)}
      />
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Historial" />

      {/* Period tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-4">
        {([['day','Hoy'],['week','Semana'],['month','Mes']] as [Period,string][]).map(([p,label]) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Type + Pocket filters */}
      <div className="flex gap-2 mb-4">
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1 flex-1">
          {([['all','Todos'],['income','Ingresos'],['expense','Gastos']] as [TypeFilter,string][]).map(([t,label]) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-slate-600 text-slate-100' : 'text-slate-500'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={pocketFilter} onChange={e => setPocketFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-slate-300 text-xs focus:outline-none">
          <option value="all">Todos los bolsillos</option>
          {nonPlatformPockets.map(p => (
            <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-emerald-600/10 border border-emerald-600/20 rounded-xl p-3">
          <p className="text-xs text-slate-400">Ingresos</p>
          <p className="text-emerald-400 font-bold text-sm">{maskAmount(totalIncome, false)}</p>
        </div>
        <div className="bg-red-600/10 border border-red-600/20 rounded-xl p-3">
          <p className="text-xs text-slate-400">Gastos</p>
          <p className="text-red-400 font-bold text-sm">{maskAmount(totalExpense, false)}</p>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm animate-pulse text-center py-8">Cargando…</p>}

      {!loading && groups.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">Sin movimientos en este período</p>
        </div>
      )}

      {/* Grouped list */}
      <div className="space-y-5">
        {groups.map(({ date, items }) => (
          <div key={date}>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{formatDate(date)}</p>
            <div className="space-y-2">
              {items.map(tx => {
                const pocket = pocketMap[tx.pocket_id]
                const isIncome = tx.type === 'income'
                return (
                  <button key={tx.id} onClick={() => setSelectedTx(tx)}
                    className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3 hover:border-slate-600 transition-colors text-left">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-600/20' : 'bg-red-600/20'}`}>
                      {isIncome
                        ? <ArrowUpRight size={14} className="text-emerald-400" />
                        : <ArrowDownRight size={14} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm truncate">{txLabel(tx)}</p>
                      {pocket && (
                        <p className="text-xs text-slate-500">{pocket.icon} {pocket.name}</p>
                      )}
                    </div>
                    <p className={`font-bold text-sm flex-shrink-0 ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isIncome ? '+' : '−'} {maskAmount(tx.amount, false)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

interface DetailProps {
  tx: Transaction
  pocket?: Pocket
  category?: Category
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

function TransactionDetailView({ tx, pocket, category, onBack, onEdit, onDelete }: DetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isIncome = tx.type === 'income'

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-slate-100 text-lg font-bold flex-1">Detalle</h2>
        <button onClick={onEdit} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <Pencil size={16} />
        </button>
      </div>

      {/* Amount card */}
      <div className={`rounded-2xl p-5 mb-5 border text-center ${isIncome ? 'bg-emerald-600/10 border-emerald-600/20' : 'bg-red-600/10 border-red-600/20'}`}>
        <p className="text-xs text-slate-400 mb-1">{isIncome ? 'Ingreso' : 'Gasto'}</p>
        <p className={`text-3xl font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
          {isIncome ? '+' : '−'} {maskAmount(tx.amount, false)}
        </p>
        <p className="text-slate-500 text-sm mt-1">{formatDate(tx.date)}</p>
      </div>

      {/* Info rows */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5 space-y-3">
        {pocket && <InfoRow label="Bolsillo" value={`${pocket.icon} ${pocket.name}`} />}
        {category && <InfoRow label="Categoría" value={`${category.icon} ${category.name}`} />}
        {tx.note && <InfoRow label="Nota" value={tx.note} />}
        {tx.reference_type && (
          <InfoRow label="Tipo" value={tx.reference_type.replace(/_/g, ' ')} />
        )}
      </div>

      {/* Delete */}
      <div className="mt-4">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 py-2.5 rounded-xl text-sm transition-colors">
            <Trash2 size={14} /> Eliminar registro
          </button>
        ) : (
          <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 text-center">
            <p className="text-slate-300 text-sm mb-3">¿Eliminar este registro? El saldo del bolsillo se ajustará.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">No</button>
              <button onClick={onDelete}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Sí, eliminar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-200 font-medium text-right">{value}</span>
    </div>
  )
}

// ─── Edit form ────────────────────────────────────────────────────────────────

interface EditProps {
  tx: Transaction
  pockets: Pocket[]
  categories: Category[]
  onSave: (updates: Partial<Transaction>) => void
  onCancel: () => void
}

function TransactionEditForm({ tx, pockets, categories, onSave, onCancel }: EditProps) {
  const [type, setType] = useState<'income' | 'expense'>(tx.type === 'transfer' ? 'expense' : tx.type)
  const [amount, setAmount] = useState(tx.amount.toString())
  const [pocketId, setPocketId] = useState(tx.pocket_id)
  const [categoryId, setCategoryId] = useState(tx.category_id ?? '')
  const [note, setNote] = useState(tx.note ?? '')
  const [date, setDate] = useState(tx.date)
  const [saving, setSaving] = useState(false)

  const amountNum = parseAmount(amount)
  const canSave = amountNum > 0 && pocketId

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        type,
        amount: amountNum,
        pocket_id: pocketId,
        category_id: categoryId || null,
        note: note.trim() || null,
        date
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">Editar registro</h2>
        <button onClick={onCancel} className="text-slate-500 text-sm">Cancelar</button>
      </div>

      {/* Type */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Tipo</p>
        <div className="flex gap-2">
          {(['income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                type === t
                  ? t === 'income' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'bg-red-600/20 border-red-500 text-red-300'
                  : 'border-slate-700 text-slate-400'
              }`}>
              {t === 'income' ? '↑ Ingreso' : '↓ Gasto'}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <AmountInput label="Monto" value={amount} onChange={setAmount} className="mb-5" />

      {/* Date */}
      <div className="mb-5">
        <label className="block text-xs text-slate-400 mb-1">Fecha</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      {/* Pocket */}
      <div className="mb-5">
        <p className="text-xs text-slate-400 mb-2">Bolsillo</p>
        <div className="space-y-1">
          {pockets.map(p => (
            <button key={p.id} onClick={() => setPocketId(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors border ${
                pocketId === p.id ? 'bg-blue-600/20 border-blue-500 text-slate-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}>
              <span>{p.icon}</span><span className="flex-1 text-left">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category (only for expenses) */}
      {type === 'expense' && categories.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-slate-400 mb-2">Categoría</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setCategoryId('')}
              className={`py-2 rounded-xl text-xs transition-colors border ${!categoryId ? 'bg-slate-600 border-slate-500 text-slate-200' : 'border-slate-700 text-slate-500'}`}>
              Sin categoría
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                className={`py-2 rounded-xl text-xs transition-colors border flex flex-col items-center gap-0.5 ${categoryId === c.id ? 'bg-blue-600/20 border-blue-500 text-slate-200' : 'border-slate-700 text-slate-400'}`}>
                <span>{c.icon}</span>
                <span className="truncate w-full text-center px-1">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="mb-6">
        <label className="block text-xs text-slate-400 mb-1">Nota (opcional)</label>
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="Descripción…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600" />
      </div>

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors">
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
