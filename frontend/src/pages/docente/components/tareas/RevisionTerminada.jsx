import { BellRing, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import SexoBadge from '@/components/SexoBadge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`
}

/** Aparece cuando se califica la última entrega pendiente de la sesión. */
export default function RevisionTerminada({ r, tarea, volver, recordado, recordando, cerrando, onRecordar, onCerrar }) {
  const puedeRecordar = r.sinEntregar > 0 && tarea.tipoEntrega !== 'PRESENCIAL' && tarea.estado !== 'CERRADA'
  const partes = [
    plural(r.calificadas, 'calificada', 'calificadas'),
    r.revisadas > 0 && plural(r.revisadas, 'revisada sin nota', 'revisadas sin nota'),
    r.devueltas > 0 && plural(r.devueltas, 'devuelta', 'devueltas'),
    r.sinEntregar > 0 && `${r.sinEntregar} sin entregar`,
  ].filter(Boolean)
  return (
    <div className="tarea-aparecer py-3 text-center">
      <svg className="tarea-trazo mx-auto size-12 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" className="opacity-25" />
        <path d="m7.75 12.5 2.75 2.75 5.75-6" />
      </svg>
      <h2 className="mt-3 text-lg font-semibold text-foreground">No queda nada por calificar</h2>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">{partes.join(' · ')}</p>
      <div className="mt-5 grid gap-2">
        {puedeRecordar && (
          <Button variant="outline" onClick={onRecordar} disabled={recordado || recordando}>
            <BellRing aria-hidden="true" />
            {recordado ? 'Recordatorio enviado' : recordando ? 'Enviando…' : `Recordar a ${r.sinEntregar === 1 ? 'quien falta' : `los ${r.sinEntregar} que faltan`}`}
          </Button>
        )}
        {tarea.estado !== 'CERRADA' && (
          <Button variant="outline" onClick={onCerrar} disabled={cerrando}><Lock aria-hidden="true" />{cerrando ? 'Cerrando…' : 'Cerrar tarea'}</Button>
        )}
        <Link to={volver} className={buttonVariants()}>Volver a la unidad</Link>
      </div>
    </div>
  )
}

function ListaNombres({ titulo, filas, detalle }) {
  if (!filas.length) return null
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-foreground">{titulo} <span className="font-normal text-muted-foreground tabular-nums">{filas.length}</span></h3>
      <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {filas.map((fila) => (
          <li key={fila.alumno.id} className="flex min-w-0 items-center gap-2 text-sm text-foreground">
            <SexoBadge sexo={fila.alumno.sexo} />
            <span className="truncate">{fila.alumno.nombre}</span>
            {detalle?.(fila) && <span className="shrink-0 text-xs text-muted-foreground">{detalle(fila)}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Al terminar, el centro deja la última entrega y muestra el registro completo: quién falta y cómo quedó el grupo. */
export function ResumenRevision({ filas, r }) {
  const faltan = filas.filter((fila) => fila.estado === 'NO_ENTREGADA' || fila.estado === 'PENDIENTE')
  const devueltas = filas.filter((fila) => fila.estado === 'INCORRECTA')
  const notas = filas.filter((fila) => fila.estado === 'CALIFICADA' && typeof fila.entrega.calificacion === 'number').map((fila) => fila.entrega.calificacion)
  const bajoSetenta = notas.filter((nota) => nota < 70).length

  return (
    <section aria-label="Resumen del grupo" className="tarea-aparecer min-w-0 rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
      <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Así quedó el grupo</h2>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {r.entregadas} de {r.total} entregaron
        {notas.length > 0 && <> · promedio {r.promedio} · de {Math.min(...notas)} a {Math.max(...notas)}</>}
        {bajoSetenta > 0 && <> · <span className="font-medium text-destructive-foreground">{bajoSetenta} por debajo de 70</span></>}
      </p>
      <ListaNombres titulo="Sin entregar" filas={faltan} />
      <ListaNombres titulo="Devueltas" filas={devueltas} detalle={(fila) => (fila.entrega.permiteCorreccion ? 'puede reenviar' : '')} />
      {!faltan.length && !devueltas.length && <p className="mt-5 text-sm text-foreground">Todo el grupo entregó y quedó revisado.</p>}
    </section>
  )
}
