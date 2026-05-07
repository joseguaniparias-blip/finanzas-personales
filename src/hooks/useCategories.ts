import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { Category } from '@/types'
import { DEFAULT_CATEGORIES } from '@/types'

type NewCategory = Omit<Category, 'id' | 'created_at'>

interface CategoriesHook {
  categories: Category[]
  loading: boolean
  addCategory: (c: NewCategory) => Promise<void>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  seedDefaults: () => Promise<void>
}

export function useCategories(userId: string): CategoriesHook {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.categories.where('user_id').equals(userId).sortBy('name')
    setCategories(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const seedDefaults = async () => {
    const existing = await db.categories.where('user_id').equals(userId).count()
    if (existing > 0) return
    const now = new Date().toISOString()
    const defaults = DEFAULT_CATEGORIES.map(c => ({
      id: crypto.randomUUID(),
      user_id: userId,
      name: c.name,
      icon: c.icon,
      monthly_limit: null,
      is_default: true,
      created_at: now
    }))
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

  return { categories, loading, addCategory, updateCategory, seedDefaults }
}
