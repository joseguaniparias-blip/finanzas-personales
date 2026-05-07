import { useState } from 'react'
import { Plus } from 'lucide-react'
import { usePockets } from '@/hooks/usePockets'
import { PocketCard } from './PocketCard'
import { PocketForm } from './PocketForm'
import { PrivacyToggle, maskAmount } from '@/components/shared/PrivacyToggle'
import type { Pocket } from '@/types'

interface Props { userId: string }

export function PocketsPage({ userId }: Props) {
  const { pockets, totalBalance, loading, addPocket, updatePocket, deletePocket } = usePockets(userId)
  const [hidden, setHidden] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Pocket | null>(null)

  if (loading) return <div className="p-4 text-slate-400 text-sm animate-pulse">Cargando...</div>

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 mb-6 border border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-slate-400">SALDO TOTAL</p>
          <PrivacyToggle hidden={hidden} onToggle={() => setHidden(h => !h)} />
        </div>
        <p className="text-3xl font-bold text-emerald-400">{maskAmount(totalBalance, hidden)}</p>
        <p className="text-xs text-slate-500 mt-1">{pockets.length} bolsillo{pockets.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Pockets list */}
      <div className="space-y-3 mb-4">
        {pockets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💳</p>
            <p className="text-slate-400 text-sm">Agrega tu primer bolsillo</p>
          </div>
        ) : (
          pockets.map(p => (
            <PocketCard key={p.id} pocket={p} hidden={hidden} onEdit={setEditing} />
          ))
        )}
      </div>

      {/* Add button */}
      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-dashed border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300 py-4 rounded-xl transition-colors text-sm">
        <Plus size={16} /> Agregar bolsillo
      </button>

      {/* Add/Edit form modal */}
      {(showForm || editing) && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditing(null) } }}
        >
          <div className="bg-slate-900 w-full max-w-lg rounded-t-3xl border-t border-slate-700 flex flex-col"
            style={{ maxHeight: '90dvh' }}>
            {/* Handle + title — fijos arriba */}
            <div className="flex-shrink-0 px-6 pt-4 pb-3">
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4" />
              <h2 className="text-base font-bold text-slate-100">
                {editing ? 'Editar bolsillo' : 'Nuevo bolsillo'}
              </h2>
            </div>
            {/* Contenido scrollable */}
            <div className="overflow-y-auto flex-1 px-6 pb-8">
              <PocketForm
                userId={userId}
                initial={editing ?? undefined}
                onSave={async data => {
                  if (editing) {
                    await updatePocket(editing.id, data)
                    setEditing(null)
                  } else {
                    await addPocket(data)
                    setShowForm(false)
                  }
                }}
                onDelete={editing ? async () => {
                  await deletePocket(editing.id)
                  setEditing(null)
                } : undefined}
                onCancel={() => { setShowForm(false); setEditing(null) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
