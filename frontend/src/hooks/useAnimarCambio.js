import { useEffect, useRef } from 'react'

// Señal breve de que el contenido cambió sin cambiar de pantalla (otra unidad
// en la misma tabla): los elementos suben 6px y aparecen escalonados. Corre
// sólo cuando cambia `clave`, nunca al escribir o buscar. WAAPI y no una clase
// con keyframes porque las filas que monta la búsqueda no deben animarse.
// `listo` marca cuándo hay datos: la primera clave con datos es el punto de
// partida y no se anima (la carga inicial no es un cambio).
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

export default function useAnimarCambio(ref, clave, { selector = null, listo = true } = {}) {
  const anterior = useRef(null)
  const activas = useRef([])

  useEffect(() => {
    if (!listo || anterior.current === clave) return
    const primera = anterior.current === null
    anterior.current = clave
    if (primera) return
    const raiz = ref.current
    if (!raiz || typeof raiz.animate !== 'function') return

    activas.current.forEach((animacion) => animacion.cancel())
    const elementos = selector ? [...raiz.querySelectorAll(selector)] : [raiz]
    // Con movimiento reducido queda el desvanecido, sin desplazamiento ni escalón.
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    activas.current = elementos.map((elemento, indice) => elemento.animate(
      reducido
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      {
        duration: reducido ? 150 : 220,
        easing: EASE_OUT,
        // Las primeras filas marcan el cambio; las de abajo no esperan más.
        delay: reducido ? 0 : Math.min(indice, 10) * 25,
        fill: 'backwards',
      },
    ))
  }, [clave, listo, ref, selector])
}
