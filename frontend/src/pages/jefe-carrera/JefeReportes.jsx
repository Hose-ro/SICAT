import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, FileText, LoaderCircle, Printer } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import SexoBadge from '@/components/SexoBadge'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import {
  claveFecha,
  esClaveValida,
  fechaCorta,
  fechaHoraCorta,
  hoyClave,
  parseClave,
  periodoTexto,
} from './supervision/formato'
import { ESTADO_UNIDAD } from './supervision/estados'
import { cn } from '@/lib/utils'
import { Aviso, Esqueleto, JefaturaPage, SeccionTitulo, Vacio, selectClass } from './supervision/ui'
import { mensajeError } from './supervision/useJefatura'
import ReporteAcademico from './components/ReporteAcademico'

const campoFecha =
  'h-11 rounded-[0.7rem] border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

/** Límites del periodo: del primer inicio al último fin de sus calendarios. */
function limitesPeriodo(calendarios) {
  const inicio = calendarios.reduce((a, c) => (c.inicio < a ? c.inicio : a), calendarios[0].inicio)
  const fin = calendarios.reduce((a, c) => (c.fin > a ? c.fin : a), calendarios[0].fin)
  return { inicio: claveFecha(new Date(inicio)), fin: claveFecha(new Date(fin)) }
}

