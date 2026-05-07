import { useState, useEffect, useCallback } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { db } from '@/lib/db'
import { usePockets } from '@/hooks/usePockets'
import { useCategories } from '@/hooks/useCategories'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
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

export function HistoryPage({ userId }: Props) {
  const { pockets } = usePockets(userId)
  const { categories } = useCategories(userId)
  const [period, setPeriod] = useState<Period>('month')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [pocketFilter, setPocketFilter] = useState<string>('all')
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

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
                  <div key={tx.id}
                    className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3">
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
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
