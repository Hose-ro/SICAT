import { useMemo, useState } from 'react'
import { CiCircleRemove, CiMobile3 } from 'react-icons/ci'
import { usePwaInstall } from '@/hooks/usePwaInstall'

const DISMISS_KEY = 'sicat-pwa-dismissed-at'
const DISMISS_WINDOW_MS = 1000 * 60 * 60 * 24 * 3

function wasDismissedRecently() {
  if (typeof window === 'undefined') {
    return false
  }

  const storedValue = window.localStorage.getItem(DISMISS_KEY)

  if (!storedValue) {
    return false
  }

  const dismissedAt = Number(storedValue)

  if (Number.isNaN(dismissedAt)) {
    return false
  }

  return Date.now() - dismissedAt < DISMISS_WINDOW_MS
}

export default function PwaInstallPrompt() {
  const { canInstall, isStandalone, showIosInstructions, promptInstall } = usePwaInstall()
  const [hidden, setHidden] = useState(wasDismissedRecently)

  const shouldRender = useMemo(
    () => !isStandalone && !hidden && (canInstall || showIosInstructions),
    [canInstall, hidden, isStandalone, showIosInstructions],
  )

  if (!shouldRender) {
    return null
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setHidden(true)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg text-primary-foreground">
            <CiMobile3 />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Instala SICAT en tu celular</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {canInstall
                ? 'Ábrela como app desde la pantalla de inicio y entra más rápido.'
                : 'En iPhone, toca Compartir y luego "Agregar a pantalla de inicio".'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {canInstall && (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-strong"
                >
                  Instalar app
                </button>
              )}

              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              >
                Luego
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Cerrar aviso de instalacion"
          >
            <CiCircleRemove className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  )
}
