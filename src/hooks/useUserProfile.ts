import { useEffect, useState } from 'react'
import { db } from '@/lib/db'
import type { UserProfile } from '@/types'

export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    let ignore = false
    db.user_profiles.get(userId).then(p => {
      if (!ignore) setProfile(p ?? null)
    })
    return () => { ignore = true }
  }, [userId])

  const setHidden = async (hidden: boolean) => {
    await db.user_profiles.update(userId, { balance_hidden: hidden })
    setProfile(prev => prev ? { ...prev, balance_hidden: hidden } : prev)
  }

  return { profile, setHidden }
}
