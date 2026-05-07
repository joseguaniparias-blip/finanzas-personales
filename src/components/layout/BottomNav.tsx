import { NavLink } from 'react-router-dom'
import { Home, CreditCard, PlusCircle, List, BarChart2 } from 'lucide-react'

const tabs = [
  { to: '/',        icon: Home,       label: 'Inicio' },
  { to: '/bolsillos', icon: CreditCard, label: 'Bolsillos' },
  { to: '/registrar', icon: PlusCircle, label: 'Registrar', center: true },
  { to: '/historial', icon: List,       label: 'Historial' },
  { to: '/reportes',  icon: BarChart2,  label: 'Reportes' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                tab.center
                  ? 'bg-emerald-600 text-white p-2 rounded-full -mt-4 shadow-lg shadow-emerald-900'
                  : isActive
                    ? 'text-blue-400'
                    : 'text-slate-500'
              }`
            }
          >
            <tab.icon size={tab.center ? 26 : 20} />
            {!tab.center && <span className="text-[10px]">{tab.label}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
