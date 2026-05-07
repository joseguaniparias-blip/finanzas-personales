import { useState } from 'react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { OnboardingData, PocketDraft, PayoutConfig } from '@/types'
import { PLATFORM_DEFAULTS } from '@/types'
import { Step1Name } from './Step1Name'
import { Step2Platforms } from './Step2Platforms'
import { Step3Pockets } from './Step3Pockets'
import { Step4PlatformBalances } from './Step4PlatformBalances'
import { Step5PayoutDays } from './Step5PayoutDays'

interface Props { userId: string; onComplete: () => void }

const empty: OnboardingData = {
  name: '', platforms: [], pockets: [],
  platformBalances: {}, payoutConfig: {}
}

export function OnboardingFlow({ userId, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(empty)
  const [saving, setSaving] = useState(false)

  const progress = (step / 5) * 100

  const finish = async (payoutConfig: Record<string, PayoutConfig>) => {
    setSaving(true)
    const finalData = { ...data, payoutConfig }

    // 1. Save bank/cash pockets to Dexie
    const savedPockets: Array<{ id: string; name: string }> = []
    for (const draft of finalData.pockets) {
      const pocket = {
        id: crypto.randomUUID(),
        user_id: userId,
        ...draft,
        platform_id: null,
        is_active: true,
        created_at: new Date().toISOString()
      }
      await db.pockets.add(pocket)
      savedPockets.push({ id: pocket.id, name: pocket.name })
    }

    // 2. Save platforms + their pockets to Dexie
    for (const platformName of finalData.platforms) {
      const def = PLATFORM_DEFAULTS[platformName] ?? { color: '#94a3b8', icon: '📲' }
      const platformId = crypto.randomUUID()

      const pocketId = crypto.randomUUID()
      await db.pockets.add({
        id: pocketId, user_id: userId, name: platformName, type: 'platform',
        platform_id: platformId, balance: finalData.platformBalances[platformName] ?? 0,
        color: def.color, icon: def.icon, is_active: true, created_at: new Date().toISOString()
      })

      const payoutPocketId = finalData.payoutConfig[platformName]?.pocket_id
        ?? savedPockets[0]?.id ?? ''

      await db.platforms.add({
        id: platformId, user_id: userId, name: platformName, color: def.color,
        payout_day: finalData.payoutConfig[platformName]?.day ?? 2,
        payout_pocket_id: payoutPocketId, is_active: true, created_at: new Date().toISOString()
      })
    }

    // 3. Mark onboarding complete in Supabase
    const now = new Date().toISOString()
    await supabase.from('user_profiles').upsert({
      id: userId, name: finalData.name,
      onboarding_completed: true, balance_hidden: false
    })

    // 4. Sync profile to local DB so App.tsx detects it instantly on next load
    await db.user_profiles.put({
      id: userId,
      name: finalData.name,
      onboarding_completed: true,
      balance_hidden: false,
      created_at: now
    })

    setSaving(false)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Paso {step} de 5</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
          {step === 1 && (
            <Step1Name initial={data.name}
              onNext={name => { setData(d => ({ ...d, name })); setStep(2) }} />
          )}
          {step === 2 && (
            <Step2Platforms initial={data.platforms}
              onNext={platforms => { setData(d => ({ ...d, platforms })); setStep(3) }}
              onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <Step3Pockets initial={data.pockets}
              onNext={(pockets: PocketDraft[]) => { setData(d => ({ ...d, pockets })); setStep(4) }}
              onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <Step4PlatformBalances
              platforms={data.platforms}
              initial={data.platformBalances}
              onNext={platformBalances => { setData(d => ({ ...d, platformBalances })); setStep(5) }}
              onBack={() => setStep(3)} />
          )}
          {step === 5 && (
            <Step5PayoutDays
              platforms={data.platforms}
              pocketOptions={data.pockets.filter(p => p.type !== 'platform').map((p, i) => ({ id: `draft-${i}`, name: p.name }))}
              initial={data.payoutConfig}
              onFinish={finish}
              onBack={() => setStep(4)} />
          )}
          {saving && (
            <div className="absolute inset-0 bg-slate-950/80 rounded-3xl flex items-center justify-center">
              <p className="text-slate-400 animate-pulse">Guardando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
