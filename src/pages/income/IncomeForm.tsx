import { useState, useEffect } from 'react'
import { Check, Plus, Trash2, Pencil, X } from 'lucide-react'
import type { Platform, Pocket, Transaction, Category } from '@/types'
import { AmountInput, parseAmount } from '@/components/shared/AmountInput'
import { maskAmount } from '@/components/shared/PrivacyToggle'
import { db } from '@/lib/db'
import { useSubmitLock } from '@/hooks/useSubmitLock'

const QUICK_ICONS = ['⛽','🔧','📱','🛡️','🛣️','🍔','🛒','💊','📦','🎮','👕','🚌','☕','🍕','💡']

interface Props {
  userId: string
  platforms: Platform[]
  pockets: Pocket[]
  categories: Category[]
  addCategory: (c: Omit<Category, 'id' | 'created_at'>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  seedDefaults: () => Promise<void>
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
  onDone: () => void
  onCancel: () => void
}

interface CashSplit {
  pocketId: string
  amount: string
}

type IncomeType = 'platform' | 'other'

export function IncomeForm({ userId, platforms, pockets, categories, addCategory, deleteCategory, seedDefaults, addTransaction, onDone, onCancel }: Props) {
  // Mode
  const [incomeType, setIncomeType] = useState<IncomeType>(platforms.length > 0 ? 'platform' : 'other')

  // Platform mode state
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? '')
  const [hasCash, setHasCash] = useState(false)
  const [cashSplits, setCashSplits] = useState<CashSplit[]>([
    { pocketId: pockets.find(p => p.type === 'cash')?.id ?? pockets.find(p => p.type !== 'platform')?.id ?? '', amount: '' }
  ])

  // Other income state
  const [otherNote, setOtherNote] = useState('')
  const [otherPocketId, setOtherPocketId] = useState(
    pockets.find(p => p.type === 'cash')?.id ?? pockets.find(p => p.type !== 'platform')?.id ?? ''
  )

  // Shared state
  const [total, setTotal] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const { submitting: saving, submit } = useSubmitLock()
  const [done, setDone] = useState(false)

  // Category manager
  const [managingCats, setManagingCats] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { seedDefaults() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    await addCategory({ user_id: userId, name: newCatName.trim(), icon: newCatIcon, monthly_limit: null, is_default: false })
    setNewCatName('')
    setNewCatIcon('📦')
  }

  const today = new Date().toISOString().slice(0, 10)
  const totalNum = parseAmount(total)

  const totalCash = cashSplits.reduce((s, sp) => s + parseAmount(sp.amount), 0)
  const digital = totalNum - totalCash
  const platform = platforms.find(p => p.id === platformId)
  // Fixed wallet: always look up by platform_id — never auto-create
  const platformPocket = pockets.find(p => p.platform_id === platformId)
  const nonPlatformPockets = pockets.filter(p => p.type !== 'platform')

  const cashValid = !hasCash || (totalCash > 0 && cashSplits.every(sp => parseAmount(sp.amount) > 0 && sp.pocketId))
  const canSavePlatform = totalNum > 0 && platformId && cashValid && Boolean(platformPocket)
  const canSaveOther = totalNum > 0 && otherPocketId && otherNote.trim().length > 0
  const canSave = incomeType === 'platform' ? canSavePlatform : canSaveOther

  const addSplit = () => {
    const usedIds = cashSplits.map(s => s.pocketId)
    const nextPocket = nonPlatformPockets.find(p => !usedIds.includes(p.id))
    setCashSplits(prev => [...prev, { pocketId: nextPocket?.id ?? '', amount: '' }])
  }
  const removeSplit = (i: number) => setCashSplits(prev => prev.filter((_, idx) => idx !== i))
  const updateSplit = (i: number, field: keyof CashSplit, value: string) =>
    setCashSplits(prev => prev.map((sp, idx) => idx === i ? { ...sp, [field]: value } : sp))

