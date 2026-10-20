import { useLayoutEffect, useRef, useState } from 'react'

/** Ancho real del contenedor: el SVG se dibuja a ese tamaño para que el texto no se escale. */
export function useAncho() {
  const ref = useRef(null)
  const [ancho, setAncho] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => setAncho(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, ancho]
}

/** Posiciona el tooltip dentro del contenedor sin salirse por los lados. */
export function posicionTooltip(x, ancho, anchoTooltip = 220) {
  const izquierda = x + 14 + anchoTooltip > ancho ? x - 14 - anchoTooltip : x + 14
  return Math.max(0, izquierda)
}
