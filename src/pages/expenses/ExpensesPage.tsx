import { useState } from 'react'
import { Plus, TrendingDown, LayoutList, Tags, ChevronRight, X } from 'lucide-react'
import { usePockets } from '@/hooks/usePockets'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { ExpenseForm } from './ExpenseForm'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Category, Pocket, Transaction } from '@/types'

interface Props { userId: string }

type Period = 'week' | 'month'
type View = 'list' | 'categories'

function periodRange(period: Period): { from: string; to: string } {
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  if (period === 'month') return { from: today.toISOString().slice(0, 7) + '-01', to }
  // last 7 days
  const d = new Date(today); d.setDate(d.getDate() - 6)
  return { from: d.toISOString().slice(0, 10), to }
}

function groupByDate(txs: Transaction[]): { date: string; items: Transaction[]; total: number }[] {
  const map = new Map<string, Transaction[]>()
  for (const t of txs) {
    const list = map.get(t.date) ?? []
    list.push(t)
    map.set(t.date, list)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items, total: items.reduce((s, t) => s + t.amount, 0) }))
}

function formatDate(iso: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (iso === today) return 'Hoy'
  if (iso === yesterday) return 'Ayer'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function ExpensesPage({ userId }: Props) {
  const { pockets } = usePockets(userId)
  const { categories, updateCategory, addCategory, deleteCategory, seedDefaults, loading: loadingC } = useCategories(userId)
  const { transactions, loading: loadingT, addTransaction } = useTransactions(userId)

  const [showForm, setShowForm] = useState(false)
  const [period, setPeriod] = useState<Period>('month')
  const [view, setView] = useState<View>('list')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [limitDraft, setLimitDraft] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')

  const { from, to } = periodRange(period)

  const allExpenses = transactions.filter(t => t.type === 'expense' && t.date >= from && t.date <= to)
  const expenses = categoryFilter
    ? allExpenses.filter(t => t.category_id === categoryFilter)
    : allExpenses

  const total = expenses.reduce((s, t) => s + t.amount, 0)
  const allTotal = allExpenses.reduce((s, t) => s + t.amount, 0)
  const days = period === 'month' ? new Date().getDate() : 7
  const avgPerDay = days > 0 ? Math.round(allTotal / days) : 0

  const spendingByCategory: Record<string, number> = {}
  for (const t of allExpenses) {
    if (t.category_id) spendingByCategory[t.category_id] = (spendingByCategory[t.category_id] ?? 0) + t.amount
  }

  const activeCategories = categories
    .filter(c => (spendingByCategory[c.id] ?? 0) > 0)
    .sort((a, b) => (spendingByCategory[b.id] ?? 0) - (spendingByCategory[a.id] ?? 0))

  const pocketMap = Object.fromEntries(pockets.map(p => [p.id, p])) as Record<string, Pocket>
  const grouped = groupByDate(expenses)

  if (loadingT || loadingC) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm) {
    return (
      <ExpenseForm
        userId={userId} pockets={pockets} categories={categories}
        seedDefaults={seedDefaults} addCategory={addCategory} deleteCategory={deleteCategory}
        addTransaction={addTransaction} onDone={() => setShowForm(false)} onCancel={() => setShowForm(false)}
      />
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <PageHeader
        title="Gastos"
        right={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
            <Plus size={14} /> Registrar
          </button>
        }
      />

      {/* Period tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-4 border border-slate-700/50">
        {([['week', 'Esta semana'], ['month', 'Este mes']] as [Period, string][]).map(([p, label]) => (
          <button key={p} onClick={() => { setPeriod(p); setCategoryFilter(null) }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${period === p ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Summary card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-4 border border-slate-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              {period === 'week' ? 'Últimos 7 días' : 'Este mes'}
            </p>
            <p className="text-3xl font-bold text-red-400">{maskAmount(total, false)}</p>
            <p className="text-xs text-slate-500 mt-1">
              Promedio {maskAmount(avgPerDay, false)} / día
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Registros</p>
            <p className="text-lg font-bold text-slate-300">{allExpenses.length}</p>
          </div>
        </div>

        {/* Top categories mini bar chart */}
        {activeCategories.length > 0 && (
          <div className="space-y-2 border-t border-slate-700/60 pt-3">
            {activeCategories.slice(0, 3).map(c => {
              const spent = spendingByCategory[c.id] ?? 0
              const pct = allTotal > 0 ? (spent / allTotal) * 100 : 0
              return (
                <button key={c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
                  className="w-full flex items-center gap-2 group">
                  <span className="text-sm w-5 text-center">{c.icon}</span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${categoryFilter === c.id ? 'bg-red-400' : 'bg-red-600/50'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 w-20 text-right">{maskAmount(spent, false)}</span>
                  <span className="text-xs text-slate-600 w-8 text-right">{pct.toFixed(0)}%</span>
                </button>
              )
            })}
            {activeCategories.length > 3 && (
              <p className="text-xs text-slate-600 text-center pt-1">
                +{activeCategories.length - 3} categorías más
              </p>
            )}
          </div>
        )}
      </div>

      {/* View tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <button onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${view === 'list' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
            <LayoutList size={12} /> Historial
          </button>
          <button onClick={() => setView('categories')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${view === 'categories' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
            <Tags size={12} /> Categorías
          </button>
        </div>
        {categoryFilter && (
          <button onClick={() => setCategoryFilter(null)}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-400/10 px-2 py-1 rounded-full transition-colors">
            <X size={10} /> Filtro activo
          </button>
        )}
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {/* Category filter chips */}
          {activeCategories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
              <button onClick={() => setCategoryFilter(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!categoryFilter ? 'bg-red-600/20 border-red-500/60 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                Todas
              </button>
              {activeCategories.map(c => (
                <button key={c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${categoryFilter === c.id ? 'bg-red-600/20 border-red-500/60 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          )}

          {grouped.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <TrendingDown size={28} className="text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm font-medium">Sin gastos {period === 'week' ? 'esta semana' : 'este mes'}</p>
              <p className="text-slate-600 text-xs mt-1">Registra tu primer gasto</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ date, items, total: dayTotal }) => (
                <div key={date}>
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{formatDate(date)}</p>
                    <p className="text-xs text-red-400 font-bold">− {maskAmount(dayTotal, false)}</p>
                  </div>
                  <div className="space-y-2">
                    {items.map(t => (
                      <ExpenseCard key={t.id} tx={t} categories={categories} pocket={pocketMap[t.pocket_id]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CATEGORIES VIEW ────────────────────────────────── */}
      {view === 'categories' && (
        <div className="space-y-3">
          {categories.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Sin categorías. Agrega una abajo.</p>
          ) : (
            categories.map(c => {
              const spent = spendingByCategory[c.id] ?? 0
              const hasLimit = c.monthly_limit !== null && c.monthly_limit > 0
              const overLimit = hasLimit && spent > c.monthly_limit!
              const pct = hasLimit ? Math.min(100, (spent / c.monthly_limit!) * 100) : 0
              return (
                <div key={c.id} className={`bg-slate-800 rounded-2xl p-4 border transition-colors ${overLimit ? 'border-red-500/40' : 'border-slate-700'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">{c.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-slate-200 text-sm font-semibold">{c.name}</p>
                        <div className="flex items-center gap-2">
                          {overLimit && <span className="text-xs text-red-400">⚠️ Excedido</span>}
                          <button onClick={() => { setEditingCategory(c); setLimitDraft(c.monthly_limit?.toString() ?? '') }}
                            className="text-slate-600 hover:text-slate-300 p-1 transition-colors">
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                      {hasLimit ? (
                        <>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-xs font-medium ${overLimit ? 'text-red-400' : 'text-slate-300'}`}>{maskAmount(spent, false)}</span>
                            <span className="text-slate-600 text-xs">/</span>
                            <span className="text-xs text-slate-500">{maskAmount(c.monthly_limit!, false)}</span>
                            <span className="text-xs text-slate-600 ml-auto">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${overLimit ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-purple-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {spent > 0 ? maskAmount(spent, false) + ' gastado' : 'Sin gastos · Sin límite'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {/* Add category */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-dashed border-slate-600 mt-4">
            <p className="text-xs text-slate-400 font-semibold mb-3">Nueva categoría</p>
            <div className="flex gap-2 mb-3">
              <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} maxLength={2}
                className="w-12 h-10 bg-slate-700 rounded-xl text-center text-xl border border-slate-600 focus:outline-none focus:border-blue-500" />
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nombre…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <button onClick={async () => {
              if (!newCatName.trim()) return
              await addCategory({ user_id: userId, name: newCatName.trim(), icon: newCatIcon, monthly_limit: null, is_default: false })
              setNewCatName(''); setNewCatIcon('📦')
            }} disabled={!newCatName.trim()}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              + Agregar categoría
            </button>
          </div>
        </div>
      )}

      {/* Edit limit sheet */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
          <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">
                {editingCategory.icon}
              </div>
              <div className="flex-1">
                <p className="text-slate-100 font-semibold">{editingCategory.name}</p>
                <p className="text-xs text-slate-500">Configurar límite mensual</p>
              </div>
              <button onClick={() => setEditingCategory(null)} className="text-slate-500 hover:text-slate-300 p-1">
                <X size={16} />
              </button>
            </div>
            <AmountInput label="Límite mensual (dejar en 0 para quitar)" value={limitDraft} onChange={setLimitDraft} className="mb-5" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => {
                deleteCategory(editingCategory.id)
                setEditingCategory(null)
              }} className="py-3 rounded-xl border border-red-700/40 text-red-400 text-sm hover:bg-red-400/10 transition-colors">
                Eliminar
              </button>
              <button onClick={async () => {
                const limit = parseAmount(limitDraft)
                await updateCategory(editingCategory.id, { monthly_limit: limit > 0 ? limit : null })
                setEditingCategory(null)
              }} className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Expense card ─────────────────────────────────────────────────────────────

function ExpenseCard({ tx, categories, pocket }: { tx: Transaction; categories: Category[]; pocket?: Pocket }) {
  const category = categories.find(c => c.id === tx.category_id)
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700/60 p-3.5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <span className="text-base">{category?.icon ?? '💸'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-200 text-sm font-medium truncate leading-snug">
            {tx.note ?? category?.name ?? 'Gasto'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {category && tx.note && (
              <span className="text-xs text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded-full">{category.icon} {category.name}</span>
            )}
            {pocket && (
              <span className="text-xs text-slate-600">{pocket.icon} {pocket.name}</span>
            )}
          </div>
        </div>
        <p className="text-red-400 font-bold text-sm flex-shrink-0 mt-0.5">− {maskAmount(tx.amount, false)}</p>
      </div>
    </div>
  )
}
