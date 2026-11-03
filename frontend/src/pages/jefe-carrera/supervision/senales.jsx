import { Link } from 'react-router-dom'
import { plural } from './formato'
import './tonos.css'

/** Señales que comparten Pendientes, Grupos y Materias: el tono y cómo se nombra. */
const SENALES = {
  listas: { tono: 'ASISTENCIA_SIN_CAPTURA', uno: 'lista de asistencia', varios: 'listas de asistencia' },
  calificaciones: { tono: 'CALIFICACIONES_PENDIENTES', uno: 'calificación', varios: 'calificaciones' },
  entregas: { tono: 'ENTREGAS', uno: 'entrega', varios: 'entregas' },
  riesgo: { tono: 'ALUMNO_RIESGO', uno: 'en riesgo', varios: 'en riesgo' },
  asignacion: { tono: 'ASIGNACION' },
}

/** Una señal con su cifra; en cero no se dibuja: lo que está al día no hace ruido. */
export function Senal({ tipo, n, children }) {
  const s = SENALES[tipo]
  if (children == null && !n) return null
  return <span className="senal" data-tono={s.tono}>{children ?? plural(n, s.uno, s.varios)}</span>
}

/**
 * Píldora de filtro con su cifra. Con `to` es un enlace (el filtro vive en la
 * URL y queda en el historial); sin él, un botón que se alterna.
 */
export function FiltroChip({ to, activo, onClick, tipo, n, children }) {
  const tono = tipo ? SENALES[tipo]?.tono ?? tipo : undefined
  const contenido = (
    <>
      {tono && <span className="tono-punto" aria-hidden="true" />}
      {children}
      {n != null && <span className="filtro-chip-n">{n}</span>}
    </>
  )
  if (to) {
    return <Link to={to} className="filtro-chip" data-tono={tono} data-vacio={n === 0 && !activo ? '' : undefined} aria-current={activo ? 'true' : undefined} onClick={onClick}>{contenido}</Link>
  }
  return <button type="button" className="filtro-chip" data-tono={tono} aria-pressed={Boolean(activo)} disabled={n === 0 && !activo} onClick={onClick}>{contenido}</button>
}
