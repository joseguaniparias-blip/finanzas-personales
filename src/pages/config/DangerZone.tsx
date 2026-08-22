import { useEffect, useState } from 'react'
import { AlertTriangle, Download, RotateCcw, Trash2, WifiOff } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { downloadExport } from '@/lib/exportData'
import { countUserData, deleteAccount, resetAllData, type WipeStep } from '@/lib/wipe'

export type DangerMode = 'reset' | 'delete_account'

/** The word the user must type to arm the red button. */
export const CONFIRM_WORD = 'BORRAR'

const ENTITY_LABELS: Record<string, [string, string]> = {
  transactions:       ['movimiento', 'movimientos'],
  pockets:            ['bolsillo', 'bolsillos'],
  platforms:          ['plataforma', 'plataformas'],
  categories:         ['categoría', 'categorías'],
  debts:              ['deuda', 'deudas'],
  collections:        ['cobro', 'cobros'],
  saving_goals:       ['meta de ahorro', 'metas de ahorro'],
  cadenas:            ['cadena', 'cadenas'],
  scheduled_events:   ['evento de agenda', 'eventos de agenda'],
  recurring_payments: ['pago recurrente', 'pagos recurrentes'],
}

const COPY: Record<DangerMode, {
  title: string
  heading: string
  body: string
  cta: string
  ctaRunning: string
}> = {
  reset: {
    title: 'Empezar de cero',
    heading: '¿Borrar todos tus datos?',
    body: 'Se borra todo lo que has registrado, aquí y en la nube, y vuelves a la configuración inicial. Tu cuenta y tu correo siguen igual. Esto no se puede deshacer.',
    cta: 'Borrar todo y empezar de cero',
    ctaRunning: 'Borrando…',
  },
  delete_account: {
    title: 'Eliminar mi cuenta',
    heading: '¿Eliminar tu cuenta para siempre?',
    body: 'Se borra tu cuenta, tu correo y todos tus datos, aquí y en la nube. No podrás volver a entrar con este correo ni recuperar nada. Esto no se puede deshacer.',
    cta: 'Eliminar mi cuenta para siempre',
    ctaRunning: 'Eliminando…',
  },
}

const STEP_LABELS: Record<WipeStep, string> = {
  cloud: 'Borrando en la nube…',
  local: 'Limpiando este dispositivo…',
}

// ─── Menu rows on the main Configuración screen ──────────────────────────────

interface MenuProps { onSelect: (mode: DangerMode) => void }

export function DangerZoneMenu({ onSelect }: MenuProps) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-2 px-1">
        <AlertTriangle size={13} className="text-red-400" />
        <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">Zona de peligro</p>
      </div>
      <div className="space-y-2">
        <button onClick={() => onSelect('reset')}
          className="w-full flex items-center gap-3 bg-slate-800 border border-red-600/20 rounded-xl p-4 hover:bg-slate-700 transition-colors text-left">
          <div className="w-9 h-9 rounded-full bg-red-600/10 flex items-center justify-center shrink-0">
            <RotateCcw size={16} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-slate-200 text-sm font-medium">Empezar de cero</p>
            <p className="text-slate-400 text-xs">Borra todos tus datos y vuelve a la configuración inicial</p>
          </div>
        </button>

        <button onClick={() => onSelect('delete_account')}
          className="w-full flex items-center gap-3 bg-slate-800 border border-red-600/20 rounded-xl p-4 hover:bg-slate-700 transition-colors text-left">
          <div className="w-9 h-9 rounded-full bg-red-600/10 flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-slate-200 text-sm font-medium">Eliminar mi cuenta</p>
            <p className="text-slate-400 text-xs">Borra tu cuenta y todos tus datos para siempre</p>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Confirmation screen ─────────────────────────────────────────────────────

interface ConfirmProps {
  userId: string
  mode: DangerMode
  onBack: () => void
  /** Injected in tests; defaults to a real page reload. */
  onDone?: () => void
}

