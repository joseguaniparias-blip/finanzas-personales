import { Outlet, Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { useIntegrityCheck } from '@/hooks/useIntegrityCheck'

export function AppShell({ userId }: { userId: string }) {
  const { drift, dismissed, dismiss } = useIntegrityCheck(userId)
  const showBanner = drift.length > 0 && !dismissed

  return (
    <div
      className="min-h-screen bg-slate-950"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      {showBanner && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-2.5">
          <span className="text-sm flex-shrink-0">⚠️</span>
          <p className="text-amber-200 text-xs flex-1">
            {drift.length === 1 ? 'Un bolsillo no cuadra' : `${drift.length} bolsillos no cuadran`} con tu historial.{' '}
            <Link to="/configuracion" className="underline font-medium">Revisar</Link>
          </p>
          <button onClick={dismiss} className="text-amber-400/70 hover:text-amber-300 flex-shrink-0 p-1" aria-label="Descartar">
            <X size={14} />
          </button>
        </div>
      )}
      <Outlet />
      <BottomNav />
    </div>
  )
}
