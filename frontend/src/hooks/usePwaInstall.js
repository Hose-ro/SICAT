import { useEffect, useMemo, useState } from 'react'

function getStandaloneState() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIosDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isSafariBrowser() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /safari/i.test(navigator.userAgent) && !/chrome|android|crios|fxios/i.test(navigator.userAgent)
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(getStandaloneState)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')

    const syncStandalone = () => {
      setIsStandalone(getStandaloneState())
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }

    syncStandalone()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    mediaQuery.addEventListener?.('change', syncStandalone)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      mediaQuery.removeEventListener?.('change', syncStandalone)
    }
  }, [])

  const showIosInstructions = useMemo(
    () => isIosDevice() && isSafariBrowser() && !isStandalone && !deferredPrompt,
    [deferredPrompt, isStandalone],
  )

  const promptInstall = async () => {
    if (!deferredPrompt) {
      return false
    }

    deferredPrompt.prompt()
    const outcome = await deferredPrompt.userChoice.catch(() => null)

    if (outcome?.outcome === 'accepted') {
      setDeferredPrompt(null)
      return true
    }

    return false
  }

  return {
    canInstall: Boolean(deferredPrompt),
    isStandalone,
    showIosInstructions,
    promptInstall,
  }
}
