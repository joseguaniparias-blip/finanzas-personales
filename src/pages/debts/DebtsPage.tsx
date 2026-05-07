import { useState } from 'react'
import { Plus, CreditCard } from 'lucide-react'
import { useDebts } from '@/hooks/useDebts'
import { useScheduledEvents } from '@/hooks/useScheduledEvents'
import { usePockets } from '@/hooks/usePockets'
import { DebtForm } from './DebtForm'
import { DebtDetail } from './DebtDetail'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import type { Debt } from '@/types'

interface Props { userId: string }

export function DebtsPage({ userId }: Props) {
  const { debts, loading, addDebt, updateDebt, recordPayment } = useDebts(userId)
  const { pockets } = usePockets(userId)
  const { confirmEvent, partialEvent, postponeEvent } = useScheduledEvents(userId)
  const [showForm, setShowForm] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando…</div>

  if (showForm || editingDebt) {
    return (
      <DebtForm
        userId={userId}
        pockets={pockets}
        initial={editingDebt ?? undefined}
        onSave={async data => {
          if (editingDebt) {
            await updateDebt(editingDebt.id, data)
            setEditingDebt(null)
          } else {
            await addDebt(data)
            setShowForm(false)
          }
        }}
        onCancel={() => { setShowForm(false); setEditingDebt(null) }}
      />
    )
  }

  if (selectedDebt) {
    return (
      <DebtDetail
        debt={selectedDebt}
        pockets={pockets}
        onBack={() => setSelectedDebt(null)}
        onConfirm={async (eventId, pocketId) => {
          await confirmEvent(eventId, pocketId)
          await recordPayment(selectedDebt.id, selectedDebt.installment_amount)
          setSelectedDebt(null)
        }}
        onPartial={async (eventId, pocketId, amount) => {
          await partialEvent(eventId, pocketId, amount)
          await recordPayment(selectedDebt.id, amount)
        }}
        onPostpone={async (eventId) => {
          await postponeEvent(eventId)
        }}
      />
    )
  }

  const totalDebt = debts.reduce((s, d) => {
    if (d.has_total && d.total_amount) return s + Math.max(0, d.total_amount - d.paid_amount)
    return s
  }, 0)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-slate-100 text-xl font-bold">Deudas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus size={14} /> Nueva
        </button>
      </div>

      {/* Summary */}
      {debts.length > 0 && totalDebt > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 mb-5 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">TOTAL POR PAGAR</p>
          <p className="text-2xl font-bold text-red-400">{maskAmount(totalDebt, false)}</p>
        </div>
      )}

      {debts.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard size={36} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin deudas activas</p>
          <p className="text-slate-600 text-xs mt-1">Registra créditos, préstamos o compromisos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map(d => (
            <DebtCard
              key={d.id}
              debt={d}
              onTap={() => setSelectedDebt(d)}
              onEdit={() => setEditingDebt(d)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DebtCard({ debt, onTap, onEdit }: { debt: Debt; onTap: () => void; onEdit: () => void }) {
  const progress = debt.has_total && debt.total_amount
    ? Math.min(1, debt.paid_amount / debt.total_amount)
    : null
  const remaining = debt.has_total && debt.total_amount
    ? Math.max(0, debt.total_amount - debt.paid_amount)
    : null

  return (
    <button
      onClick={onTap}
      className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors text-left"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-slate-200 font-semibold text-sm">{debt.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {maskAmount(debt.installment_amount, false)} / {debt.frequency === 'monthly' ? 'mes' : debt.frequency === 'weekly' ? 'semana' : 'día'}
          </p>
        </div>
        <div className="text-right ml-2">
          {debt.has_total && debt.total_amount ? (
            <>
              <p className="text-red-400 font-bold text-sm">{maskAmount(remaining!, false)}</p>
              <p className="text-xs text-slate-500">por pagar</p>
            </>
          ) : (
            <>
              <p className="text-slate-300 font-bold text-sm">{maskAmount(debt.paid_amount, false)}</p>
              <p className="text-xs text-slate-500">pagado</p>
            </>
          )}
        </div>
      </div>

      {progress !== null && (
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${(progress * 100).toFixed(1)}%` }}
          />
        </div>
      )}

      {!debt.has_total && (
        <span className="inline-block mt-2 text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Indefinida</span>
      )}
    </button>
  )
}
