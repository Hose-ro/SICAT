import { useEffect, useState } from 'react'
import api from '@/api/axios'
import { mensajeError } from './useJefatura'

/**
 * Búsqueda de alumnos de la carrera por nombre o número de control (el mismo
 * endpoint autorizado que usa la incorporación). Desde dos caracteres.
 */
export function useBuscarAlumnos(j, q) {
  const texto = q.trim()
  const [estado, setEstado] = useState({ q: '', items: [], error: '' })
  useEffect(() => {
    if (texto.length < 2) return undefined
    let vivo = true
    const timer = setTimeout(() => {
      api.get('/jefe-carrera/alumnos/buscar', { params: { carreraId: j.carreraId, periodo: j.periodo, q: texto } })
        .then(({ data }) => { if (vivo) setEstado({ q: texto, items: Array.isArray(data) ? data : [], error: '' }) })
        .catch((e) => { if (vivo) setEstado({ q: texto, items: [], error: mensajeError(e, 'No se pudo buscar') }) })
    }, 250)
    return () => { vivo = false; clearTimeout(timer) }
  }, [texto, j.carreraId, j.periodo])
  const activa = texto.length >= 2
  return { activa, buscando: activa && estado.q !== texto, items: activa && estado.q === texto ? estado.items : [], error: activa ? estado.error : '', texto }
}
