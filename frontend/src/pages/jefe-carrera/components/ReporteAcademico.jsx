import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, FileText, LoaderCircle } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import SexoBadge from '@/components/SexoBadge'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import { ESTADO_UNIDAD } from '../supervision/estados'
import { fechaHoraCorta } from '../supervision/formato'
import { campoClass } from '../supervision/ui'
import { mensajeError } from '../supervision/useJefatura'

export default function ReporteAcademico({ j, resumen }) {
  const [params, setParams] = useSearchParams()
  const [filtro, setFiltro] = useState(() => ({
    grupoId: params.get('grupoId') ?? '',
    materiaId: params.get('materiaId') ?? '',
    unidadId: params.get('unidadId') ?? '',
  }))
  const [estado, setEstado] = useState({ clave: '', data: null, cargando: false, error: '' })
  const [descarga, setDescarga] = useState({ formato: '', error: '' })
  const peticion = useRef(null)
  const archivo = useRef(null)
  useEffect(
    () => () => {
      peticion.current?.abort()
      archivo.current?.abort()
    },
    [],
  )
  const ofertas = resumen.ofertas.filter((o) => String(o.grupo.id) === filtro.grupoId)
  const oferta = ofertas.find((o) => String(o.materia.id) === filtro.materiaId)
  const unidadValida = !filtro.unidadId || oferta?.unidades.some((u) => String(u.id) === filtro.unidadId)
  const valido = Boolean(oferta && unidadValida)
  const clave = `${filtro.grupoId}:${filtro.materiaId}:${filtro.unidadId}`
  const data = estado.clave === clave && valido ? estado.data : null
  const consulta = {
    carreraId: j.carreraId,
    periodo: j.periodo,
    grupoId: filtro.grupoId,
    materiaId: filtro.materiaId,
    ...(filtro.unidadId ? { unidadId: filtro.unidadId } : {}),
  }
  const cambiar = (siguiente) => {
    peticion.current?.abort()
    archivo.current?.abort()
    setFiltro(siguiente)
    setEstado({ clave: '', data: null, cargando: false, error: '' })
    setDescarga({ formato: '', error: '' })
  }
  const consultar = async () => {
    if (!valido) return
    peticion.current?.abort()
    const controller = new AbortController()
    peticion.current = controller
    setEstado({ clave, data: null, cargando: true, error: '' })
    setParams(
      (actual) => {
        const n = new URLSearchParams(actual)
        n.set('grupoId', filtro.grupoId)
        n.set('materiaId', filtro.materiaId)
        if (filtro.unidadId) n.set('unidadId', filtro.unidadId)
        else n.delete('unidadId')
        return n
      },
      { replace: true },
    )
    try {
      const { data } = await api.get('/jefe-carrera/calificaciones', { params: consulta, signal: controller.signal })
      if (!controller.signal.aborted) setEstado({ clave, data, cargando: false, error: '' })
    } catch (e) {
      if (!controller.signal.aborted)
        setEstado({ clave, data: null, cargando: false, error: mensajeError(e, 'No se pudo consultar el reporte') })
    }
  }
  const exportar = async (formato) => {
    if (!data || descarga.formato) return
    const controller = new AbortController()
    archivo.current = controller
    setDescarga({ formato, error: '' })
    try {
      const res = await api.get('/jefe-carrera/calificaciones/exportar', {
        params: { ...consulta, formato },
        responseType: 'blob',
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        const nombre =
          res.headers?.['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1] ??
          `SICAT_calificaciones.${formato === 'pdf' ? 'pdf' : 'xlsx'}`
        descargarArchivo(res.data, nombre)
        setDescarga({ formato: '', error: '' })
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setDescarga({
          formato: '',
          error: (await mensajeDeBlob(e.response?.data)) ?? 'No se pudo descargar el reporte. Intenta de nuevo.',
        })
    }
  }
  return (
    <section className="mt-7 min-w-0" aria-labelledby="reporte-academico">
      <h2 id="reporte-academico" className="text-xl font-semibold">
        Calificaciones y asistencia
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Consulta una unidad o el acumulado a la fecha. Incluye el avance de la materia y la asistencia registrada de sus
        alumnos.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          consultar()
        }}
        className="mt-6 grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1.5fr_auto]"
      >
        <label className="min-w-0 text-xs font-medium">
          Grupo
          <select
            className={`${campoClass} mt-2 h-11`}
            value={filtro.grupoId}
            onChange={(e) => cambiar({ grupoId: e.target.value, materiaId: '', unidadId: '' })}
          >
            <option value="">Selecciona un grupo</option>
            {resumen.grupos.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-xs font-medium">
          Materia
          <select
            className={`${campoClass} mt-2 h-11`}
            disabled={!filtro.grupoId}
            value={filtro.materiaId}
            onChange={(e) => cambiar({ ...filtro, materiaId: e.target.value, unidadId: '' })}
          >
            <option value="">{filtro.grupoId ? 'Selecciona una materia' : 'Primero selecciona un grupo'}</option>
            {ofertas.map((o) => (
              <option key={o.materia.id} value={String(o.materia.id)}>
                {o.materia.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-xs font-medium">
          Alcance
          <select
            className={`${campoClass} mt-2 h-11`}
            disabled={!oferta}
            value={filtro.unidadId}
            onChange={(e) => cambiar({ ...filtro, unidadId: e.target.value })}
          >
            <option value="">Acumulado a la fecha</option>
            {oferta?.unidades.map((u) => (
              <option key={u.id ?? u.orden} value={String(u.id)}>
                Unidad {u.orden}: {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-11" disabled={!valido || estado.cargando || Boolean(descarga.formato)}>
          {estado.cargando ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}Consultar reporte
        </Button>
      </form>
      {!resumen.ofertas.length && (
        <p className="mt-4 text-sm text-muted-foreground">No hay materias ofertadas para consultar en este periodo.</p>
      )}
      {estado.cargando && (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Consultando calificaciones y asistencia…
        </p>
      )}
      {estado.error && (
        <p role="alert" className="mt-6 text-sm text-destructive-foreground">
          {estado.error} Usa Consultar reporte para reintentar.
        </p>
      )}
      {data && (
        <>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-y border-border py-4">
            <div>
              <h3 className="font-semibold">
                {data.materia.nombre} · {data.grupo.nombre}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.unidadId ? `Unidad ${data.unidades[0]?.orden}` : 'Acumulado a la fecha'} · Corte:{' '}
                {fechaHoraCorta(data.generadoEn)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={Boolean(descarga.formato)} onClick={() => exportar('pdf')}>
                <FileText aria-hidden="true" />
                PDF institucional
              </Button>
              <Button variant="outline" disabled={Boolean(descarga.formato)} onClick={() => exportar('excel')}>
                <FileSpreadsheet aria-hidden="true" />
                Excel institucional
              </Button>
            </div>
          </div>
          {descarga.formato && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Generando documento institucional…
            </p>
          )}
          {descarga.error && (
            <p role="alert" className="mt-3 text-sm text-destructive-foreground">
              {descarga.error}
            </p>
          )}
          <dl className="my-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Avance de unidades</dt>
              <dd className="mt-1 text-sm font-medium">
                {data.avance.cerradas} de {data.avance.total} cerradas
                {data.avance.porcentaje != null ? ` · ${data.avance.porcentaje} %` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Promedio de calificaciones</dt>
              <dd className="mt-1 text-sm font-medium">{data.resumen.promedio ?? 'Sin captura'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Asistencia registrada del alcance</dt>
              <dd className="mt-1 text-sm font-medium">
                {data.resumen.asistencia == null ? 'Sin registros' : `${data.resumen.asistencia} %`}
              </dd>
            </div>
          </dl>
          <p className="mb-4 max-w-4xl text-xs text-muted-foreground">{data.nota} (P): provisional.</p>
          {!data.filas.length ? (
            <p className="border-y border-border py-6 text-sm text-muted-foreground">
              No hay alumnos inscritos en esta materia y grupo.
            </p>
          ) : (
            <div
              role="region"
              aria-label="Calificaciones y asistencia por alumno"
              tabIndex={0}
              className="max-w-full overflow-x-auto"
            >
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    {['Alumno', ...data.unidades.map((u) => `U${u.orden}`), 'Promedio', 'Asistencia', 'Pendientes'].map(
                      (c) => (
                        <th key={c} scope="col" className="px-3 py-3 font-medium">
                          {c}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((f) => (
                    <tr key={f.alumno.id} className="border-b border-border align-top">
                      <th scope="row" className="px-3 py-3 font-medium">
                        <span className="flex gap-2">
                          <SexoBadge sexo={f.alumno.sexo} />
                          <span>
                            {f.alumno.nombre}
                            <span className="block text-xs font-normal text-muted-foreground">
                              {f.alumno.numeroControl}
                            </span>
                          </span>
                        </span>
                      </th>
                      {f.notas.map((n) => (
                        <td key={n.unidadId ?? n.orden} className="px-3 py-3 tabular-nums">
                          {n.calificacion ?? '—'}
                          {n.tipo === 'PROVISIONAL' ? ' (P)' : ''}
                        </td>
                      ))}
                      <td className="px-3 py-3 tabular-nums">
                        {f.promedio ?? '—'}
                        {f.provisional ? ' (P)' : ''}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {f.asistencia.porcentaje == null ? 'Sin registros' : `${f.asistencia.porcentaje} %`}
                        <span className="block text-xs text-muted-foreground">
                          {f.asistencia.registradas} registros
                        </span>
                      </td>
                      <td className="px-3 py-3">{f.pendientes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details className="mt-6 border-b border-border pb-4">
            <summary className="min-h-11 cursor-pointer text-sm font-medium">Ver avance de cada unidad</summary>
            <ul className="mt-3 divide-y divide-border text-sm">
              {data.avance.unidades.map((u) => (
                <li key={u.id ?? u.orden} className="flex justify-between gap-3 py-3">
                  <span>
                    U{u.orden} · {u.nombre}
                  </span>
                  <span className="text-muted-foreground">{ESTADO_UNIDAD[u.status]?.label ?? u.status}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}
