import { useCallback, useRef } from 'react'

// Guard the whole interaction, including the time spent confirming and fetching.
export default function useAsyncAction(action) {
  const running = useRef(false)
  return useCallback(async (...args) => {
    if (running.current) return
    running.current = true
    try { return await action(...args) }
    finally { running.current = false }
  }, [action])
}
