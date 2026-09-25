import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import SexoBadge from '@/components/SexoBadge'
import { useEffect, useMemo, useState } from 'react'
import { useAsistenciaStore } from '@/store/asistenciaStore'

const ESTADO_LETRA = { ASISTENCIA: 'A', FALTA: 'F', RETARDO: 'R', JUSTIFICADA: 'J' }
const ESTADO_LABEL = { ASISTENCIA: 'Asistencia', FALTA: 'Falta', RETARDO: 'Retardo', JUSTIFICADA: 'Justificada' }
const ESTADO_STYLE = {
  ASISTENCIA: 'bg-success/15 text-success-foreground',
  FALTA: 'bg-destructive/15 text-destructive-foreground',
  RETARDO: 'bg-warning/15 text-warning-foreground',
  JUSTIFICADA: 'bg-accent text-primary-ink',
}

// El PDF del backend recorta las columnas de sesión a este número.
const SESIONES_EN_PDF = 10

function formatFechaCorta(value) {
  return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
}

function formatFechaLarga(value) {
  return new Date(value).toLocaleDateString('es-MX', { dateStyle: 'long' })
}

/**
 * Arma las mismas filas que el Excel: un alumno por fila, una columna por
 * sesión y los totales A/F/R/J con el porcentaje de asistencia.
 */
function construirFilas({ sesiones = [], alumnos = [], asistencias = [] }) {
  const mapa = new Map(asistencias.map((item) => [`${item.alumnoId}_${item.claseSesionId}`, item.estado]))

  return alumnos.map((alumno) => {
    const conteo = { ASISTENCIA: 0, FALTA: 0, RETARDO: 0, JUSTIFICADA: 0 }
    const estados = sesiones.map((sesion) => {
      const estado = sesion.suspensionMotivo ? null : mapa.get(`${alumno.id}_${sesion.id}`) ?? null
      if (estado in conteo) conteo[estado] += 1
      return estado
    })
    const total = conteo.ASISTENCIA + conteo.FALTA + conteo.RETARDO + conteo.JUSTIFICADA
    const porcentaje = total > 0 ? Math.round((conteo.ASISTENCIA / total) * 100) : 0
    return { alumno, estados, conteo, porcentaje }
  })
}

/**
 * Muestra en pantalla lo que va a salir en el PDF/Excel para revisarlo antes
 * de descargar. Recibe los mismos `opciones` que `exportar` del store.
 */
