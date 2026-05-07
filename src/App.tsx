import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { AuthPage } from '@/pages/auth/AuthPage'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingFlow } from '@/pages/onboarding/OnboardingFlow'
import { HomePage } from '@/pages/home/HomePage'
import { PocketsPage } from '@/pages/pockets/PocketsPage'
import { RegisterPage } from '@/pages/register/RegisterPage'
import { HistoryPage } from '@/pages/history/HistoryPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { IncomePage } from '@/pages/income/IncomePage'
import { ExpensesPage } from '@/pages/expenses/ExpensesPage'
import { DebtsPage } from '@/pages/debts/DebtsPage'
import { CollectionsPage } from '@/pages/collections/CollectionsPage'
import { SavingsPage } from '@/pages/savings/SavingsPage'
import { CadenaPage } from '@/pages/cadena/CadenaPage'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) { setOnboardingDone(null); return }

    async function checkOnboarding() {
      // 1. Check local IndexedDB first (fast path)
      const localProfile = await db.user_profiles.get(user!.id)
      if (localProfile) {
        setOnboardingDone(localProfile.onboarding_completed)
        return
      }

      // 2. Fallback: check Supabase (user on new device or after clearing storage)
      const { data } = await supabase
        .from('user_profiles')
        .select('onboarding_completed, name, balance_hidden, created_at')
        .eq('id', user!.id)
        .single()

      if (data?.onboarding_completed) {
        // Sync profile to local DB so next check is instant
        await db.user_profiles.put({
          id: user!.id,
          name: data.name ?? '',
          onboarding_completed: true,
          balance_hidden: data.balance_hidden ?? false,
          created_at: data.created_at ?? new Date().toISOString()
        })
        setOnboardingDone(true)
      } else {
        setOnboardingDone(false)
      }
    }

    checkOnboarding()
  }, [user])

  if (loading || (user && onboardingDone === null)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Cargando...</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  if (!onboardingDone) {
    return <OnboardingFlow userId={user.id} onComplete={() => setOnboardingDone(true)} />
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/"           element={<HomePage />} />
        <Route path="/bolsillos"  element={<PocketsPage userId={user.id} />} />
        <Route path="/registrar"  element={<RegisterPage userId={user.id} />} />
        <Route path="/historial"  element={<HistoryPage />} />
        <Route path="/reportes"   element={<ReportsPage />} />
        <Route path="/ingresos"   element={<IncomePage userId={user.id} />} />
        <Route path="/gastos"     element={<ExpensesPage userId={user.id} />} />
        <Route path="/deudas"     element={<DebtsPage userId={user.id} />} />
        <Route path="/cobros"     element={<CollectionsPage userId={user.id} />} />
        <Route path="/ahorros"    element={<SavingsPage userId={user.id} />} />
        <Route path="/cadena"     element={<CadenaPage userId={user.id} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
