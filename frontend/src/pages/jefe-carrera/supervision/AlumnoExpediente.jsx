import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Modal from '@/components/Modal'
import { MOTIVOS_RIESGO } from './estados'
import { semestreTexto } from './formato'
import { Nota, Promedio } from './notas'
import { resumenAlumno, useReportes } from './useReportes'
import { Contacto, linkClass } from './ui'

/** Expediente del alumno: todas sus inscripciones aceptadas del periodo, también fuera de su grupo base. */
export default function AlumnoExpediente({ j, alumno, cargando, onClose }) {
  const pares = useMemo(() => (alumno?.inscripciones ?? []).filter((i) => i.grupo).map((i) => ({ materiaId: i.materia.id, grupoId: i.grupo.id })), [alumno])
  const reportes = useReportes(j, pares)

  return (
    <Modal
      open={Boolean(alumno) || cargando}
      onClose={onClose}
      wide
      title={alumno?.nombre ?? 'Expediente del alumno'}
      description={alumno ? [alumno.numeroControl, semestreTexto(alumno.semestre), alumno.grupo ? `Grupo base ${alumno.grupo.nombre}` : 'Sin grupo base'].filter(Boolean).join(' · ') : undefined}
    >
      {!alumno ? <div className="h-40 animate-pulse rounded-[var(--radius-item)] bg-muted" aria-busy="true" /> : (
        <>
          <section aria-label="Contacto">
            <p className="mb-2 text-xs text-muted-foreground">{[alumno.email, alumno.telefono].filter(Boolean).join(' · ') || null}</p>
            <Contacto persona={alumno} compacto />
          </section>

          <section aria-labelledby="inscripciones-alumno" className="pt-2">
            <h3 id="inscripciones-alumno" className="text-sm font-semibold text-foreground">Inscripciones del periodo</h3>
            {alumno.inscripciones.length ? (
              <ul className="mt-3 divide-y divide-border rounded-[var(--radius-item)] border border-border">
                {alumno.inscripciones.map((inscripcion) => {
                  const estado = inscripcion.grupo ? reportes[`${inscripcion.materia.id}:${inscripcion.grupo.id}`] : null
                  const filas = (estado?.data?.rows ?? []).filter((r) => r.alumno.id === alumno.id).sort((a, b) => (a.unidad?.orden ?? 0) - (b.unidad?.orden ?? 0))
                  const r = resumenAlumno(filas)
                  return (
                    <li key={inscripcion.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link className={`${linkClass} text-sm text-foreground`} to={j.to(`/jefe-carrera/materias/${inscripcion.materia.id}`, { oferta: inscripcion.grupo?.id })}>{inscripcion.materia.nombre}</Link>
                          <p className="text-xs text-muted-foreground">
                            {inscripcion.materia.clave} · {inscripcion.grupo ? `Grupo ${inscripcion.grupo.nombre}` : 'Sin grupo'}
                            {inscripcion.grupo && alumno.grupo && inscripcion.grupo.id !== alumno.grupo.id ? ' · fuera de su grupo base' : ''}
                          </p>
                        </div>
                        {estado?.data && <Promedio r={r} />}
                      </div>
                      {estado?.error ? <p className="mt-2 text-xs text-destructive-foreground">{estado.error}</p> : !estado?.data ? (
                        <div className="mt-3 h-10 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
                      ) : filas.length ? (
                        <>
                          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                            {filas.map((fila) => (
                              <div key={fila.unidad?.id ?? fila.unidad?.orden} className="flex items-baseline gap-1.5">
                                <dt className="text-muted-foreground">{fila.unidad?.nombre}</dt>
                                <dd><Nota row={fila} /></dd>
                              </div>
                            ))}
                          </dl>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Asistencia: {r.asistencia.porcentaje == null ? 'sin registros' : `${r.asistencia.porcentaje} % de ${r.asistencia.registradas} registros · ${r.asistencia.faltas} faltas · ${r.asistencia.retardos} retardos · ${r.asistencia.justificadas} justificadas`}
                          </p>
                          {r.motivos.length > 0 && <p className="mt-1 text-xs font-medium text-warning-foreground">{r.motivos.map((m) => MOTIVOS_RIESGO[m] ?? m).join(' · ')}</p>}
                          {r.observaciones.map((o) => <p key={o.unidad} className="mt-1 text-xs text-foreground"><b className="font-medium">{o.unidad}:</b> {o.texto}</p>)}
                        </>
                      ) : <p className="mt-2 text-xs text-muted-foreground">Sin registros de calificación en esta materia.</p>}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">Sin inscripciones aceptadas en el periodo.</p>}
          </section>
        </>
      )}
    </Modal>
  )
}
