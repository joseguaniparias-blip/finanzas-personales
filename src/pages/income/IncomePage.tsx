import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { usePlatforms } from '@/hooks/usePlatforms'
import { usePockets } from '@/hooks/usePockets'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { IncomeForm } from './IncomeForm'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Platform, Pocket, Transaction } from '@/types'
import { TrendingUp, Plus, Wallet } from 'lucide-react'
import { todayISO, addDaysISO } from '@/lib/date'
import { DateRangeFilter, buildPreset, type DateRange } from '@/components/shared/DateRangeFilter'

interface Props { userId: string }

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
  const today = todayISO()
  const yesterday = addDaysISO(todayISO(), -1)
  if (iso === today) return 'Hoy'
  if (iso === yesterday) return 'Ayer'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function IncomePage({ userId }: Props) {
  const { platforms, loading: loadingP } = usePlatforms(userId)
  const { pockets } = usePockets(userId)
  const { transactions, loading: loadingT, addTransaction } = useTransactions(userId)
  const { categories, addCategory, deleteCategory, seedDefaults } = useCategories(userId)
  const [showForm, setShowForm] = useState(false)
  const [range, setRange] = useState<DateRange>(() => buildPreset('this_month'))
  const [platformWallets, setPlatformWallets] = useState<(Pocket & { platformName: string; platformColor: string })[]>([])

  // Load platform wallets with their platform info
  useEffect(() => {
    async function loadWallets() {
      const wallets = await db.pockets
        .where('user_id').equals(userId)
        .and(p => p.type === 'platform' && Boolean(p.is_active))
        .toArray()
      const enriched = wallets.map(w => {
        const plat = platforms.find(p => p.id === w.platform_id)
        return { ...w, platformName: plat?.name ?? w.name, platformColor: plat?.color ?? '#60a5fa' }
      })
      setPlatformWallets(enriched)
    }
    if (!loadingP) loadWallets()
  }, [userId, transactions, platforms, loadingP])

  const { from, to } = range
  const allIncome = transactions.filter(t => t.type === 'income' && t.date >= from && t.date <= to)

  // Split: platform vs other
  const platformIncome = allIncome.filter(t => t.platform_id !== null)
  const otherIncome = allIncome.filter(t => t.platform_id === null)
  const total = allIncome.reduce((s, t) => s + t.amount, 0)
  const platTotal = platformIncome.reduce((s, t) => s + t.amount, 0)
  const otherTotal = otherIncome.reduce((s, t) => s + t.amount, 0)

  const grouped = groupByDate(allIncome)

  if (loadingP || loadingT) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm) {
    return (
      <IncomeForm
        userId={userId} platforms={platforms} pockets={pockets}
        categories={categories} addCategory={addCategory} deleteCategory={deleteCategory}
        seedDefaults={seedDefaults} addTransaction={addTransaction}
        onDone={() => setShowForm(false)} onCancel={() => setShowForm(false)}
      />
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <PageHeader
        title="Ingresos"
        right={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
            <Plus size={14} /> Registrar
          </button>
        }
      />

      {/* Date range filter */}
      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {/* Summary card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
          {range.label}
        </p>
        <p className="text-3xl font-bold text-emerald-400 mb-4">{maskAmount(total, false)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-0.5">📱 Plataformas</p>
            <p className="text-emerald-400 font-bold text-sm">{maskAmount(platTotal, false)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-0.5">💵 Otros</p>
            <p className="text-emerald-400 font-bold text-sm">{maskAmount(otherTotal, false)}</p>
          </div>
        </div>
      </div>

      {/* Platform wallets */}
      {platformWallets.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={12} className="text-slate-500" />
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Billeteras plataforma</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {platformWallets.map(w => (
              <div key={w.id} className="rounded-xl p-3.5 border"
                style={{ backgroundColor: w.platformColor + '08', borderColor: w.platformColor + '30' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">{w.icon}</span>
                  <p className="text-xs font-semibold truncate" style={{ color: w.platformColor }}>
                    {w.platformName}
                  </p>
                </div>
                <p className="text-slate-100 font-bold text-base">{maskAmount(w.balance, false)}</p>
                <p className="text-slate-500 text-xs mt-0.5">en billetera</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Income history */}
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={12} className="text-slate-500" />
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Historial</p>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-14">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Sin ingresos en {range.label.toLowerCase()}</p>
          <p className="text-slate-600 text-xs mt-1">Registra tu primer ingreso</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items, total: dayTotal }) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{formatDate(date)}</p>
                <p className="text-xs text-emerald-400 font-bold">+ {maskAmount(dayTotal, false)}</p>
              </div>
              <div className="space-y-2">
                {items.map(t => (
                  <IncomeCard key={t.id} tx={t} platforms={platforms} pockets={pockets} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Income card ──────────────────────────────────────────────────────────────

function IncomeCard({ tx, platforms, pockets }: { tx: Transaction; platforms: Platform[]; pockets: Pocket[] }) {
  const platform = platforms.find(p => p.id === tx.platform_id)
  const pocket = pockets.find(p => p.id === tx.pocket_id)
  const isCash = tx.reference_type === 'income_cash'
  const isOther = tx.reference_type === 'income_other'
  const isDigital = tx.reference_type === 'income_digital'

  const icon = isOther ? '💵' : isCash ? '💵' : '📱'
  const typeLabel = isOther ? 'Otro ingreso' : isCash ? 'Efectivo' : isDigital ? 'Digital' : platform?.name ?? 'Ingreso'

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700/60 p-3.5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
          <span className="text-base">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-200 text-sm font-medium truncate leading-snug">
            {tx.note ?? platform?.name ?? 'Ingreso'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {platform && !isOther && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ color: platform.color, backgroundColor: platform.color + '15' }}>
                {platform.name}
              </span>
            )}
            <span className="text-xs text-slate-600">{typeLabel}</span>
            {pocket && <span className="text-xs text-slate-600">· {pocket.icon} {pocket.name}</span>}
          </div>
        </div>
        <p className="text-emerald-400 font-bold text-sm flex-shrink-0 mt-0.5">+ {maskAmount(tx.amount, false)}</p>
      </div>
    </div>
  )
}