export function DangerConfirm({ userId, mode, onBack, onDone }: ConfirmProps) {
  const copy = COPY[mode]
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [step, setStep] = useState<WipeStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  )

  useEffect(() => {
    countUserData(userId).then(setCounts)
  }, [userId])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD && online && status !== 'running'

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadExport(userId)
      setExported(true)
    } catch {
      setError('No se pudo generar el respaldo.')
    } finally {
      setExporting(false)
    }
  }

  const handleConfirm = async () => {
    setStatus('running')
    setError(null)
    const opts = { onProgress: setStep }
    try {
      if (mode === 'reset') await resetAllData(userId, opts)
      else await deleteAccount(userId, opts)
      // A reload drops us cleanly into the onboarding (reset) or the login
      // screen (account deleted), with no live queries pointed at a store that
      // just changed underneath them.
      if (onDone) onDone()
      else window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.')
      setStatus('error')
      setStep(null)
    }
  }

  const summary = counts
    ? Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([key, n]) => {
          const [one, many] = ENTITY_LABELS[key] ?? [key, key]
          return `${n} ${n === 1 ? one : many}`
        })
    : []

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title={copy.title} />

      <div className="bg-red-600/10 border border-red-600/30 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm font-semibold mb-1">{copy.heading}</p>
            <p className="text-slate-300 text-xs leading-relaxed">{copy.body}</p>
          </div>
        </div>
      </div>

      {/* What exactly is being destroyed */}
      {counts && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
          <p className="text-slate-400 text-xs mb-2">Se borrarán:</p>
          {summary.length === 0 ? (
            <p className="text-slate-300 text-sm">No tienes datos registrados todavía.</p>
          ) : (
            <p className="text-slate-200 text-sm leading-relaxed">{summary.join(' · ')}</p>
          )}
        </div>
      )}

      {/* Safety net */}
      <button onClick={handleExport} disabled={exporting || status === 'running'}
        className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 text-slate-200 py-3 rounded-xl text-sm font-medium transition-colors mb-4">
        <Download size={15} />
        {exporting ? 'Preparando…' : exported ? 'Respaldo descargado ✓' : 'Descargar mis datos primero'}
      </button>

      {/* Typed confirmation */}
      <label className="block text-xs text-slate-400 mb-1">
        Escribe <span className="font-mono font-semibold text-red-400">{CONFIRM_WORD}</span> para confirmar
      </label>
      <input
        value={typed}
        onChange={e => setTyped(e.target.value)}
        disabled={status === 'running'}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder={CONFIRM_WORD}
        aria-label={`Escribe ${CONFIRM_WORD} para confirmar`}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-mono tracking-widest focus:outline-none focus:border-red-500 mb-4"
      />

      {!online && (
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-3 mb-4">
          <WifiOff size={15} className="text-amber-400 shrink-0" />
          <p className="text-slate-300 text-xs">
            Necesitas conexión para borrar tus datos. Sin internet no podemos borrarlos en la nube,
            y no queremos dejarlo a medias.
          </p>
        </div>
      )}

      {step && (
        <p className="text-slate-300 text-sm text-center mb-4 animate-pulse">{STEP_LABELS[step]}</p>
      )}

      {error && (
        <div className="bg-slate-800 border border-red-600/30 rounded-xl p-3 mb-4">
          <p className="text-red-300 text-xs font-semibold mb-1">No se completó</p>
          <p className="text-slate-300 text-xs leading-relaxed mb-1">{error}</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            No se borró nada en este dispositivo. Puedes intentarlo de nuevo sin riesgo.
          </p>
        </div>
      )}

      <button onClick={handleConfirm} disabled={!armed}
        className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors mb-2">
        {status === 'running' ? copy.ctaRunning : error ? 'Reintentar' : copy.cta}
      </button>

      <button onClick={onBack} disabled={status === 'running'}
        className="w-full py-3 rounded-xl text-slate-400 hover:text-slate-200 text-sm transition-colors">
        Cancelar
      </button>
    </div>
  )
}
