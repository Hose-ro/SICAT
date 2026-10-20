import { useCallback, useEffect, useState } from 'react'

const PREFIJO = 'sicat.jefatura.borrador:'

function leer(clave) {
  try {
    const guardado = sessionStorage.getItem(PREFIJO + clave)
    return guardado ? JSON.parse(guardado) : null
  } catch { return null }
}

/**
 * Estado de un formulario largo que sobrevive a cerrar el diálogo o recargar:
 * mientras difiere de lo inicial se guarda en esta pestaña del navegador. Al
 * guardar en el servidor se llama a `limpiar`.
 */
export function useBorrador(clave, inicial) {
  // Lo inicial se fija al abrir: es la referencia para saber si hay cambios sin guardar.
  const [base] = useState(() => JSON.stringify(typeof inicial === 'function' ? inicial() : inicial))
  const [recuperado, setRecuperado] = useState(() => Boolean(clave && leer(clave)))
  const [valor, setValor] = useState(() => (clave && leer(clave)) ?? JSON.parse(base))

  useEffect(() => {
    if (!clave) return
    try {
      const actual = JSON.stringify(valor)
      if (actual === base) sessionStorage.removeItem(PREFIJO + clave)
      else sessionStorage.setItem(PREFIJO + clave, actual)
    } catch { /* sin almacenamiento: el borrador solo vive en pantalla */ }
  }, [clave, valor, base])

  const limpiar = useCallback(() => {
    try { sessionStorage.removeItem(PREFIJO + clave) } catch { /* sin almacenamiento */ }
    setRecuperado(false)
  }, [clave])
  const descartar = useCallback(() => {
    limpiar()
    setValor(JSON.parse(base))
  }, [limpiar, base])

  return [valor, setValor, { recuperado, limpiar, descartar, modificado: JSON.stringify(valor) !== base }]
}
