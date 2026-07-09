import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { IncomeForm } from '@/pages/income/IncomeForm'
import { ExpenseForm } from '@/pages/expenses/ExpenseForm'
import { usePlatforms } from '@/hooks/usePlatforms'
import { usePockets } from '@/hooks/usePockets'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'

interface Props { userId: string }

export function RegisterPage({ userId }: Props) {
  const [mode, setMode] = useState<'select' | 'income' | 'expense'>('select')
  const { platforms } = usePlatforms(userId)
  const { pockets } = usePockets(userId)
  const { categories, addCategory, deleteCategory, seedDefaults } = useCategories(userId)
  const { addTransaction } = useTransactions(userId)

  if (mode === 'income') {
    return (
      <IncomeForm
        userId={userId}
        platforms={platforms}
        pockets={pockets}
        categories={categories}
        addCategory={addCategory}
        deleteCategory={deleteCategory}
        seedDefaults={seedDefaults}
        addTransaction={addTransaction}
        onDone={() => setMode('select')}
        onCancel={() => setMode('select')}
      />
    )
  }

  if (mode === 'expense') {
    return (
      <ExpenseForm
        userId={userId}
        pockets={pockets}
        categories={categories}
        seedDefaults={seedDefaults}
        addCategory={addCategory}
        deleteCategory={deleteCategory}
        addTransaction={addTransaction}
        onDone={() => setMode('select')}
        onCancel={() => setMode('select')}
      />
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Registrar" />
      <p className="text-slate-400 text-sm mb-8">¿Qué quieres registrar?</p>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setMode('income')}
          className="flex flex-col items-center gap-3 bg-emerald-600/10 border border-emerald-600/30 hover:bg-emerald-600/20 rounded-2xl p-6 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <TrendingUp size={24} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-emerald-400 font-semibold text-sm">Ingreso</p>
            <p className="text-slate-400 text-xs mt-0.5">Lo que ganaste hoy</p>
          </div>
        </button>

        <button
          onClick={() => setMode('expense')}
          className="flex flex-col items-center gap-3 bg-red-600/10 border border-red-600/30 hover:bg-red-600/20 rounded-2xl p-6 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
            <TrendingDown size={24} className="text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-red-400 font-semibold text-sm">Gasto</p>
            <p className="text-slate-400 text-xs mt-0.5">Lo que gastaste hoy</p>
          </div>
        </button>
      </div>
    </div>
  )
}