/** Meses del periodo recortados a sus límites; el último llega hasta hoy si el periodo sigue en curso. */
function mesesDe({ inicio, fin }) {
  const meses = []
  const tope = fin < hoyClave() ? fin : hoyClave()
  for (let d = parseClave(inicio); claveFecha(d) <= tope; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const desde = claveFecha(d) < inicio ? inicio : claveFecha(d)
    const ultimo = claveFecha(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    meses.push({
      value: desde.slice(0, 7),
      label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
      desde,
      hasta: ultimo > tope ? tope : ultimo,
    })
  }
  return meses
}

const fechaSinDia = (clave) =>
  parseClave(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const porcentaje = (v) => (v == null ? 'Sin clases' : `${v} %`)

export default function JefeReportes() {
  return (
    <JefaturaPage titulo="Informes">
      {/* Cambiar de carrera o periodo empieza un informe nuevo: nada del anterior se conserva. */}
      {({ j, resumen }) => <TiposInforme key={`${j.carreraId}|${j.periodo}`} j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

function TiposInforme({ j, resumen }) {
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'academico' ? 'academico' : 'periodo'
  return <>
    <nav aria-label="Tipo de informe" className="mt-6 flex gap-3 border-b border-border">
      {[['periodo', 'Informe del periodo'], ['academico', 'Calificaciones y asistencia']].map(([id, texto]) => <button key={id} type="button" aria-current={vista === id ? 'page' : undefined} className={cn('min-h-12 border-b-2 px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', vista === id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground')} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('vista', id); return n }, { replace: true })}>{texto}</button>)}
    </nav>
    {vista === 'academico' ? <ReporteAcademico j={j} resumen={resumen} /> : <Informe j={j} resumen={resumen} />}
  </>
}

const SECCIONES = [
  {
    id: 'cobertura',
    titulo: 'Registro de listas por docente',
    tiempo: 'intervalo',
  },
  {
    id: 'listas',
    titulo: 'Listas pendientes de captura',
    tiempo: 'intervalo',
  },
  {
    id: 'avance',
    titulo: 'Avance académico por materia y grupo',
    tiempo: 'corte',
  },
  {
    id: 'riesgo',
    titulo: 'Alumnos en riesgo',
    tiempo: 'corte',
  },
  {
    id: 'seguimientos',
    titulo: 'Observaciones de seguimiento',
    tiempo: 'intervalo',
  },
]

export function Informe({ j, resumen }) {
  const limites = useMemo(() => limitesPeriodo(resumen.calendarios), [resumen.calendarios])
  const meses = useMemo(() => mesesDe(limites), [limites])
  const inicial = meses.at(-1) ?? { desde: limites.inicio, hasta: limites.fin }
  const [params, setParams] = useSearchParams()
  const enPeriodo = (fecha) => esClaveValida(fecha) && fecha >= limites.inicio && fecha <= limites.fin
  const [visible, setVisible] = useState(() =>
    enPeriodo(params.get('desde')) && enPeriodo(params.get('hasta'))
      ? { desde: params.get('desde'), hasta: params.get('hasta') }
      : { desde: inicial.desde, hasta: inicial.hasta },
  )
  const paso = ['0', '1', '2'].includes(params.get('paso'))
    ? Number(params.get('paso')) : params.has('seccion') ? 1 : 0
  const [seleccion, setSeleccion] = useState(() =>
    params.has('secciones')
      ? SECCIONES.filter((s) => params.get('secciones').split(',').includes(s.id)).map((s) => s.id)
      : SECCIONES.map((s) => s.id),
  )
  const [respuesta, setRespuesta] = useState({ clave: '', data: null, error: '' })
  const [descarga, setDescarga] = useState({ formato: '', error: '' })
  const [intento, setIntento] = useState(0)
  const titulo = useRef(null)
  const exportacion = useRef(null)
  useEffect(() => () => exportacion.current?.abort(), [])
  const elegidas = SECCIONES.filter((s) => seleccion.includes(s.id))
  const seccionSolicitada = params.get('seccion') ?? 'resumen'
  const activa = elegidas.some((s) => s.id === seccionSolicitada) ? seccionSolicitada : 'resumen'
  const mes = meses.find((m) => m.desde === visible.desde && m.hasta === visible.hasta)?.value ?? ''
  const invertido = Boolean(visible.desde && visible.hasta && visible.desde > visible.hasta)
  const errorRango = invertido
    ? 'La fecha final debe ser igual o posterior a la inicial.'
    : !enPeriodo(visible.desde) || !enPeriodo(visible.hasta)
      ? `Elige fechas dentro del periodo: del ${fechaSinDia(limites.inicio)} al ${fechaSinDia(limites.fin)}.`
      : ''
  const valido = !errorRango && elegidas.length > 0
  const clave = `${j.carreraId}|${j.periodo}|${visible.desde}|${visible.hasta}|${intento}`
  const vigente = valido && respuesta.clave === clave && !respuesta.error && Boolean(respuesta.data)
  const cargando = paso > 0 && valido && respuesta.clave !== clave
  const error = respuesta.clave === clave ? respuesta.error : ''
  const data = vigente ? respuesta.data : null
  const intervalo = errorRango ? 'Revisa las fechas' : `${fechaCorta(visible.desde)} al ${fechaCorta(visible.hasta)}`
  const guardarURL = (cambios) =>
    setParams(
      (actual) => {
        const n = new URLSearchParams(actual)
        Object.entries(cambios).forEach(([campo, valor]) => n.set(campo, String(valor)))
        return n
      },
      { replace: true },
    )
  const cambiarRango = (rango) => {
    setVisible(rango)
    if (enPeriodo(rango.desde) && enPeriodo(rango.hasta)) guardarURL(rango)
  }
  const cambiarPaso = (n) => {
    guardarURL({
      paso: n,
      ...visible,
      secciones: elegidas.map((s) => s.id).join(','),
      ...(n === 1 ? { seccion: 'resumen' } : {}),
    })
    requestAnimationFrame(() => titulo.current?.focus())
  }
  const alternar = (id) => {
    const siguiente = SECCIONES.filter((s) => (s.id === id ? !seleccion.includes(id) : seleccion.includes(s.id))).map(
      (s) => s.id,
    )
    setSeleccion(siguiente)
    guardarURL({ secciones: siguiente.join(',') })
  }
  const consultar = paso > 0
  useEffect(() => {
    if (!valido || !consultar) return undefined
    const controller = new AbortController()
    api
      .get('/jefe-carrera/informe', {
        params: { carreraId: j.carreraId, periodo: j.periodo, desde: visible.desde, hasta: visible.hasta },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setRespuesta({ clave, data, error: '' })
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setRespuesta({ clave, data: null, error: mensajeError(e, 'No se pudo generar el informe') })
      })
    return () => controller.abort()
  }, [clave, valido, consultar, j.carreraId, j.periodo, visible.desde, visible.hasta])
  const descargar = async (formato, abrir = false) => {
    if (!vigente || descarga.formato) return
    // Se abre dentro del clic para que el navegador permita ver/imprimir el PDF.
    const ventana = abrir ? window.open('about:blank', '_blank') : null
    if (abrir && !ventana) {
      setDescarga({ formato: '', error: 'Permite abrir una pestaña o usa Descargar PDF para imprimirlo.' })
      return
    }
    const controller = new AbortController()
    exportacion.current = controller
    setDescarga({ formato, error: '' })
    try {
      const archivo = await api.get('/jefe-carrera/informe/exportar', {
        params: {
          carreraId: j.carreraId,
          periodo: j.periodo,
          ...visible,
          formato,
          secciones: elegidas.map((s) => s.id).join(','),
        },
        responseType: 'blob',
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (ventana) {
        const url = URL.createObjectURL(archivo.data)
        ventana.location.replace(url)
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } else {
        const nombre =
          archivo.headers?.['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1] ??
          `SICAT_${j.carrera?.codigo ?? 'carrera'}_${j.periodo}_${visible.desde}_${visible.hasta}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`
        descargarArchivo(archivo.data, nombre)
      }
      setDescarga({ formato: '', error: '' })
    } catch (e) {
      ventana?.close()
      if (!controller.signal.aborted)
        setDescarga({
          formato: '',
          error: (await mensajeDeBlob(e.response?.data)) ?? 'No se pudo descargar el informe. Intenta de nuevo.',
        })
    }
  }
  const seccion = (clave) => ({ clave, activa })
  return (
    <>
      <ol aria-label="Progreso del informe" className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm">
        {['Preparar', 'Revisar', 'Descargar'].map((texto, i) => (
          <li
            key={texto}
            aria-current={paso === i ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2',
              paso === i ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full border border-border text-xs',
                paso === i && 'border-primary bg-primary text-primary-foreground',
                paso > i && 'bg-accent text-foreground',
              )}
            >
              {paso > i ? <Check aria-hidden="true" className="size-4" /> : i + 1}
            </span>
            {texto}
          </li>
        ))}
      </ol>
      <div className="mt-8 min-w-0">
        <section className="min-w-0" aria-labelledby="informe-paso">
          <h2
            id="informe-paso"
            tabIndex={-1}
            ref={titulo}
            className="text-xl font-semibold tracking-tight outline-none"
          >
            {['¿Qué incluirá tu informe?', 'Revisa el contenido', 'Tu informe está listo'][paso]}
          </h2>
          {paso === 0 ? (
            <>
              <fieldset className="mt-6 min-w-0">
                <legend className="text-sm font-medium">Fechas del informe</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {meses.slice(-2).map((m) => (
                    <Button
                      key={m.value}
                      variant={mes === m.value ? 'secondary' : 'outline'}
                      className={cn('min-h-11 first-letter:uppercase', mes === m.value && 'border border-ring')}
                      aria-pressed={mes === m.value}
                      onClick={() => cambiarRango({ desde: m.desde, hasta: m.hasta })}
                    >
                      {m.label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => cambiarRango({ desde: limites.inicio, hasta: limites.fin })}
                  >
                    Todo el periodo
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
                  <label className="min-w-0 text-xs text-muted-foreground">
                    Desde
                    <input
                      type="date"
                      className={`${campoFecha} mt-1.5 block w-full min-w-0`}
                      value={visible.desde}
                      min={limites.inicio}
                      max={limites.fin}
                      onChange={(e) => cambiarRango({ ...visible, desde: e.target.value })}
                      onInput={(e) => cambiarRango({ ...visible, desde: e.currentTarget.value })}
                    />
                  </label>
                  <label className="min-w-0 text-xs text-muted-foreground">
                    Hasta
                    <input
                      type="date"
                      className={`${campoFecha} mt-1.5 block w-full min-w-0`}
                      value={visible.hasta}
                      min={limites.inicio}
                      max={limites.fin}
                      onChange={(e) => cambiarRango({ ...visible, hasta: e.target.value })}
                      onInput={(e) => cambiarRango({ ...visible, hasta: e.currentTarget.value })}
                    />
                  </label>
                </div>
                {errorRango && (
                  <p role="alert" className="mt-3 text-sm text-destructive-foreground">
                    {errorRango}
                  </p>
                )}
              </fieldset>
              <fieldset className="mt-8 min-w-0">
                <legend className="text-sm font-medium">Contenido del informe</legend>
                <div className="mt-3 divide-y divide-border border-y border-border">
                  {SECCIONES.map((s) => (
                    <label
                      key={s.id}
                      className="flex min-h-14 cursor-pointer items-center gap-3 py-3 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={seleccion.includes(s.id)}
                        onChange={() => alternar(s.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block text-sm font-medium">{s.titulo}</strong>
                      </span>
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {s.tiempo === 'corte' ? 'Al corte actual' : 'Del intervalo'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {!elegidas.length && (
                <p role="status" className="mt-3 text-sm text-muted-foreground">
                  Selecciona al menos una sección para continuar.
                </p>
              )}
            </>
          ) : (
            <>
              {cargando && (
                <div role="status" aria-label="Generando informe" className="mt-6">
                  <Esqueleto compacto />
                </div>
              )}
              {error && (
                <Aviso
                  tono="error"
                  titulo="No se pudo generar el informe"
                  accion={
                    <Button variant="outline" onClick={() => setIntento((v) => v + 1)}>
                      Reintentar
                    </Button>
                  }
                >
                  {error}
                </Aviso>
              )}
              {!valido && (
                <Aviso tono="error" titulo="Revisa el contenido del informe">
                  {errorRango || 'Selecciona al menos una sección antes de continuar.'}
                </Aviso>
              )}
              {data && paso === 1 && (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Consulta una sección a la vez. La descarga incluirá el resumen y las {elegidas.length} secciones
                    elegidas.
                  </p>
                  <label className="mt-6 block max-w-lg text-xs font-medium">
                    Sección que estás revisando
                    <select
                      className={`${selectClass} mt-2 w-full max-w-full`}
                      value={activa}
                      onChange={(e) => guardarURL({ seccion: e.target.value })}
                    >
                      <option value="resumen">Resumen general</option>
                      {elegidas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.titulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activa === 'resumen' ? (
                    <>
                      <Encabezado data={data} />
                      <Totales data={data} />
                    </>
                  ) : (
                    <div className="mt-7">
                      {' '}
                      <Seccion
                        {...seccion('cobertura')}
                        conteo={data.docentes.length}
                        titulo="Registro de listas por docente"
                        descripcion="Clases concluidas del intervalo."
                      >
                        <Tabla
                          columnas={[
                            'Docente',
                            'Horas/semana',
                            'Esperadas',
                            'Completas',
                            'Parciales',
                            'Sin captura',
                            'Tardías',
                            'Registro',
                          ]}
                          numericas={[1, 2, 3, 4, 5, 6, 7]}
                          filas={data.docentes.map((d) => [
                            d.nombre,
                            d.horasSemanales,
                            d.esperadas,
                            d.completas,
                            d.parciales,
                            d.sinCaptura,
                            d.tardias,
                            porcentaje(d.cobertura),
                          ])}
                          vacio="Sin docentes con clases en la carrera."
                        />
                      </Seccion>
                      <Seccion
                        {...seccion('listas')}
                        conteo={data.listasPendientes.length}
                        titulo="Listas de asistencia sin captura o parciales"
                      >
                        <Tabla
                          columnas={['Fecha', 'Horario', 'Materia', 'Grupo', 'Docente', 'Estado']}
                          filas={data.listasPendientes.map((l) => [
                            fechaCorta(l.fecha),
                            `${l.horaInicio}–${l.horaFin}`,
                            l.materia,
                            l.grupo,
                            l.docente,
                            l.estado === 'CAPTURA_PARCIAL'
                              ? `Captura parcial (${l.registros} de ${l.alumnos})`
                              : 'Sin captura',
                          ])}
                          vacio="Todas las listas de asistencia del intervalo están completas."
                        />
                      </Seccion>
                      <Seccion
                        {...seccion('avance')}
                        conteo={data.avance.length}
                        titulo="Avance de unidades por materia y grupo"
                        descripcion="Al corte de hoy."
                      >
                        <Tabla
                          columnas={[
                            'Materia',
                            'Grupo',
                            'Docente',
                            'Unidades',
                            'Calificaciones pendientes',
                            'Entregas sin revisar',
                            'Cierre',
                          ]}
                          numericas={[4, 5]}
                          filas={data.avance.map((o) => [
                            o.materia,
                            o.grupo,
                            o.docentes.join(', ') || 'Sin docente asignado',
                            o.unidades
                              .map((u) => `U${u.orden} ${ESTADO_UNIDAD[u.status]?.label.toLowerCase() ?? u.status}`)
                              .join(' · ') || 'Sin unidades',
                            o.calificacionesPendientes,
                            o.entregasPendientes,
                            o.cierre
                              ? `Cerrado el ${new Date(o.cierre.cerradoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${o.cierre.acreditados} de ${o.cierre.total} acreditados`
                              : 'Sin cerrar',
                          ])}
                          vacio="Sin materias ofertadas en el periodo."
                        />
                      </Seccion>
                      <Seccion
                        {...seccion('riesgo')}
                        conteo={data.riesgos.length}
                        titulo="Alumnos en riesgo"
                        descripcion="Al corte de hoy."
                      >
                        <Tabla
                          columnas={['Alumno', 'Número de control', 'Grupo', 'Materias', 'Motivos']}
                          filas={data.riesgos.map((a) => [
                            <span key="n" className="flex items-center gap-2">
                              <span className="inline-flex w-5 shrink-0">
                                <SexoBadge sexo={a.sexo} />
                              </span>
                              {a.nombre}
                            </span>,
                            a.numeroControl ?? '—',
                            a.grupos.join(', '),
                            a.materias.join(', '),
                            a.motivos.join(' · '),
                          ])}
                          vacio="Sin alumnos en riesgo con el criterio vigente."
                        />
                      </Seccion>
                      <Seccion
                        {...seccion('seguimientos')}
                        conteo={data.seguimientos.length}
                        titulo="Observaciones registradas en el intervalo"
                      >
                        <Tabla
                          columnas={['Fecha', 'Caso', 'Nota', 'Estado', 'Registró']}
                          filas={data.seguimientos.map((n) => [
                            fechaHoraCorta(n.fecha),
                            n.caso,
                            n.texto,
                            n.estado === 'CERRADA' ? 'Cerrado' : 'Abierto',
                            n.autor,
                          ])}
                          vacio="Sin observaciones en el intervalo."
                        />
                      </Seccion>
                    </div>
                  )}
                </>
              )}
              {data && paso === 2 && (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Elige el formato para compartirlo o vuelve a revisar el contenido.
                  </p>
                  <div className="mt-6 flex gap-3 rounded-[var(--radius-item)] bg-muted p-5">
                    <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <h3 className="font-semibold">Informe de jefatura de carrera</h3>
                      <p className="mt-1 text-sm">{intervalo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resumen y {elegidas.length} secciones · Generado {fechaHoraCorta(data.generadoEn)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                      className="min-h-11"
                      onClick={() => descargar('excel')}
                      disabled={!vigente || Boolean(descarga.formato)}
                    >
                      {descarga.formato === 'excel' ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <FileSpreadsheet aria-hidden="true" />
                      )}
                      Descargar Excel
                    </Button>
                    <Button
                      className="min-h-11"
                      variant="outline"
                      onClick={() => descargar('pdf')}
                      disabled={!vigente || Boolean(descarga.formato)}
                    >
                      {descarga.formato === 'pdf' ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <FileText aria-hidden="true" />
                      )}
                      Descargar PDF
                    </Button>
                    <Button
                      className="min-h-11"
                      variant="ghost"
                      onClick={() => descargar('pdf', true)}
                      disabled={!vigente || Boolean(descarga.formato)}
                    >
                      <Printer aria-hidden="true" />
                      Abrir PDF para imprimir
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Los archivos usan el formato institucional de SICAT. Excel permite trabajar con las tablas; PDF
                    conserva la presentación y la firma de jefatura.
                  </p>
                  {descarga.formato && (
                    <p role="status" className="mt-3 text-sm text-muted-foreground">
                      Generando archivo institucional…
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {descarga.error && (
            <p role="alert" className="mt-4 text-sm text-destructive-foreground">
              {descarga.error}
            </p>
          )}
          <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            {paso > 0 ? (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={Boolean(descarga.formato)}
                onClick={() => cambiarPaso(paso - 1)}
              >
                <ArrowLeft aria-hidden="true" />
                {paso === 1 ? 'Editar contenido' : 'Volver a revisar'}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">{elegidas.length} de 5 secciones incluidas</span>
            )}
            {paso < 2 && (
              <Button
                className="min-h-11"
                disabled={paso === 0 ? !valido : !vigente}
                onClick={() => cambiarPaso(paso + 1)}
              >
                {paso === 0 ? 'Revisar informe' : 'Elegir descarga'}
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </footer>
        </section>
      </div>
    </>
  )
}

function Encabezado({ data }) {
  return (
    <dl className="mt-6 grid gap-x-8 gap-y-2 text-[0.8125rem] sm:grid-cols-2 lg:grid-cols-4">
      {[
        ['Carrera', `${data.carrera.nombre} (${data.carrera.codigo})`],
        ['Periodo', periodoTexto(data.periodo)],
        ['Intervalo', `${fechaSinDia(data.intervalo.desde)} al ${fechaSinDia(data.intervalo.hasta)}`],
        ['Generado', fechaHoraCorta(data.generadoEn)],
      ].map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 font-medium text-foreground first-letter:uppercase">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Las listas y notas son del intervalo; calificaciones y riesgo son el estado al momento de generar el informe. */
function Totales({ data }) {
  const t = data.totales
  const grupos = [
    {
      id: 'intervalo',
      titulo: `En el intervalo · ${fechaSinDia(data.intervalo.desde)} al ${fechaSinDia(data.intervalo.hasta)}`,
      filas: [
        ['Clases con lista esperada', t.clasesEsperadas],
        ['Listas de asistencia completas', t.listasCompletas],
        ['Listas de asistencia sin captura o parciales', t.listasPendientes],
        ['Cobertura de captura', porcentaje(t.cobertura)],
        ['Observaciones', t.seguimientos],
      ],
    },
    {
      id: 'corte',
      titulo: `Al corte · ${fechaHoraCorta(data.generadoEn)}`,
      nota: 'No dependen del intervalo: es el estado del periodo cuando se generó el informe.',
      filas: [
        ['Calificaciones de unidades cerradas sin capturar', t.calificacionesPendientes],
        ['Alumnos en riesgo', t.alumnosRiesgo],
      ],
    },
  ]
  return (
    <section aria-labelledby="informe-resumen" className="mt-8">
      <SeccionTitulo id="informe-resumen" titulo="Resumen" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {grupos.map((g) => (
          <div key={g.id} className="min-w-0">
            <h3 className="text-xs font-medium text-muted-foreground first-letter:uppercase">{g.titulo}</h3>
            {g.nota && <p className="mt-0.5 text-xs text-muted-foreground">{g.nota}</p>}
            <dl className="mt-2 border-t border-border text-[0.8125rem]">
              {g.filas.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Una tabla a la vez; el documento institucional se genera en el servidor. */
function Seccion({ clave, activa, titulo, descripcion, conteo, children }) {
  if (activa !== clave) return null
  return (
    <section aria-labelledby={`informe-${clave}-titulo`}>
      <h3 id={`informe-${clave}-titulo`} className="text-base font-semibold">
        {titulo}
        <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">{conteo}</span>
      </h3>
      {descripcion && <p className="mt-2 text-xs text-muted-foreground">{descripcion}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Tabla({ columnas, filas, numericas = [], vacio }) {
  if (!filas.length) return <Vacio titulo={vacio} />
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={columnas.join(', ')}>
      <table className="w-full min-w-[640px] border-collapse text-[0.8125rem]">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {columnas.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={`py-2.5 pr-4 font-medium ${numericas.includes(i) ? 'text-right' : ''}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, f) => (
            <tr key={f} className="border-t border-border align-top">
              {fila.map((celda, i) => (
                <td
                  key={i}
                  className={`py-2.5 pr-4 ${i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'} ${numericas.includes(i) ? 'text-right tabular-nums' : ''}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
