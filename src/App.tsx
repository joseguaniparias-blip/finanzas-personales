import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/db'
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

function AppRoutes() {
  const { user, loading } = useAuth()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) { setOnboardingDone(null); return }
    db.user_profiles.get(user.id).then(profile => {
      setOnboardingDone(profile?.onboarding_completed ?? false)
    })
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
