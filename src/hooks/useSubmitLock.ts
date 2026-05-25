import { useCallback, useRef, useState } from 'react'

/**
 * Synchronous lock to prevent double-submission of forms.
 *
 * `useState` updates are async — React may dispatch a click handler twice
 * before the disabled state flips, leading to duplicate DB writes. This hook
 * uses a `useRef` to lock immediately and synchronously on the first call.
 *
 * Usage:
 *   const { submitting, submit } = useSubmitLock()
 *   const handleSave = () => submit(async () => { await onSave(data) })
 *   <button onClick={handleSave} disabled={submitting}>Guardar</button>
 */
export function useSubmitLock() {
  const lockedRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(async (fn: () => Promise<void> | void) => {
    if (lockedRef.current) return
    lockedRef.current = true
    setSubmitting(true)
    try {
      await fn()
    } finally {
      lockedRef.current = false
      setSubmitting(false)
    }
  }, [])

  return { submitting, submit }
}