  const handleSave = () => {
    if (!canSave) return
    submit(async () => {
      if (incomeType === 'other') {
        // Simple income → selected pocket
        const pocket = pockets.find(p => p.id === otherPocketId)
        if (!pocket) return
        await addTransaction({
          user_id: userId,
          type: 'income',
          amount: totalNum,
          pocket_id: otherPocketId,
          category_id: categoryId,
          platform_id: null,
          reference_id: null,
          reference_type: 'income_other',
          note: otherNote.trim(),
          receipt_url: null,
          date
        })
        await db.pockets.update(otherPocketId, { balance: pocket.balance + totalNum })
      } else {
        // Platform income
        // Cash splits → their pockets
        if (hasCash) {
          for (const split of cashSplits) {
            const amt = parseAmount(split.amount)
            if (amt <= 0 || !split.pocketId) continue
            const p = pockets.find(pk => pk.id === split.pocketId)
            if (!p) continue
            await addTransaction({
              user_id: userId,
              type: 'income',
              amount: amt,
              pocket_id: split.pocketId,
              category_id: null,
              platform_id: platformId,
              reference_id: null,
              reference_type: 'income_cash',
              note: `Efectivo ${platform?.name ?? ''}`,
              receipt_url: null,
              date
            })
            await db.pockets.update(split.pocketId, { balance: p.balance + amt })
          }
        }

        // Digital portion → platform wallet (guaranteed to exist, can be positive or negative)
        if (platformPocket && digital !== 0) {
          const newBalance = platformPocket.balance + digital
          await db.pockets.update(platformPocket.id, { balance: newBalance })
          await db.transactions.add({
            id: crypto.randomUUID(),
            user_id: userId,
            type: digital > 0 ? 'income' : 'expense',
            amount: Math.abs(digital),
            pocket_id: platformPocket.id,
            category_id: null,
            platform_id: platformId,
            reference_id: null,
            reference_type: digital > 0 ? 'income_digital' : 'income_cash_excess',
            note: digital > 0
              ? `Digital ${platform?.name ?? ''}`
              : `Adelanto efectivo ${platform?.name ?? ''} — deuda con plataforma`,
            receipt_url: null,
            date,
            created_at: new Date().toISOString()
          })
        }
      }

      setDone(true)
      setTimeout(onDone, 1200)
    })
  }

