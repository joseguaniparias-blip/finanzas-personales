import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import type { Platform } from '@/types'

type NewPlatform = Omit<Platform, 'id' | 'created_at'>

interface PlatformsHook {
  platforms: Platform[]
  loading: boolean
  addPlatform: (p: NewPlatform) => Promise<Platform>
  updatePlatform: (id: string, updates: Partial<Platform>) => Promise<void>
  deletePlatform: (id: string) => Promise<void>
}

export function usePlatforms(userId: string): PlatformsHook {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await db.platforms
      .where('user_id').equals(userId)
      .and(p => Boolean(p.is_active))
      .sortBy('created_at')
    setPlatforms(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const addPlatform = async (p: NewPlatform): Promise<Platform> => {
    const platform: Platform = { ...p, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    await db.platforms.add(platform)
    await load()
    return platform
  }

  const updatePlatform = async (id: string, updates: Partial<Platform>) => {
    await db.platforms.update(id, updates)
    await load()
  }

  const deletePlatform = async (id: string) => {
    await db.platforms.update(id, { is_active: false })
    await load()
  }

  return { platforms, loading, addPlatform, updatePlatform, deletePlatform }
}
