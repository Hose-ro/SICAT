import { useRef, useState } from 'react'

const ACTION_WIDTH = 64

/**
 * Fila con acciones ocultas reveladas al deslizar hacia la izquierda (como un
 * contacto de WhatsApp). `children` es el contenido visible en reposo;
 * `actions` es la lista de botones que aparece detrás al deslizar.
 */
export default function SwipeableRow({ children, actions, onTap }) {
  const revealWidth = actions.length * ACTION_WIDTH
  const [translateX, setTranslateX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const startTranslateRef = useRef(0)
  const movedRef = useRef(false)

  const clamp = (value) => Math.min(0, Math.max(-revealWidth, value))

  const close = () => setTranslateX(0)

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startXRef.current = event.clientX
    startTranslateRef.current = translateX
    movedRef.current = false
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!dragging) return
    const delta = event.clientX - startXRef.current
    if (Math.abs(delta) > 4) movedRef.current = true
    setTranslateX(clamp(startTranslateRef.current + delta))
  }

  const finishDrag = () => {
    if (!dragging) return
    setDragging(false)
    setTranslateX((current) => (current < -revealWidth / 2 ? -revealWidth : 0))
  }

  const handleContentClick = () => {
    if (movedRef.current) return
    if (translateX < 0) {
      close()
      return
    }
    onTap?.()
  }

  return (
    <div className="relative overflow-hidden border-b border-gray-100 last:border-b-0">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: revealWidth }}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={action.disabled}
            onClick={() => {
              close()
              action.onClick()
            }}
            title={action.label}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${action.className}`}
          >
            {action.icon}
            <span className="leading-none">{action.label}</span>
          </button>
        ))}
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={handleContentClick}
        style={{ transform: `translateX(${translateX}px)`, touchAction: 'pan-y' }}
        className={`relative bg-white ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
      >
        {children}
      </div>
    </div>
  )
}