  if (done) {
    const doneLabel = incomeType === 'other'
      ? otherNote.trim()
      : platform?.name ?? 'Ingreso'
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center">
          <Check size={32} className="text-emerald-400" />
        </div>
        <p className="text-emerald-400 font-semibold">Ingreso registrado</p>
        <p className="text-slate-500 text-sm">{maskAmount(totalNum, false)} · {doneLabel}</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-100 text-lg font-bold">Registrar ingreso</h2>
        <button onClick={onCancel} className="text-slate-500 text-sm">Cancelar</button>
      </div>

      {/* Type toggle */}
      <div className="flex gap-2 mb-5 p-1 bg-slate-800 rounded-xl border border-slate-700">
        <button
          onClick={() => setIncomeType('platform')}
          disabled={platforms.length === 0}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
            incomeType === 'platform'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-200 disabled:opacity-30'
          }`}
        >
          📱 Plataforma
        </button>
        <button
          onClick={() => setIncomeType('other')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
            incomeType === 'other'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          💵 Otro ingreso
        </button>
      </div>

      {/* ── PLATFORM MODE ───────────────────────────────── */}
      {incomeType === 'platform' && (
        <>
          {/* Platform selector */}
          <div className="mb-5">
            <p className="text-xs text-slate-400 mb-2">Plataforma</p>
            {platforms.length === 0 ? (
              <p className="text-slate-500 text-sm">No tienes plataformas activas</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {platforms.map(p => (
                  <button key={p.id} onClick={() => setPlatformId(p.id)}
                    style={{ borderColor: platformId === p.id ? p.color : undefined, backgroundColor: platformId === p.id ? p.color + '20' : undefined }}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${platformId === p.id ? 'text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {/* Wallet warning if no pocket found */}
            {platformId && !platformPocket && (
              <div className="mt-3 bg-amber-600/10 border border-amber-600/30 rounded-xl p-3">
                <p className="text-amber-400 text-xs font-medium">⚠️ Esta plataforma no tiene billetera</p>
                <p className="text-slate-400 text-xs mt-0.5">Ve a Configuración → Plataformas y vuelve a crearla.</p>
              </div>
            )}
          </div>

          {/* Total */}
          <AmountInput label="Total ganado" value={total} onChange={setTotal} className="mb-4" />

          {/* Date */}
          <div className="mb-5">
            <label className="block text-xs text-slate-400 mb-1">Fecha</label>
            <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
          </div>

          {/* Category */}
          <CategoryPicker
            categories={categories}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            managingCats={managingCats}
            setManagingCats={setManagingCats}
            editingCat={editingCat}
            setEditingCat={setEditingCat}
            editName={editName}
            setEditName={setEditName}
            newCatName={newCatName}
            setNewCatName={setNewCatName}
            newCatIcon={newCatIcon}
            setNewCatIcon={setNewCatIcon}
            handleAddCategory={handleAddCategory}
            deleteCategory={deleteCategory}
            addCategory={addCategory}
            userId={userId}
          />

          {/* Cash toggle */}
          <div className="bg-slate-800 rounded-xl p-4 mb-5 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm font-medium">¿Recibiste efectivo?</p>
                <p className="text-slate-500 text-xs mt-0.5">Propinas, pagos en mano, adelantos…</p>
              </div>
              <button onClick={() => setHasCash(h => !h)}
                className={`w-11 h-6 rounded-full transition-colors relative ${hasCash ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${hasCash ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {hasCash && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-400">¿A qué bolsillos llega el efectivo?</p>
                {cashSplits.map((split, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex gap-1 flex-wrap">
                      {nonPlatformPockets.map(p => (
                        <button key={p.id} onClick={() => updateSplit(i, 'pocketId', p.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors border ${split.pocketId === p.id ? 'bg-emerald-600/20 border-emerald-500 text-slate-200' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                          <span>{p.icon}</span>{p.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 items-center">
                      <AmountInput label="" value={split.amount} onChange={v => updateSplit(i, 'amount', v)} className="flex-1" />
                      {cashSplits.length > 1 && (
                        <button onClick={() => removeSplit(i)}
                          className="p-2 rounded-lg bg-slate-700 text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {cashSplits.length < nonPlatformPockets.length && (
                  <button onClick={addSplit}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    <Plus size={12} /> Agregar otro bolsillo
                  </button>
                )}
                {totalNum > 0 && totalCash > totalNum && (
                  <div className="bg-amber-600/10 border border-amber-600/30 rounded-xl p-3">
                    <p className="text-amber-400 text-xs font-medium">⚠️ El efectivo supera lo ganado</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      La billetera de {platform?.name} quedará con −{maskAmount(totalCash - totalNum, false)}.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Platform summary */}
          {totalNum > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 mb-5 border border-slate-700 space-y-2">
              {hasCash && cashSplits.map((split, i) => {
                const amt = parseAmount(split.amount)
                const pocket = pockets.find(p => p.id === split.pocketId)
                if (!amt || !pocket) return null
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-400">Efectivo → {pocket.icon} {pocket.name}</span>
                    <span className="text-emerald-400 font-medium">{maskAmount(amt, false)}</span>
                  </div>
                )
              })}
              {digital > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Digital → billetera {platform?.name}</span>
                  <span className="text-blue-400 font-medium">{maskAmount(digital, false)}</span>
                </div>
              )}
              {digital < 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Deuda con {platform?.name}</span>
                  <span className="text-red-400 font-medium">−{maskAmount(Math.abs(digital), false)}</span>
                </div>
              )}
              <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-slate-300">Total</span>
                <span className="text-slate-100">{maskAmount(totalNum, false)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── OTHER INCOME MODE ───────────────────────────── */}
      {incomeType === 'other' && (
        <>
          {/* Description */}
          <div className="mb-5">
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <input
              value={otherNote}
              onChange={e => setOtherNote(e.target.value)}
              placeholder="Ej: Salario, Freelance, Venta…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Amount */}
          <AmountInput label="Monto" value={total} onChange={setTotal} className="mb-4" />

          {/* Date */}
          <div className="mb-5">
            <label className="block text-xs text-slate-400 mb-1">Fecha</label>
            <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
          </div>

          {/* Category */}
          <CategoryPicker
            categories={categories}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            managingCats={managingCats}
            setManagingCats={setManagingCats}
            editingCat={editingCat}
            setEditingCat={setEditingCat}
            editName={editName}
            setEditName={setEditName}
            newCatName={newCatName}
            setNewCatName={setNewCatName}
            newCatIcon={newCatIcon}
            setNewCatIcon={setNewCatIcon}
            handleAddCategory={handleAddCategory}
            deleteCategory={deleteCategory}
            addCategory={addCategory}
            userId={userId}
          />

          {/* Destination pocket */}
          <div className="mb-6">
            <p className="text-xs text-slate-400 mb-2">¿A qué bolsillo entra?</p>
            <div className="space-y-1">
              {nonPlatformPockets.map(p => (
                <button
                  key={p.id}
                  onClick={() => setOtherPocketId(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors border ${
                    otherPocketId === p.id
                      ? 'bg-emerald-600/20 border-emerald-500 text-slate-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span className="flex-1 text-left">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-emerald-600 disabled:opacity-40 hover:bg-emerald-500 text-white py-4 rounded-xl font-semibold text-sm transition-colors">
        {saving ? 'Guardando…' : 'Guardar ingreso'}
      </button>
    </div>
  )
}

// ─── Shared category picker ───────────────────────────────────────────────────

interface CategoryPickerProps {
  categories: Category[]
  categoryId: string | null
  setCategoryId: (id: string | null) => void
  managingCats: boolean
  setManagingCats: (v: boolean | ((p: boolean) => boolean)) => void
  editingCat: Category | null
  setEditingCat: (c: Category | null) => void
  editName: string
  setEditName: (v: string) => void
  newCatName: string
  setNewCatName: (v: string) => void
  newCatIcon: string
  setNewCatIcon: (v: string) => void
  handleAddCategory: () => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addCategory: (c: Omit<Category, 'id' | 'created_at'>) => Promise<void>
  userId: string
}

function CategoryPicker({
  categories, categoryId, setCategoryId,
  managingCats, setManagingCats,
  editingCat, setEditingCat, editName, setEditName,
  newCatName, setNewCatName, newCatIcon, setNewCatIcon,
  handleAddCategory, deleteCategory, addCategory, userId
}: CategoryPickerProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">Categoría <span className="text-slate-600">(opcional)</span></p>
        <button onClick={() => { setManagingCats(m => !m); setEditingCat(null) }}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <Pencil size={10} /> {managingCats ? 'Listo' : 'Gestionar'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {categories.map(c => (
          <div key={c.id}>
            {managingCats ? (
              editingCat?.id === c.id ? (
                <div className="flex items-center gap-1">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-100 w-24 focus:outline-none focus:border-blue-500" />
                  <button onClick={async () => {
                    if (editName.trim()) {
                      await deleteCategory(c.id)
                      await addCategory({ user_id: userId, name: editName.trim(), icon: c.icon, monthly_limit: c.monthly_limit, is_default: false })
                      if (categoryId === c.id) setCategoryId(null)
                    }
                    setEditingCat(null)
                  }} className="text-xs text-emerald-400 px-1">✓</button>
                  <button onClick={() => setEditingCat(null)} className="text-xs text-slate-500 px-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1.5">
                  <span className="text-xs">{c.icon}</span>
                  <span className="text-xs text-slate-300">{c.name}</span>
                  <button onClick={() => { setEditingCat(c); setEditName(c.name) }}
                    className="text-slate-500 hover:text-slate-300 ml-0.5"><Pencil size={9} /></button>
                  <button onClick={async () => { await deleteCategory(c.id); if (categoryId === c.id) setCategoryId(null) }}
                    className="text-slate-500 hover:text-red-400 ml-0.5"><X size={9} /></button>
                </div>
              )
            ) : (
              <button onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  categoryId === c.id ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-300' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
                }`}>
                <span>{c.icon}</span> {c.name}
              </button>
            )}
          </div>
        ))}
      </div>
      {managingCats && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-2">Nueva categoría</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_ICONS.map(ic => (
              <button key={ic} onClick={() => setNewCatIcon(ic)}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${newCatIcon === ic ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                {ic}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
              placeholder="Nombre…"
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <button onClick={handleAddCategory} disabled={!newCatName.trim()}
              className="flex items-center gap-1 bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
              <Plus size={12} /> Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
