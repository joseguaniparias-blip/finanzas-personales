import { useEffect, useState } from 'react'
import { db } from '@/lib/db'
import type { UserProfile } from '@/types'

export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    db.user_profiles.get(userId).then(p => setProfile(p ?? null))
  }, [userId])

  const setHidden = async (hidden: boolean) => {
    await db.user_profiles.update(userId, { balance_hidden: hidden })
    setProfile(prev => prev ? { ...prev, balance_hidden: hidden } : prev)
  }

  return { profile, setHidden }
}