export default function VistaPreviaReporteModal({ materiaId, opciones = {}, descripcion, onClose }) {
  const { obtenerDatosReporte, exportar } = useAsistenciaStore()
  const [{ data, loading, error }, setState] = useState({ data: null, loading: true, error: '' })
  const [descargando, setDescargando] = useState('')
  const [descargaError, setDescargaError] = useState('')

  // `opciones` llega como objeto nuevo en cada render del padre; se compara
  // por contenido para no volver a consultar el reporte sin motivo.
  const claveOpciones = JSON.stringify(opciones)
  const opcionesEstables = useMemo(() => JSON.parse(claveOpciones), [claveOpciones])

  useEffect(() => {
    let cancelled = false
    setState({ data: null, loading: true, error: '' })
    obtenerDatosReporte(materiaId, opcionesEstables)
      .then((response) => { if (!cancelled) setState({ data: response, loading: false, error: '' }) })
      .catch((requestError) => {
        if (cancelled) return
        setState({
          data: null,
          loading: false,
          error: requestError.response?.data?.message ?? 'No se pudo cargar la vista previa del reporte.',
        })
      })
    return () => { cancelled = true }
  }, [materiaId, opcionesEstables, obtenerDatosReporte])

  const filas = useMemo(() => (data ? construirFilas(data) : []), [data])
  const sesiones = data?.sesiones ?? []

  const descargar = async (formato) => {
    if (descargando) return
    setDescargando(formato)
    setDescargaError('')
    try {
      await exportar(materiaId, { ...opcionesEstables, formato })
    } catch (requestError) {
      setDescargaError(requestError.response?.data?.message ?? 'No se pudo descargar el reporte.')
    } finally {
      setDescargando('')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Vista previa del reporte"
      description={descripcion}
      busy={Boolean(descargando)}
      className="dialog-panel--report"
    >
      {loading && (
        <p className="py-10 text-center text-sm text-muted-foreground" role="status">Cargando el reporte…</p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </p>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Materia: <strong className="font-medium text-foreground">{data.materia?.nombre}</strong></span>
            {data.materia?.docente?.nombre && (
              <span>Docente: <strong className="font-medium text-foreground">{data.materia.docente.nombre}</strong></span>
            )}
            <span>
              {sesiones.filter((sesion) => !sesion.suspensionMotivo).length}{' '}
              {sesiones.filter((sesion) => !sesion.suspensionMotivo).length === 1 ? 'sesión' : 'sesiones'} ·{' '}
              {sesiones.filter((sesion) => sesion.suspensionMotivo).length}{' '}
              {sesiones.filter((sesion) => sesion.suspensionMotivo).length === 1 ? 'día sin clases' : 'días sin clases'} ·{' '}
              {filas.length} {filas.length === 1 ? 'alumno' : 'alumnos'}
            </span>
          </div>

          {sesiones.filter((sesion) => sesion.suspensionMotivo).map((sesion) => (
            <p key={sesion.id} className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              Sin clases el {formatFechaLarga(sesion.fecha)}: {sesion.suspensionMotivo}
            </p>
          ))}

          {filas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No hay alumnos ni registros de asistencia para este reporte.
            </p>
          ) : (
            <div
              className="overflow-x-auto rounded-xl border border-border"
              tabIndex={0}
              role="region"
              aria-label="Tabla de asistencias del reporte"
            >
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Lista de asistencias que se incluirá en el reporte</caption>
                <thead className="bg-background text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-background px-3 py-2 text-left">Alumno</th>
                    <th scope="col" className="px-3 py-2 text-left">Núm. control</th>
                    {sesiones.map((sesion) => (
                      <th key={sesion.id} scope="col" className={`px-2 py-2 text-center whitespace-nowrap ${sesion.suspensionMotivo ? 'bg-destructive/10 text-destructive-foreground' : ''}`}>
                        <span title={sesion.suspensionMotivo ? `Sin clases: ${sesion.suspensionMotivo}` : formatFechaLarga(sesion.fecha)}>{formatFechaCorta(sesion.fecha)}{sesion.suspensionMotivo ? ' · SC' : ''}</span>
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 text-center">A</th>
                    <th scope="col" className="px-2 py-2 text-center">F</th>
                    <th scope="col" className="px-2 py-2 text-center">R</th>
                    <th scope="col" className="px-2 py-2 text-center">J</th>
                    <th scope="col" className="px-2 py-2 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filas.map(({ alumno, estados, conteo, porcentaje }) => (
                    <tr key={alumno.id}>
                      <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <SexoBadge sexo={alumno.sexo} />
                          {alumno.nombre}
                        </span>
                      </th>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{alumno.numeroControl ?? '—'}</td>
                      {estados.map((estado, index) => (
                        <td key={sesiones[index].id} className={`px-2 py-2 text-center ${sesiones[index].suspensionMotivo ? 'bg-destructive/5' : ''}`}>
                          {sesiones[index].suspensionMotivo ? (
                            <span className="font-semibold text-destructive-foreground" title={sesiones[index].suspensionMotivo}>SC</span>
                          ) : estado ? (
                            <span
                              className={`inline-flex min-w-7 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold ${ESTADO_STYLE[estado] ?? 'bg-muted text-muted-foreground'}`}
                              title={ESTADO_LABEL[estado]}
                            >
                              {ESTADO_LETRA[estado] ?? '-'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground" aria-label="Sin registro">-</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-semibold text-success-foreground">{conteo.ASISTENCIA}</td>
                      <td className="px-2 py-2 text-center font-semibold text-destructive-foreground">{conteo.FALTA}</td>
                      <td className="px-2 py-2 text-center font-semibold text-warning-foreground">{conteo.RETARDO}</td>
                      <td className="px-2 py-2 text-center font-semibold text-primary-ink">{conteo.JUSTIFICADA}</td>
                      <td className="px-2 py-2 text-center font-semibold text-foreground">{porcentaje}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            A: Asistencia · F: Falta · R: Retardo · J: Justificada · SC: sin clases · -: sin registro
          </p>

          {sesiones.length > SESIONES_EN_PDF && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning-foreground">
              El PDF sólo incluye las primeras {SESIONES_EN_PDF} sesiones; el Excel incluye todas.
            </p>
          )}
        </div>
      )}

      {descargaError && (
        <p role="alert" className="text-xs text-destructive-foreground">{descargaError}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {descargando && (
          <span className="mr-auto text-xs text-muted-foreground" role="status">
            Generando el reporte en {descargando === 'pdf' ? 'PDF' : 'Excel'}…
          </span>
        )}
        <Button variant="ghost" type="button" onClick={onClose} disabled={Boolean(descargando)}>
          Cerrar
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => descargar('pdf')}
          disabled={loading || Boolean(error) || Boolean(descargando)}
          className="border"
        >
          Descargar PDF
        </Button>
        <Button
          variant="default"
          type="button"
          onClick={() => descargar('excel')}
          disabled={loading || Boolean(error) || Boolean(descargando)}
        >
          Descargar Excel
        </Button>
      </div>
    </Modal>
  )
}
