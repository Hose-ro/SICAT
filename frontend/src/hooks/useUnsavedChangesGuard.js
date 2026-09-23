import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmAction } from '@/lib/feedback'

// BrowserRouter no expone useBlocker, así que los enlaces internos se
// interceptan en fase de captura antes de que react-router los procese.
export default function useUnsavedChangesGuard(when, confirmOptions) {
  const navigate = useNavigate()
  const optionsRef = useRef(confirmOptions)
  optionsRef.current = confirmOptions

  useEffect(() => {
    if (!when) return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleClick = async (event) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      event.preventDefault()
      event.stopPropagation()
      if (await confirmAction(optionsRef.current)) navigate(`${url.pathname}${url.search}${url.hash}`)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
    }
  }, [when, navigate])
}
