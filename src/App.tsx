import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AuthPage } from '@/pages/auth/AuthPage'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/home/HomePage'
import { PocketsPage } from '@/pages/pockets/PocketsPage'
import { RegisterPage } from '@/pages/register/RegisterPage'
import { HistoryPage } from '@/pages/history/HistoryPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Cargando...</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/"          element={<HomePage />} />
        <Route path="/bolsillos" element={<PocketsPage userId={user.id} />} />
        <Route path="/registrar" element={<RegisterPage />} />
        <Route path="/historial" element={<HistoryPage />} />
        <Route path="/reportes"  element={<ReportsPage />} />
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
