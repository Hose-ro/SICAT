import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import SexoBadge from '@/components/SexoBadge'
import api from '@/api/axios'
import { mensajeError } from '../supervision/useJefatura'
import { fechaLarga } from '../supervision/formato'

const ESTADOS = {
  ASISTENCIA: { label: 'Asistencia', texto: 'text-success-foreground' },
  RETARDO: { label: 'Retardo', texto: 'text-warning-foreground' },
  FALTA: { label: 'Falta', texto: 'text-destructive-foreground' },
  JUSTIFICADA: { label: 'Justificada', texto: 'text-primary-ink' },
}

function hora(value) {
  if (!value) return '—'
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  return new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Lista capturada de una sesión, de solo lectura para jefatura. Solo se
 * consulta dentro de la carrera seleccionada.
 */
export default function AsistenciaSesionModal({ sesionId, carreraId, periodo, onClose }) {
  // Un solo estado combinado: cada rama del fetch dispara un único setState.
  const [{ data, loading, error }, setState] = useState({ data: null, loading: true, error: '' })

  useEffect(() => {
    let cancelled = false
    api.get(`/jefe-carrera/sesiones/${sesionId}/asistencia`, { params: { carreraId, periodo } })
      .then(({ data: response }) => { if (!cancelled) setState({ data: response, loading: false, error: '' }) })
      .catch((requestError) => { if (!cancelled) setState({ data: null, loading: false, error: mensajeError(requestError, 'No se pudo cargar la lista de la sesión') }) })
    return () => { cancelled = true }
  }, [sesionId, carreraId, periodo])

  const sesion = data?.sesion
  const enCurso = Boolean(sesion?.activa)
  const descripcion = sesion
    ? [sesion.fecha && fechaLarga(sesion.fecha), sesion.grupo?.nombre && `Grupo ${sesion.grupo.nombre}`, sesion.docente?.nombre].filter(Boolean).join(' · ')
    : undefined

  return (
    <Modal open onClose={onClose} title={sesion ? `Lista capturada · ${sesion.materia.nombre}` : 'Lista capturada'} description={descripcion} wide>
      {loading && <p role="status" className="py-10 text-center text-sm text-muted-foreground">Cargando la lista…</p>}
      {error && <p role="alert" className="rounded-[var(--radius-item)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive-foreground">{error}</p>}

      {!loading && !error && data && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border pb-4 text-[0.8125rem] sm:grid-cols-4">
            <Dato label={enCurso ? 'Inició' : 'Sesión abierta a las'} value={hora(sesion.horaInicio)} />
            <Dato label={enCurso ? 'Termina' : 'Horario programado'} value={enCurso ? hora(sesion.horaFinProgramada) : `${hora(sesion.horaInicioProgramada)}–${hora(sesion.horaFinProgramada)}`} />
            <Dato label="Aula" value={sesion.aula?.nombre ?? 'Sin aula'} />
            <Dato label="Unidad" value={sesion.unidad?.nombre ?? 'Sin unidad registrada'} />
          </dl>

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-foreground">
            <span><b className="tabular-nums">{data.resumen.asistencias}</b> asistencias</span>
            <span><b className="tabular-nums">{data.resumen.retardos}</b> retardos</span>
            <span><b className="tabular-nums">{data.resumen.faltas}</b> faltas</span>
            <span><b className="tabular-nums">{data.resumen.justificadas}</b> justificadas</span>
          </p>

          {data.asistencias.length ? (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Lista de asistencia">
              <table className="w-full border-collapse text-[0.8125rem]">
                <caption className="sr-only">Lista de asistencia ({data.resumen.total} alumnos)</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Alumno</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Número de control</th>
                    <th scope="col" className="py-2 font-medium">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.asistencias.map((alumno) => {
                    const estado = ESTADOS[alumno.estado]
                    return (
                      <tr key={alumno.id} className="border-t border-border">
                        <td className="py-2.5 pr-4"><span className="flex items-center gap-2 font-medium text-foreground">{alumno.nombre}<SexoBadge sexo={alumno.sexo} /></span></td>
                        <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{alumno.numeroControl ?? '—'}</td>
                        <td className={`py-2.5 font-medium ${estado?.texto ?? 'text-muted-foreground'}`}>{estado?.label ?? 'Sin registrar'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border-t border-border py-8 text-center text-sm text-muted-foreground">
              {enCurso ? 'El docente todavía no captura la lista de esta sesión.' : 'La sesión se abrió, pero no tiene registros de asistencia.'}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}

function Dato({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
