import { useEffect, useState, useRef } from 'react'
import { checkIntegrity, type BalanceDrift } from '@/lib/integrity'

interface IntegrityCheckHook {
  drift: BalanceDrift[]
  /** True once the check has run at least once. */
  checked: boolean
  dismissed: boolean
  dismiss: () => void
}

/**
 * Runs a one-shot balance-integrity check when the app mounts. Purely
 * advisory: it never corrects anything — it just surfaces drift so the UI can
 * warn the user and point them at the "Integridad de datos" screen, where a
 * correction is applied only on explicit action.
 */
export function useIntegrityCheck(userId: string): IntegrityCheckHook {
  const [drift, setDrift] = useState<BalanceDrift[]>([])
  const [checked, setChecked] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    if (!userId) return
    checkIntegrity(userId).then(result => {
      if (!mountedRef.current) return
      setDrift(result)
      setChecked(true)
    })
  }, [userId])

  return { drift, checked, dismissed, dismiss: () => setDismissed(true) }
}
