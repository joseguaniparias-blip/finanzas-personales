import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/db'
import { usePlatforms } from '@/hooks/usePlatforms'
import { useCategories } from '@/hooks/useCategories'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Transaction } from '@/types'
import { DateRangeFilter, buildPreset, type DateRange } from '@/components/shared/DateRangeFilter'

interface Props { userId: string }

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct.toFixed(1)}%` }} />
    </div>
  )
}

export function ReportsPage({ userId }: Props) {
  const { platforms } = usePlatforms(userId)
  const { categories } = useCategories(userId)
  const [range, setRange] = useState<DateRange>(() => buildPreset('this_month'))
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = range
    const data = await db.transactions
      .where('user_id').equals(userId)
      .and(t => t.date >= from && t.date <= to)
      .sortBy('date')
    setTxs(data)
    setLoading(false)
  }, [userId, range])

  useEffect(() => { load() }, [load])

  const incomes  = txs.filter(t => t.type === 'income')
  const expenses = txs.filter(t => t.type === 'expense')
  const totalIncome  = incomes.reduce((s, t) => s + t.amount, 0)
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
  const netProfit = totalIncome - totalExpense

  // Income by platform
  const byPlatform = platforms.map(p => ({
    platform: p,
    total: incomes.filter(t => t.platform_id === p.id).reduce((s, t) => s + t.amount, 0)
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  const maxPlatform = Math.max(...byPlatform.map(x => x.total), 1)

  // Expense by category
  const byCategory = categories.map(c => ({
    category: c,
    total: expenses.filter(t => t.category_id === c.id).reduce((s, t) => s + t.amount, 0)
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  const maxCategory = Math.max(...byCategory.map(x => x.total), 1)

  // Top 5 expenses
  const top5 = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5)

  const periodLabel = range.label

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Reportes" />

      {/* Date range filter */}
      <div className="mb-5">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {loading && <p className="text-slate-500 text-sm animate-pulse text-center py-8">Calculando…</p>}

      {!loading && (
        <div className="space-y-5">
          {/* Ganancia neta */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Ganancia neta · {periodLabel}</p>
            <p className={`text-3xl font-bold mb-4 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netProfit >= 0 ? '+' : ''}{maskAmount(netProfit, false)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">↑ Ingresos</p>
                <p className="text-emerald-400 font-semibold text-sm">{maskAmount(totalIncome, false)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">↓ Gastos</p>
                <p className="text-red-400 font-semibold text-sm">{maskAmount(totalExpense, false)}</p>
              </div>
            </div>
          </div>

          {/* Ingresos por plataforma */}
          {byPlatform.length > 0 && (
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">Ingresos por plataforma</p>
              <div className="space-y-3">
                {byPlatform.map(({ platform: p, total }) => (
                  <div key={p.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 text-sm">{p.name}</span>
                      <span className="text-emerald-400 text-sm font-semibold">{maskAmount(total, false)}</span>
                    </div>
                    <Bar value={total} max={maxPlatform} color="bg-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gastos por categoría */}
          {byCategory.length > 0 && (
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">Gastos por categoría</p>
              <div className="space-y-3">
                {byCategory.map(({ category: c, total }) => {
                  const overLimit = c.monthly_limit && total > c.monthly_limit
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 text-sm">{c.icon} {c.name}</span>
                        <div className="text-right">
                          <span className={`text-sm font-semibold ${overLimit ? 'text-red-400' : 'text-slate-200'}`}>
                            {maskAmount(total, false)}
                          </span>
                          {c.monthly_limit && (
                            <span className="text-xs text-slate-500 ml-1">/ {maskAmount(c.monthly_limit, false)}</span>
                          )}
                        </div>
                      </div>
                      <Bar value={total} max={c.monthly_limit ?? maxCategory} color={overLimit ? 'bg-red-500' : 'bg-orange-500'} />
                      {overLimit && (
                        <p className="text-xs text-red-400 mt-0.5">⚠️ Límite superado en {maskAmount(total - c.monthly_limit!, false)}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top 5 gastos */}
          {top5.length > 0 && (
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Top gastos del período</p>
              <div className="space-y-2">
                {top5.map((tx, i) => {
                  const cat = categories.find(c => c.id === tx.category_id)
                  return (
                    <div key={tx.id} className="flex items-center gap-3">
                      <span className="text-slate-600 text-xs w-4">{i + 1}</span>
                      <span className="text-base">{cat?.icon ?? '💸'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 text-sm truncate">{tx.note ?? cat?.name ?? 'Gasto'}</p>
                        <p className="text-slate-600 text-xs">{tx.date}</p>
                      </div>
                      <p className="text-red-400 font-semibold text-sm">{maskAmount(tx.amount, false)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {byPlatform.length === 0 && byCategory.length === 0 && (
            <div className="text-center py-10">
              <p className="text-slate-500 text-sm">Sin movimientos en este período</p>
              <p className="text-slate-600 text-xs mt-1">Registra ingresos y gastos para ver tus reportes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
