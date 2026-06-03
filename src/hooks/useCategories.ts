import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/db'
import type { Category, CategoryKind } from '@/types'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/types'

type NewCategory = Omit<Category, 'id' | 'created_at'>

interface CategoriesHook {
  categories: Category[]
  loading: boolean
  addCategory: (c: NewCategory) => Promise<void>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  /** Deletes the category and orphans any transactions referencing it (category_id → null). */
  deleteCategory: (id: string) => Promise<void>
  seedDefaults: () => Promise<void>
  byKind: (kind: CategoryKind) => Category[]
}

export function useCategories(userId: string): CategoriesHook {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const load = useCallback(async () => {
    const data = await db.categories.where('user_id').equals(userId).sortBy('name')
    if (!mountedRef.current) return
    setCategories(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const seedDefaults = async () => {
    const existing = await db.categories.where('user_id').equals(userId).count()
    if (existing > 0) return
    const now = new Date().toISOString()
    const make = (c: { name: string; icon: string }, kind: CategoryKind): Category => ({
      id: crypto.randomUUID(),
      user_id: userId,
      name: c.name,
      icon: c.icon,
      kind,
      monthly_limit: null,
      is_default: true,
      created_at: now
    })
    const defaults: Category[] = [
      ...DEFAULT_EXPENSE_CATEGORIES.map(c => make(c, 'expense')),
      ...DEFAULT_INCOME_CATEGORIES.map(c => make(c, 'income')),
    ]
    await db.categories.bulkAdd(defaults)
    await load()
  }

  const addCategory = async (c: NewCategory) => {
    await db.categories.add({ ...c, id: crypto.randomUUID(), created_at: new Date().toISOString() })
    await load()
  }

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    await db.categories.update(id, updates)
    await load()
  }

  const deleteCategory = async (id: string) => {
    // Detach transactions referencing this category (don't lose the txns themselves)
    await db.transaction('rw', db.categories, db.transactions, async () => {
      const txs = await db.transactions
        .where('user_id').equals(userId)
        .filter(t => t.category_id === id)
        .toArray()
      for (const t of txs) await db.transactions.update(t.id, { category_id: null })
      await db.categories.delete(id)
    })
    await load()
  }

  const byKind = (kind: CategoryKind) =>
    categories.filter(c => (c.kind ?? 'expense') === kind)

  return { categories, loading, addCategory, updateCategory, deleteCategory, seedDefaults, byKind }
}
