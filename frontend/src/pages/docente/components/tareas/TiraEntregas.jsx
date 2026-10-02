import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ESTADO_DOCENTE_LABEL } from '@/lib/tareas'

// Lo resuelto primero, lo que falta al final: la tira se lee como avance.
const ORDEN = ['CALIFICADA', 'REVISADA', 'ENTREGADA', 'INCORRECTA', 'PENDIENTE', 'NO_ENTREGADA']
const CELDA = {
  CALIFICADA: 'bg-success',
  REVISADA: 'bg-success/45',
  ENTREGADA: 'bg-warning',
  INCORRECTA: 'bg-foreground/35',
  NO_ENTREGADA: 'bg-destructive',
  PENDIENTE: 'bg-muted ring-1 ring-inset ring-border',
}
const SINGULAR = { CALIFICADA: 'calificada', REVISADA: 'revisada', ENTREGADA: 'por calificar', INCORRECTA: 'devuelta', NO_ENTREGADA: 'sin entregar', PENDIENTE: 'aún no entrega' }
const PLURAL = { CALIFICADA: 'calificadas', REVISADA: 'revisadas', ENTREGADA: 'por calificar', INCORRECTA: 'devueltas', NO_ENTREGADA: 'sin entregar', PENDIENTE: 'aún no entregan' }

function resumen(cuenta) {
  return ORDEN.filter((estado) => cuenta[estado]).map((estado) => `${cuenta[estado]} ${(cuenta[estado] === 1 ? SINGULAR : PLURAL)[estado]}`).join(', ')
}

/**
 * Un rectángulo por alumno, coloreado por estado. Con `filas` (entregas de la
 * tarea) cada celda es un alumno y muestra su nombre; con `conteo` (listado)
 * solo se conocen las cantidades.
 */
export default function TiraEntregas({ filas, conteo, vencida = false, ajustar = false, className }) {
  const celdas = useMemo(() => {
    if (filas) {
      return [...filas]
        .sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado) || a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'))
        .map((fila) => ({ id: fila.alumno.id, estado: fila.estado, nombre: fila.alumno.nombre }))
    }
    const faltantes = vencida ? 'NO_ENTREGADA' : 'PENDIENTE'
    const partes = { CALIFICADA: conteo.calificadas, REVISADA: conteo.revisadas, ENTREGADA: conteo.porCalificar, INCORRECTA: conteo.devueltas, [faltantes]: conteo.sinEntregar }
    return ORDEN.flatMap((estado) => Array.from({ length: partes[estado] || 0 }, (_, i) => ({ id: `${estado}-${i}`, estado })))
  }, [filas, conteo, vencida])

  const cuenta = useMemo(() => celdas.reduce((acc, celda) => ({ ...acc, [celda.estado]: (acc[celda.estado] || 0) + 1 }), {}), [celdas])
  // La etiqueta se ubica sobre la celda señalada, aunque la tira ocupe dos renglones.
  const [hover, setHover] = useState(null)
  if (!celdas.length) return null
  const actual = hover ? celdas[hover.i] : null

  return (
    <div className={cn('relative max-w-full', ajustar ? 'w-full' : 'w-fit', className)} onMouseLeave={() => setHover(null)}>
      <div role="img" aria-label={`Alumnos: ${resumen(cuenta)}`} className={cn('flex gap-[2px]', !ajustar && 'flex-wrap')}>
        {celdas.map((celda, i) => (
          <span key={celda.id} onMouseEnter={(event) => setHover({ i, x: event.currentTarget.offsetLeft + 3, y: event.currentTarget.offsetTop })}
            className={cn('h-4 rounded-[2px]', ajustar ? 'min-w-[2px] max-w-1.5 flex-1' : 'w-1.5 shrink-0', CELDA[celda.estado])} />
        ))}
      </div>
      {actual && (
        <span className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background"
          style={{ left: hover.x, top: hover.y - 6 }}>
          {actual.nombre ? `${actual.nombre} · ${ESTADO_DOCENTE_LABEL[actual.estado]}` : `${cuenta[actual.estado]} ${(cuenta[actual.estado] === 1 ? SINGULAR : PLURAL)[actual.estado]}`}
        </span>
      )}
    </div>
  )
}
