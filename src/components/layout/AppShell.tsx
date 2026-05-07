import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <Outlet />
      <BottomNav />
    </div>
  )
}
