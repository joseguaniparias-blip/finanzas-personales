import { useState } from 'react'
import { LogOut, ChevronRight, User, Bell, Trash2, Plus, Tags, Pencil, Check, X } from 'lucide-react'
import type { Category, CategoryKind } from '@/types'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePlatforms } from '@/hooks/usePlatforms'
import { usePockets } from '@/hooks/usePockets'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/hooks/useAuth'
import { useSubmitLock } from '@/hooks/useSubmitLock'
import { db } from '@/lib/db'
import { DAYS_OF_WEEK, PLATFORM_DEFAULTS } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { checkIntegrity, healPocketBalances, type BalanceDrift } from '@/lib/integrity'

interface Props { userId: string }

type Section = 'main' | 'profile' | 'platforms' | 'category_limits' | 'categories' | 'integrity'

const PLATFORM_COLORS = ['#fb923c', '#60a5fa', '#4ade80', '#a78bfa', '#f87171', '#fbbf24', '#94a3b8']

export function ConfigPage({ userId }: Props) {
  const { profile, setHidden } = useUserProfile(userId)
  const { platforms, addPlatform, updatePlatform, deletePlatform } = usePlatforms(userId)
  const [confirmDeletePlatform, setConfirmDeletePlatform] = useState<string | null>(null)
  const [showAddPlatform, setShowAddPlatform] = useState(false)
  const [newPlatformName, setNewPlatformName] = useState('')
  const [newPlatformColor, setNewPlatformColor] = useState('#fb923c')
  const [newPlatformBalance, setNewPlatformBalance] = useState('')
  const { submitting: savingPlatform, submit: submitPlatform } = useSubmitLock()
  const { pockets } = usePockets(userId)
  const { categories, updateCategory, addCategory, deleteCategory } = useCategories(userId)
  const { signOut } = useAuth()
  const [section, setSection] = useState<Section>('main')
  const [name, setName] = useState(profile?.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [editingLimits, setEditingLimits] = useState<Record<string, string>>({})
  const [driftReport, setDriftReport] = useState<BalanceDrift[] | null>(null)
  const [checkingIntegrity, setCheckingIntegrity] = useState(false)
  const [healing, setHealing] = useState(false)

  const nonPlatformPockets = pockets.filter(p => p.type !== 'platform')

  if (section === 'profile') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <PageHeader title="Perfil" />
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-1">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <button
          onClick={async () => {
            if (!name.trim()) return
            setSavingName(true)
            await db.user_profiles.update(userId, { name: name.trim() })
            setSavingName(false)
            setSection('main')
          }}
          disabled={savingName || !name.trim()}
          className="w-full bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
          {savingName ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    )
  }

  const handleAddPlatform = () => {
    if (!newPlatformName.trim()) return
    submitPlatform(async () => {
      const pName = newPlatformName.trim()
      const def = PLATFORM_DEFAULTS[pName] ?? { color: newPlatformColor, icon: '📲' }
      const color = def.color ?? newPlatformColor
      const icon = def.icon ?? '📲'
      const initialBalance = parseAmount(newPlatformBalance)
      const np = pockets.filter(p => p.type !== 'platform')
      const platform = await addPlatform({
        user_id: userId,
        name: pName,
        color,
        payout_day: null,
        payout_pocket_id: np[0]?.id ?? null,
        is_active: true
      })
      // Create platform wallet pocket with initial balance
      await db.pockets.add({
        id: crypto.randomUUID(),
        user_id: userId,
        name: pName,
        type: 'platform',
        platform_id: platform.id,
        balance: initialBalance,
        color,
        icon,
        is_active: true,
        created_at: new Date().toISOString()
      })
      setNewPlatformName('')
      setNewPlatformColor('#fb923c')
      setNewPlatformBalance('')
      setShowAddPlatform(false)
    })
  }

  if (section === 'platforms') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <PageHeader title="Plataformas" right={
          <button onClick={() => setShowAddPlatform(s => !s)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
            <Plus size={14} /> Nueva
          </button>
        } />

        {/* Add platform form */}
        {showAddPlatform && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 mb-4">
            <p className="text-slate-300 text-sm font-medium mb-3">Nueva plataforma</p>
            <input
              value={newPlatformName}
              onChange={e => {
                setNewPlatformName(e.target.value)
                const def = PLATFORM_DEFAULTS[e.target.value.trim()]
                if (def) setNewPlatformColor(def.color)
              }}
              placeholder="Ej: Rappi, Uber, DiDi…"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3"
            />
            <AmountInput
              label="Saldo actual en la billetera"
              value={newPlatformBalance}
              onChange={setNewPlatformBalance}
              placeholder="0"
              className="mb-3"
            />
            <div className="flex gap-2 flex-wrap mb-3">
              {PLATFORM_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewPlatformColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-colors ${newPlatformColor === c ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddPlatform(false)}
                className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 text-sm">Cancelar</button>
              <button onClick={handleAddPlatform} disabled={!newPlatformName.trim() || savingPlatform}
                className="flex-1 py-2 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold">
                {savingPlatform ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {platforms.map(p => (
            <div key={p.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-200 font-semibold text-sm">{p.name}</p>
                {confirmDeletePlatform === p.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">¿Eliminar?</span>
                    <button onClick={async () => { await deletePlatform(p.id); setConfirmDeletePlatform(null) }}
                      className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded-lg transition-colors">
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmDeletePlatform(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeletePlatform(p.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-2">Día de pago semanal</p>
                <div className="flex gap-1">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <button key={i}
                      onClick={() => updatePlatform(p.id, { payout_day: i })}
                      className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${p.payout_day === i ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">Bolsillo destino del pago</p>
                <div className="space-y-1">
                  {nonPlatformPockets.map(pocket => (
                    <button key={pocket.id}
                      onClick={() => updatePlatform(p.id, { payout_pocket_id: pocket.id })}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${p.payout_pocket_id === pocket.id ? 'bg-emerald-600/20 border border-emerald-500 text-slate-200' : 'bg-slate-700 border border-slate-600 text-slate-400'}`}>
                      <span>{pocket.icon}</span><span>{pocket.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {platforms.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">Sin plataformas configuradas</p>
          )}
        </div>
      </div>
    )
  }

  if (section === 'category_limits') {
    const expenseCats = categories.filter(c => (c.kind ?? 'expense') === 'expense')
    return (
      <div className="p-4 max-w-lg mx-auto">
        <PageHeader title="Límites por categoría" />
        <p className="text-slate-500 text-xs mb-4">Define un límite mensual opcional por categoría de gasto. Recibirás una alerta en reportes si lo superas.</p>
        <div className="space-y-3">
          {expenseCats.map(c => {
            const draft = editingLimits[c.id] ?? c.monthly_limit?.toString() ?? ''
            return (
              <div key={c.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700 flex items-center gap-3">
                <span className="text-xl">{c.icon}</span>
                <p className="text-slate-300 text-sm flex-1">{c.name}</p>
                <div className="w-36">
                  <AmountInput
                    label=""
                    value={draft}
                    onChange={v => setEditingLimits(prev => ({ ...prev, [c.id]: v }))}
                    placeholder="Sin límite"
                  />
                </div>
                <button
                  onClick={async () => {
                    const num = parseAmount(draft)
                    await updateCategory(c.id, { monthly_limit: num > 0 ? num : null })
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1.5 rounded-lg text-xs transition-colors">
                  ✓
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (section === 'categories') {
    return (
      <CategoryManager
        userId={userId}
        categories={categories}
        addCategory={addCategory}
        updateCategory={updateCategory}
        deleteCategory={deleteCategory}
      />
    )
  }

  if (section === 'integrity') {
    const runCheck = async () => {
      setCheckingIntegrity(true)
      try { setDriftReport(await checkIntegrity(userId)) }
      finally { setCheckingIntegrity(false) }
    }
    const runHeal = async () => {
      setHealing(true)
      try {
        await healPocketBalances(userId)
        setDriftReport(await checkIntegrity(userId))
      } finally { setHealing(false) }
    }
    const fmt = (n: number) => `$ ${n.toLocaleString('es-CO')}`

    return (
      <div className="p-4 max-w-lg mx-auto">
        <PageHeader title="Integridad de datos" />
        <p className="text-slate-500 text-xs mb-4">
          Recalcula el saldo real de cada bolsillo desde tu historial de movimientos y lo compara con el saldo guardado. Si algo no cuadra, aquí lo ves y lo corriges.
        </p>

        <button onClick={runCheck} disabled={checkingIntegrity}
          className="w-full bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold text-sm transition-colors mb-4">
          {checkingIntegrity ? 'Revisando…' : 'Revisar ahora'}
        </button>

        {driftReport !== null && driftReport.length === 0 && (
          <div className="bg-emerald-600/10 border border-emerald-600/25 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-emerald-300 text-sm font-medium">Todo cuadra</p>
            <p className="text-slate-500 text-xs mt-1">Cada bolsillo coincide con su historial.</p>
          </div>
        )}

        {driftReport !== null && driftReport.length > 0 && (
          <div className="space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-amber-300 text-sm font-semibold">
                {driftReport.length} {driftReport.length === 1 ? 'bolsillo no cuadra' : 'bolsillos no cuadran'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                El saldo guardado no coincide con la suma de sus movimientos.
              </p>
            </div>

            {driftReport.map(d => (
              <div key={d.pocketId} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-slate-200 text-sm font-medium mb-2">{d.pocketName}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Guardado</p>
                    <p className="text-slate-300 font-semibold">{fmt(d.stored)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Real (historial)</p>
                    <p className="text-emerald-300 font-semibold">{fmt(d.computed)}</p>
                  </div>
                </div>
                <p className={`text-xs mt-2 ${d.diff > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  Diferencia: {d.diff > 0 ? '+' : ''}{fmt(d.diff)}
                </p>
              </div>
            ))}

            <button onClick={runHeal} disabled={healing}
              className="w-full bg-emerald-600 disabled:opacity-40 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
              {healing ? 'Corrigiendo…' : 'Corregir saldos al valor real'}
            </button>
            <p className="text-slate-600 text-[11px] text-center">
              Ajusta cada saldo guardado al valor calculado desde tu historial. No borra movimientos.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Main screen
  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Configuración" />

      <div className="space-y-2 mb-6">
        <button onClick={() => setSection('profile')}
          className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700 transition-colors">
          <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center">
            <User size={16} className="text-blue-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-slate-200 text-sm font-medium">Perfil</p>
            <p className="text-slate-500 text-xs">{profile?.name ?? '…'}</p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </button>

        <button onClick={() => setSection('platforms')}
          className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700 transition-colors">
          <div className="w-9 h-9 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <span className="text-base">🛵</span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-slate-200 text-sm font-medium">Plataformas</p>
            <p className="text-slate-500 text-xs">{platforms.length} activas · días de pago</p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </button>

        <button onClick={() => setSection('categories')}
          className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700 transition-colors">
          <div className="w-9 h-9 rounded-full bg-cyan-600/20 flex items-center justify-center">
            <Tags size={16} className="text-cyan-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-slate-200 text-sm font-medium">Categorías</p>
            <p className="text-slate-500 text-xs">Editar ingresos y gastos · {categories.length} en total</p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </button>

        <button onClick={() => setSection('category_limits')}
          className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700 transition-colors">
          <div className="w-9 h-9 rounded-full bg-orange-600/20 flex items-center justify-center">
            <Bell size={16} className="text-orange-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-slate-200 text-sm font-medium">Límites de gasto</p>
            <p className="text-slate-500 text-xs">Alertas por categoría mensual</p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </button>

        <button onClick={() => { setSection('integrity'); setDriftReport(null) }}
          className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-700 transition-colors">
          <div className="w-9 h-9 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <span className="text-base">🛡️</span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-slate-200 text-sm font-medium">Integridad de datos</p>
            <p className="text-slate-500 text-xs">Verifica que tus saldos cuadren con el historial</p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </button>

        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-base">👁️</span>
          </div>
          <div className="flex-1">
            <p className="text-slate-200 text-sm font-medium">Ocultar saldos</p>
            <p className="text-slate-500 text-xs">Modo privacidad en inicio</p>
          </div>
          <button onClick={() => setHidden(!profile?.balance_hidden)}
            className={`w-11 h-6 rounded-full transition-colors relative ${profile?.balance_hidden ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${profile?.balance_hidden ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <button onClick={() => signOut()}
        className="w-full flex items-center justify-center gap-2 bg-red-600/10 border border-red-600/20 hover:bg-red-600/20 text-red-400 py-3 rounded-xl text-sm font-semibold transition-colors">
        <LogOut size={16} /> Cerrar sesión
      </button>
    </div>
  )
}

// ─── Category manager ────────────────────────────────────────────────────────

const CATEGORY_ICONS = ['📦','⛽','🔧','📱','🛡️','🛣️','🍔','🛒','💼','🏠','💵','💧','💡','📶','🎓','🎬','🍿','🚗','💳','🏥','📰']

interface CategoryManagerProps {
  userId: string
  categories: Category[]
  addCategory: (c: Omit<Category, 'id' | 'created_at'>) => Promise<void>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
}

function CategoryManager({ userId, categories, addCategory, updateCategory, deleteCategory }: CategoryManagerProps) {
  const [tab, setTab] = useState<CategoryKind>('expense')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('📦')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📦')

  const filtered = categories
    .filter(c => (c.kind ?? 'expense') === tab)
    .sort((a, b) => a.name.localeCompare(b.name))

  const startEdit = (c: Category) => {
    setEditingId(c.id)
    setEditName(c.name)
    setEditIcon(c.icon)
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    await updateCategory(editingId, { name: editName.trim(), icon: editIcon })
    setEditingId(null)
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    await addCategory({
      user_id: userId,
      name: newName.trim(),
      icon: newIcon,
      kind: tab,
      monthly_limit: null,
      is_default: false,
    })
    setNewName(''); setNewIcon('📦'); setShowAdd(false)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="Categorías" right={
        <button onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
          <Plus size={14} /> Nueva
        </button>
      } />

      {/* Kind tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-4">
        {(['expense', 'income'] as CategoryKind[]).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === k
                ? k === 'expense' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}>
            {k === 'expense' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
          <p className="text-slate-300 text-sm font-medium mb-3">
            Nueva categoría de {tab === 'expense' ? 'gasto' : 'ingreso'}
          </p>
          <div className="flex gap-2 mb-3">
            <select value={newIcon} onChange={e => setNewIcon(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-xl px-2 py-2.5 text-slate-100 text-base focus:outline-none focus:border-blue-500">
              {CATEGORY_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre…"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewIcon('📦') }}
              className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 text-sm">Cancelar</button>
            <button onClick={handleAdd} disabled={!newName.trim()}
              className="flex-1 py-2 rounded-xl bg-cyan-600 disabled:opacity-40 text-white text-sm font-semibold">
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-12">Sin categorías de {tab === 'expense' ? 'gasto' : 'ingreso'}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
              {editingId === c.id ? (
                <div className="flex items-center gap-2">
                  <select value={editIcon} onChange={e => setEditIcon(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-slate-100 text-base focus:outline-none">
                    {CATEGORY_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500" />
                  <button onClick={saveEdit} className="p-2 rounded-lg bg-emerald-600 text-white">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-2 rounded-lg text-slate-500">
                    <X size={14} />
                  </button>
                </div>
              ) : confirmDeleteId === c.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl">{c.icon}</span>
                  <p className="text-slate-300 text-sm flex-1">¿Eliminar "{c.name}"?</p>
                  <button onClick={async () => { await deleteCategory(c.id); setConfirmDeleteId(null) }}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1.5 rounded-lg">
                    Sí
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)}
                    className="text-xs text-slate-500 px-2 py-1.5">
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xl">{c.icon}</span>
                  <p className="text-slate-200 text-sm flex-1">{c.name}</p>
                  <button onClick={() => startEdit(c)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(c.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-4 text-center">
        Al eliminar, los movimientos quedan sin categoría (no se borran).
      </p>
    </div>
  )
}
