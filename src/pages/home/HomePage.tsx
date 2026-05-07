import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, CreditCard } from 'lucide-react'

const modules = [
  { to: '/ingresos',  icon: TrendingUp,   label: 'Ingresos',  color: 'emerald', desc: 'Plataformas y efectivo' },
  { to: '/gastos',    icon: TrendingDown,  label: 'Gastos',    color: 'red',     desc: 'Operación y personales' },
  { to: '/deudas',    icon: CreditCard,    label: 'Deudas',    color: 'blue',    desc: 'Créditos y compromisos' },
]

export function HomePage() {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-slate-100 text-xl font-bold mb-1">Mis Finanzas</h1>
      <p className="text-slate-500 text-sm mb-6">¿Qué quieres revisar hoy?</p>

      <div className="space-y-3">
        {modules.map(m => (
          <Link
            key={m.to}
            to={m.to}
            className={`flex items-center gap-4 p-4 rounded-2xl border border-${m.color}-600/20 bg-${m.color}-600/5 hover:bg-${m.color}-600/10 transition-colors`}
          >
            <div className={`w-10 h-10 rounded-full bg-${m.color}-600/20 flex items-center justify-center`}>
              <m.icon size={20} className={`text-${m.color}-400`} />
            </div>
            <div>
              <p className={`text-${m.color}-400 font-semibold text-sm`}>{m.label}</p>
              <p className="text-slate-500 text-xs">{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-slate-700 mt-8">Dashboard completo — Plan 5</p>
    </div>
  )
}
