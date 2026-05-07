import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface Props {
  title: string
  right?: React.ReactNode
}

export function PageHeader({ title, right }: Props) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        onClick={() => navigate(-1)}
        className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
        aria-label="Volver"
      >
        <ArrowLeft size={18} />
      </button>
      <h1 className="text-slate-100 text-xl font-bold flex-1">{title}</h1>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}
