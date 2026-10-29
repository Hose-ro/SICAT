import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, FileSpreadsheet, FileText, LoaderCircle, Printer } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import SexoBadge from '@/components/SexoBadge'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import { claveFecha, esClaveValida, fechaCorta, fechaHoraCorta, hoyClave, parseClave, periodoTexto } from './supervision/formato'
import { ESTADO_UNIDAD } from './supervision/estados'
import { cn } from '@/lib/utils'
import { Aviso, Esqueleto, JefaturaPage, SeccionTitulo, Vacio, selectClass } from './supervision/ui'
import { mensajeError } from './supervision/useJefatura'

const campoFecha = 'h-11 rounded-[0.7rem] border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

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

const fechaSinDia = (clave) => parseClave(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const porcentaje = (v) => (v == null ? 'Sin clases' : `${v} %`)

export default function JefeReportes() {
  return (
    <JefaturaPage titulo="Informe del periodo" subtitulo="Para juntas académicas y evidencia institucional. Usa el mismo cálculo que la supervisión en pantalla.">
      {/* Cambiar de carrera o periodo empieza un informe nuevo: nada del anterior se conserva. */}
      {({ j, resumen }) => <Informe key={`${j.carreraId}|${j.periodo}`} j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

function Informe({ j, resumen }) {
  const limites = useMemo(() => limitesPeriodo(resumen.calendarios), [resumen.calendarios])
  const meses = useMemo(() => mesesDe(limites), [limites])
  const inicial = meses.at(-1) ?? { desde: limites.inicio, hasta: limites.fin }
  // El intervalo se refleja en la URL: un enlace o una recarga abren el mismo informe.
  // En pantalla manda el estado local, para que dos cambios seguidos no se pisen.
  const [params, setParams] = useSearchParams()
  const enPeriodo = (clave) => esClaveValida(clave) && clave >= limites.inicio && clave <= limites.fin
  const [visible, setVisible] = useState(() => (enPeriodo(params.get('desde')) && enPeriodo(params.get('hasta'))
    ? { desde: params.get('desde'), hasta: params.get('hasta') }
    : { desde: inicial.desde, hasta: inicial.hasta }))
  const cambiarRango = (siguiente) => {
    setVisible(siguiente)
    if (!enPeriodo(siguiente.desde) || !enPeriodo(siguiente.hasta)) return
    setParams((actual) => {
      const n = new URLSearchParams(actual)
      n.set('desde', siguiente.desde)
      n.set('hasta', siguiente.hasta)
      return n
    }, { replace: true })
  }
  const cambiarFecha = (campo, valor) => cambiarRango({ ...visible, [campo]: valor })
  // Lo escrito a mano puede salir del periodo; se conserva solo para explicar el error.
  const fueraDelPeriodo = !enPeriodo(visible.desde) || !enPeriodo(visible.hasta)
  const rango = visible
  // La respuesta guarda la consulta que la produjo: mientras no coincide con la actual, se está cargando.
  const [respuesta, setRespuesta] = useState({ clave: '', data: null, error: '' })
  const [descarga, setDescarga] = useState({ formato: '', error: '' })
  // Una lista a la vez: la sección abierta vive en la URL para sobrevivir a recargas.
  const abierta = params.get('seccion') ?? ''
  const alternar = (clave) => setParams((actual) => {
    const n = new URLSearchParams(actual)
    if (n.get('seccion') === clave) n.delete('seccion'); else n.set('seccion', clave)
    return n
  }, { replace: true })
  const seccion = (clave) => ({ clave, abierta: abierta === clave, onAlternar: () => alternar(clave) })
  const mes = meses.find((m) => m.desde === rango.desde && m.hasta === rango.hasta)?.value ?? ''
  const invertido = Boolean(visible.desde && visible.hasta && visible.desde > visible.hasta)
  const valido = !fueraDelPeriodo && !invertido
  const clave = `${j.carreraId}|${j.periodo}|${rango.desde}|${rango.hasta}`

  useEffect(() => {
    if (!valido) return undefined
    let activo = true
    api.get('/jefe-carrera/informe', { params: { carreraId: j.carreraId, periodo: j.periodo, desde: rango.desde, hasta: rango.hasta } })
      .then(({ data }) => { if (activo) setRespuesta({ clave, data, error: '' }) })
      .catch((error) => { if (activo) setRespuesta((r) => ({ clave, data: r.data, error: mensajeError(error, 'No se pudo generar el informe') })) })
    return () => { activo = false }
  }, [clave, valido, j.carreraId, j.periodo, rango.desde, rango.hasta])

  const estado = {
    data: respuesta.data,
    cargando: valido && respuesta.clave !== clave,
    error: respuesta.clave === clave ? respuesta.error : '',
  }
  // Solo se descarga o imprime el informe que corresponde al intervalo elegido, ya cargado y sin error.
  const vigente = valido && respuesta.clave === clave && !respuesta.error && Boolean(respuesta.data)
  const anterior = Boolean(respuesta.data) && !vigente

  const descargar = async (formato) => {
    setDescarga({ formato, error: '' })
    try {
      const respuesta = await api.get('/jefe-carrera/informe/exportar', { params: { carreraId: j.carreraId, periodo: j.periodo, ...rango, formato }, responseType: 'blob' })
      const nombre = respuesta.headers?.['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1]
        ?? `SICAT_${j.carrera?.codigo ?? 'carrera'}_${j.periodo}_${rango.desde}_${rango.hasta}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`
      descargarArchivo(respuesta.data, nombre)
      setDescarga({ formato: '', error: '' })
    } catch (error) {
      setDescarga({ formato: '', error: (await mensajeDeBlob(error.response?.data)) ?? 'No se pudo descargar el informe. Intenta de nuevo.' })
    }
  }

  const { data } = estado
  return (
    <>
      <section aria-label="Intervalo y descarga" className="print-hidden mt-6 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full sm:w-52">
            <span className="text-xs font-medium text-muted-foreground">Mes</span>
            <select
              value={mes}
              onChange={(e) => { const m = meses.find((x) => x.value === e.target.value); if (m) cambiarRango({ desde: m.desde, hasta: m.hasta }) }}
              className={`${selectClass} mt-1.5 first-letter:uppercase`}
            >
              {!mes && <option value="">Intervalo personalizado</option>}
              {meses.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">Desde</span>
            <input type="date" className={`${campoFecha} mt-1.5 block`} value={visible.desde} min={limites.inicio} max={limites.fin} onChange={(e) => cambiarFecha('desde', e.target.value)} />
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">Hasta</span>
            <input type="date" className={`${campoFecha} mt-1.5 block`} value={visible.hasta} min={limites.inicio} max={limites.fin} onChange={(e) => cambiarFecha('hasta', e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => descargar('excel')} disabled={!vigente || Boolean(descarga.formato)}>
            {descarga.formato === 'excel' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
            {descarga.formato === 'excel' ? 'Generando…' : 'Descargar Excel'}
          </Button>
          <Button variant="outline" onClick={() => descargar('pdf')} disabled={!vigente || Boolean(descarga.formato)}>
            {descarga.formato === 'pdf' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
            {descarga.formato === 'pdf' ? 'Generando…' : 'Descargar PDF'}
          </Button>
          <Button variant="ghost" onClick={() => window.print()} disabled={!vigente}><Printer aria-hidden="true" /> Imprimir</Button>
        </div>
      </section>
      {invertido && <p role="alert" className="print-hidden mt-3 text-[0.8125rem] text-destructive-foreground">La fecha final debe ser igual o posterior a la inicial. Descargas e impresión quedan en pausa hasta corregirla.</p>}
      {fueraDelPeriodo && !invertido && <p role="alert" className="print-hidden mt-3 text-[0.8125rem] text-destructive-foreground">Elige fechas dentro de {periodoTexto(j.periodo)}: del {fechaSinDia(limites.inicio)} al {fechaSinDia(limites.fin)}.</p>}
      {!vigente && valido && !estado.error && <p role="status" className="print-hidden mt-3 text-xs text-muted-foreground">Las descargas se habilitan cuando termina de generarse el informe del intervalo elegido.</p>}
      {descarga.error && <p role="alert" className="print-hidden mt-3 text-[0.8125rem] text-destructive-foreground">{descarga.error}</p>}

      {anterior && <p className="hidden print:block">Este informe no está vigente para el intervalo elegido; vuelve a generarlo en SICAT antes de imprimir.</p>}
      {estado.cargando && !data ? (
        <Esqueleto compacto />
      ) : estado.error && !data ? (
        <Aviso tono="error" titulo="No se pudo generar el informe">{estado.error}</Aviso>
      ) : data && (
        <div aria-busy={estado.cargando || undefined} className={cn(anterior && 'opacity-60 print:hidden')}>
          {anterior && (
            <p role={estado.error ? 'alert' : 'status'} className="mt-4 rounded-[var(--radius-item)] border border-warning/35 bg-warning/18 px-4 py-3 text-[0.8125rem] text-foreground">
              <b className="font-medium">Informe anterior: {fechaSinDia(data.intervalo.desde)} al {fechaSinDia(data.intervalo.hasta)}.</b>{' '}
              {estado.error ? `${estado.error}. No corresponde al intervalo elegido.` : estado.cargando ? 'Generando el informe del intervalo elegido…' : 'No corresponde al intervalo elegido.'}
            </p>
          )}
          <Encabezado data={data} />
          <Totales data={data} />
          <p className="print-hidden mt-10 text-xs text-muted-foreground">Abre la lista que necesites; al imprimir se incluyen todas.</p>
          <div className="mt-3 border-t border-border print:border-0">
          <Seccion {...seccion('cobertura')} conteo={data.docentes.length} titulo="Cobertura de captura por docente" descripcion="Clases concluidas con lista esperada en el intervalo. El registro en SICAT es evidencia de captura; no confirma presencia física del docente.">
            <Tabla
              columnas={['Docente', 'Horas/semana', 'Esperadas', 'Completas', 'Parciales', 'Sin captura', 'Tardías', 'Cobertura']}
              numericas={[1, 2, 3, 4, 5, 6, 7]}
              filas={data.docentes.map((d) => [d.nombre, d.horasSemanales, d.esperadas, d.completas, d.parciales, d.sinCaptura, d.tardias, porcentaje(d.cobertura)])}
              vacio="Sin docentes con clases en la carrera."
            />
          </Seccion>
          <Seccion {...seccion('listas')} conteo={data.listasPendientes.length} titulo="Listas sin captura o parciales">
            <Tabla
              columnas={['Fecha', 'Horario', 'Materia', 'Grupo', 'Docente', 'Estado']}
              filas={data.listasPendientes.map((l) => [fechaCorta(l.fecha), `${l.horaInicio}–${l.horaFin}`, l.materia, l.grupo, l.docente, l.estado === 'CAPTURA_PARCIAL' ? `Captura parcial (${l.registros} de ${l.alumnos})` : 'Sin captura'])}
              vacio="Todas las listas del intervalo están completas."
            />
          </Seccion>
          <Seccion {...seccion('avance')} conteo={data.avance.length} titulo="Avance de unidades por materia y grupo" descripcion="Estado al día de hoy; las unidades son de la materia y se comparten entre grupos.">
            <Tabla
              columnas={['Materia', 'Grupo', 'Docente', 'Unidades', 'Calificaciones pendientes', 'Entregas sin revisar', 'Cierre']}
              numericas={[4, 5]}
              filas={data.avance.map((o) => [o.materia, o.grupo, o.docentes.join(', ') || 'Sin docente asignado', o.unidades.map((u) => `U${u.orden} ${ESTADO_UNIDAD[u.status]?.label.toLowerCase() ?? u.status}`).join(' · ') || 'Sin unidades', o.calificacionesPendientes, o.entregasPendientes, o.cierre ? `Cerrado el ${new Date(o.cierre.cerradoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${o.cierre.acreditados} de ${o.cierre.total} acreditados` : 'Sin cerrar'])}
              vacio="Sin materias ofertadas en el periodo."
            />
          </Seccion>
          <Seccion {...seccion('riesgo')} conteo={data.riesgos.length} titulo="Alumnos en riesgo" descripcion="Al corte de hoy, con el mismo criterio de Inicio y Grupos.">
            <Tabla
              columnas={['Alumno', 'Número de control', 'Grupo', 'Materias', 'Motivos']}
              filas={data.riesgos.map((a) => [<span key="n" className="flex items-center gap-2"><span className="inline-flex w-5 shrink-0"><SexoBadge sexo={a.sexo} /></span>{a.nombre}</span>, a.numeroControl ?? '—', a.grupos.join(', '), a.materias.join(', '), a.motivos.join(' · ')])}
              vacio="Sin alumnos en riesgo con el criterio vigente."
            />
          </Seccion>
          <Seccion {...seccion('seguimientos')} conteo={data.seguimientos.length} titulo="Observaciones registradas en el intervalo">
            <Tabla
              columnas={['Fecha', 'Caso', 'Nota', 'Estado', 'Registró']}
              filas={data.seguimientos.map((n) => [fechaHoraCorta(n.fecha), n.caso, n.texto, n.estado === 'CERRADA' ? 'Cerrado' : 'Abierto', n.autor])}
              vacio="Sin observaciones en el intervalo."
            />
          </Seccion>
          </div>
        </div>
      )}
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
        ['Listas completas', t.listasCompletas],
        ['Listas sin captura o parciales', t.listasPendientes],
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

/** Título como botón: la lista se despliega solo cuando el jefe la pide. Al imprimir, todas abiertas. */
function Seccion({ clave, titulo, descripcion, conteo, abierta, onAlternar, children }) {
  const id = `informe-${clave}`
  return (
    <section aria-labelledby={`${id}-titulo`} className="break-inside-avoid-page border-b border-border print:mt-8 print:border-0">
      <h2 id={`${id}-titulo`} className="m-0">
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={`${id}-lista`}
          onClick={onAlternar}
          className="group flex min-h-14 w-full items-center gap-3 py-3 text-left focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <span className="min-w-0 flex-1">
            <span className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-foreground group-hover:text-primary-ink">{titulo}</span>
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{conteo}</span>
            {descripcion && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{descripcion}</span>}
          </span>
          <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out print:hidden', abierta && 'rotate-180')} />
        </button>
      </h2>
      <div id={`${id}-lista`} className={cn('pb-5', !abierta && 'hidden print:block')}>
        {children}
      </div>
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
            {columnas.map((c, i) => <th key={c} scope="col" className={`py-2.5 pr-4 font-medium ${numericas.includes(i) ? 'text-right' : ''}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, f) => (
            <tr key={f} className="border-t border-border align-top">
              {fila.map((celda, i) => (
                <td key={i} className={`py-2.5 pr-4 ${i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'} ${numericas.includes(i) ? 'text-right tabular-nums' : ''}`}>{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
