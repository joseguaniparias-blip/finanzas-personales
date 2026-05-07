import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AuthPage } from '@/pages/auth/AuthPage'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/home/HomePage'
import { RegisterPage } from '@/pages/register/RegisterPage'
import { HistoryPage } from '@/pages/history/HistoryPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'

// PocketsPage will be wired in Task 8 — placeholder for now
function PocketsPagePlaceholder() {
  return <div className="p-4"><h1 className="text-slate-100 text-xl font-bold">Bolsillos</h1><p className="text-slate-400 text-sm mt-1">Bolsillos — Task 8</p></div>
}

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
        <Route path="/bolsillos" element={<PocketsPagePlaceholder />} />
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
