import { useState } from 'react'
import { Plus, TrendingDown, Settings2 } from 'lucide-react'
import { usePockets } from '@/hooks/usePockets'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { ExpenseForm } from './ExpenseForm'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Category, Transaction } from '@/types'

interface Props { userId: string }

export function ExpensesPage({ userId }: Props) {
  const { pockets } = usePockets(userId)
  const { categories, updateCategory, addCategory, seedDefaults, loading: loadingC } = useCategories(userId)
  const { transactions, loading: loadingT, addTransaction } = useTransactions(userId)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [limitDraft, setLimitDraft] = useState('')
  const [view, setView] = useState<'list' | 'categories'>('list')

  const expenseTransactions = transactions.filter(t => t.type === 'expense')

  const monthTotal = expenseTransactions.reduce((s, t) => s + t.amount, 0)

  // Spending per category this month
  const spendingByCategory: Record<string, number> = {}
  for (const t of expenseTransactions) {
    if (t.category_id) {
      spendingByCategory[t.category_id] = (spendingByCategory[t.category_id] ?? 0) + t.amount
    }
  }

  const grouped = groupByDate(expenseTransactions)

  if (loadingT || loadingC) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm) {
    return (
      <ExpenseForm
        userId={userId}
        pockets={pockets}
        categories={categories}
        seedDefaults={seedDefaults}
        addTransaction={addTransaction}
        onDone={() => setShowForm(false)}
        onCancel={() => setShowForm(false)}
      />
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader
        title="Gastos"
        right={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus size={14} /> Registrar
          </button>
        }
      />

      {/* Month summary */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 mb-5 border border-slate-700">
        <p className="text-xs text-slate-400 mb-1">GASTOS ESTE MES</p>
        <p className="text-2xl font-bold text-red-400">{maskAmount(monthTotal, false)}</p>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${view === 'list' ? 'bg-slate-700 text-slate-100' : 'text-slate-500'}`}
        >
          <TrendingDown size={12} /> Historial
        </button>
        <button
          onClick={() => setView('categories')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${view === 'categories' ? 'bg-slate-700 text-slate-100' : 'text-slate-500'}`}
        >
          <Settings2 size={12} /> Categorías
        </button>
      </div>

      {view === 'list' && (
        <>
          {grouped.length === 0 ? (
            <div className="text-center py-16">
              <TrendingDown size={36} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Sin gastos este mes</p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{formatDate(date)}</p>
                  <div className="space-y-2">
                    {items.map(t => (
                      <ExpenseCard key={t.id} tx={t} categories={categories} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'categories' && (
        <div className="space-y-3">
          {categories.map(c => {
            const spent = spendingByCategory[c.id] ?? 0
            const hasLimit = c.monthly_limit !== null
            const overLimit = hasLimit && c.monthly_limit !== null && spent > c.monthly_limit
            return (
              <div key={c.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">{c.icon}</span>
                  <div className="flex-1">
                    <p className="text-slate-200 text-sm font-medium">{c.name}</p>
                    {hasLimit && (
                      <p className={`text-xs ${overLimit ? 'text-red-400' : 'text-slate-500'}`}>
                        {maskAmount(spent, false)} / {maskAmount(c.monthly_limit!, false)}
                        {overLimit && ' ⚠️'}
                      </p>
                    )}
                    {!hasLimit && spent > 0 && <p className="text-xs text-slate-500">{maskAmount(spent, false)} este mes</p>}
                  </div>
                  <button
                    onClick={() => { setEditingCategory(c); setLimitDraft(c.monthly_limit?.toString() ?? '') }}
                    className="text-slate-500 hover:text-slate-300 p-1"
                  >
                    <Settings2 size={14} />
                  </button>
                </div>
                {hasLimit && c.monthly_limit !== null && (
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overLimit ? 'bg-red-500' : 'bg-purple-500'}`}
                      style={{ width: `${Math.min(100, (spent / c.monthly_limit) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Add custom category */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-dashed border-slate-600">
            <p className="text-xs text-slate-400 mb-3">Nueva categoría</p>
            <div className="flex gap-2 mb-2">
              <input
                value={newCatIcon}
                onChange={e => setNewCatIcon(e.target.value)}
                maxLength={2}
                className="w-12 bg-slate-700 rounded-lg text-center text-lg border border-slate-600 focus:outline-none focus:border-blue-500"
              />
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="Nombre…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={async () => {
                if (!newCatName.trim()) return
                await addCategory({
                  user_id: userId,
                  name: newCatName.trim(),
                  icon: newCatIcon,
                  monthly_limit: null,
                  is_default: false
                })
                setNewCatName('')
                setNewCatIcon('📦')
              }}
              disabled={!newCatName.trim()}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-lg text-sm transition-colors"
            >
              + Agregar
            </button>
          </div>
        </div>
      )}

      {/* Edit category limit sheet */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
          <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 p-6">
            <h3 className="text-slate-100 font-semibold mb-4">
              {editingCategory.icon} {editingCategory.name}
            </h3>
            <AmountInput
              label="Límite mensual (opcional)"
              value={limitDraft}
              onChange={setLimitDraft}
              className="mb-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setEditingCategory(null)}
                className="py-3 rounded-xl border border-slate-700 text-slate-400 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const limit = parseAmount(limitDraft)
                  await updateCategory(editingCategory.id, { monthly_limit: limit > 0 ? limit : null })
                  setEditingCategory(null)
                }}
                className="py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ExpenseCard({ tx, categories }: { tx: Transaction; categories: Category[] }) {
  const category = categories.find(c => c.id === tx.category_id)
  return (
    <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50">
      <span className="text-lg">{category?.icon ?? '💸'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 text-sm font-medium truncate">{tx.note ?? category?.name ?? 'Gasto'}</p>
        {category && !tx.note && <p className="text-xs text-slate-500">{category.name}</p>}
      </div>
      <span className="text-red-400 font-semibold text-sm">{maskAmount(tx.amount, false)}</span>
    </div>
  )
}

function groupByDate(txs: Transaction[]) {
  const map = new Map<string, Transaction[]>()
  for (const t of txs) {
    const list = map.get(t.date) ?? []
    list.push(t)
    map.set(t.date, list)
  }
  return [...map.entries()].map(([date, items]) => ({ date, items })).sort((a, b) => b.date.localeCompare(a.date))
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Hoy'
  if (dateStr === yesterday) return 'Ayer'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}
