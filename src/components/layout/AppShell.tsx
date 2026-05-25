import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div
      className="min-h-screen bg-slate-950"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <Outlet />
      <BottomNav />
    </div>
  )
}
