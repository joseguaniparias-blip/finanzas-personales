import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { usePlatforms } from '@/hooks/usePlatforms'
import { usePockets } from '@/hooks/usePockets'
import { useTransactions } from '@/hooks/useTransactions'
import { IncomeForm } from './IncomeForm'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Platform, Transaction } from '@/types'
import { TrendingUp, Plus } from 'lucide-react'

interface Props { userId: string }

export function IncomePage({ userId }: Props) {
  const { platforms, loading: loadingP } = usePlatforms(userId)
  const { pockets } = usePockets(userId)
  const { transactions, loading: loadingT, addTransaction } = useTransactions(userId)
  const [showForm, setShowForm] = useState(false)
  const [platformBalances, setPlatformBalances] = useState<Record<string, number>>({})

  useEffect(() => {
    async function loadBalances() {
      const wallets = await db.pockets.where('user_id').equals(userId).and(p => p.type === 'platform' && Boolean(p.is_active)).toArray()
      const map: Record<string, number> = {}
      for (const w of wallets) {
        if (w.platform_id) map[w.platform_id] = w.balance
      }
      setPlatformBalances(map)
    }
    loadBalances()
  }, [userId, transactions])

  const incomeTransactions = transactions.filter(t => t.type === 'income')

  const grouped = groupByDate(incomeTransactions)

  if (loadingP || loadingT) {
    return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>
  }

  if (showForm) {
    return (
      <IncomeForm
        userId={userId}
        platforms={platforms}
        pockets={pockets}
        addTransaction={addTransaction}
        onDone={() => setShowForm(false)}
        onCancel={() => setShowForm(false)}
      />
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader
        title="Ingresos"
        right={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus size={14} /> Registrar
          </button>
        }
      />

      {/* Platform wallets */}
      {platforms.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Billeteras actuales</p>
          <div className="grid grid-cols-2 gap-2">
            {platforms.map(p => (
              <PlatformWalletCard key={p.id} platform={p} balance={platformBalances[p.id] ?? 0} />
            ))}
          </div>
        </div>
      )}

      {/* Income history */}
      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp size={36} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin ingresos este mes</p>
          <p className="text-slate-600 text-xs mt-1">Registra tu primer ingreso</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{formatDate(date)}</p>
              <div className="space-y-2">
                {items.map(t => (
                  <IncomeCard key={t.id} tx={t} platforms={platforms} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlatformWalletCard({ platform, balance }: { platform: Platform; balance: number }) {
  return (
    <div
      className="rounded-xl p-3 border border-slate-700"
      style={{ backgroundColor: platform.color + '10', borderColor: platform.color + '30' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: platform.color }}>{platform.name}</p>
      <p className="text-slate-100 font-bold text-base">{maskAmount(balance, false)}</p>
      <p className="text-slate-500 text-xs mt-0.5">en billetera</p>
    </div>
  )
}

function IncomeCard({ tx, platforms }: { tx: Transaction; platforms: Platform[] }) {
  const platform = platforms.find(p => p.id === tx.platform_id)
  const isCash = tx.reference_type === 'income_cash'

  return (
    <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50">
      <span className="text-lg">{isCash ? '💵' : '📱'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 text-sm font-medium truncate">{tx.note ?? platform?.name ?? 'Ingreso'}</p>
        {platform && <p className="text-xs" style={{ color: platform.color }}>{platform.name}</p>}
      </div>
      <span className="text-emerald-400 font-semibold text-sm">{maskAmount(tx.amount, false)}</span>
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
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Hoy'
  if (dateStr === yesterday) return 'Ayer'
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}
