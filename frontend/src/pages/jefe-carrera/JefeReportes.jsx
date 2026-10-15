import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, LoaderCircle, Printer } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import SexoBadge from '@/components/SexoBadge'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import { claveFecha, fechaCorta, fechaHoraCorta, hoyClave, parseClave, periodoTexto } from './supervision/formato'
import { ESTADO_UNIDAD } from './supervision/estados'
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
      {({ j, resumen }) => <Informe j={j} resumen={resumen} />}
    </JefaturaPage>
  )
}

function Informe({ j, resumen }) {
  const limites = useMemo(() => limitesPeriodo(resumen.calendarios), [resumen.calendarios])
  const meses = useMemo(() => mesesDe(limites), [limites])
  const inicial = meses.at(-1) ?? { desde: limites.inicio, hasta: limites.fin }
  const [rango, setRango] = useState({ desde: inicial.desde, hasta: inicial.hasta })
  // La respuesta guarda la consulta que la produjo: mientras no coincide con la actual, se está cargando.
  const [respuesta, setRespuesta] = useState({ clave: '', data: null, error: '' })
  const [descarga, setDescarga] = useState({ formato: '', error: '' })
  const mes = meses.find((m) => m.desde === rango.desde && m.hasta === rango.hasta)?.value ?? ''
  const valido = Boolean(rango.desde && rango.hasta && rango.desde <= rango.hasta)
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
              onChange={(e) => { const m = meses.find((x) => x.value === e.target.value); if (m) setRango({ desde: m.desde, hasta: m.hasta }) }}
              className={`${selectClass} mt-1.5 first-letter:uppercase`}
            >
              {!mes && <option value="">Intervalo personalizado</option>}
              {meses.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">Desde</span>
            <input type="date" className={`${campoFecha} mt-1.5 block`} value={rango.desde} min={limites.inicio} max={limites.fin} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} />
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">Hasta</span>
            <input type="date" className={`${campoFecha} mt-1.5 block`} value={rango.hasta} min={limites.inicio} max={limites.fin} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => descargar('excel')} disabled={!data || Boolean(descarga.formato)}>
            {descarga.formato === 'excel' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
            {descarga.formato === 'excel' ? 'Generando…' : 'Descargar Excel'}
          </Button>
          <Button variant="outline" onClick={() => descargar('pdf')} disabled={!data || Boolean(descarga.formato)}>
            {descarga.formato === 'pdf' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
            {descarga.formato === 'pdf' ? 'Generando…' : 'Descargar PDF'}
          </Button>
          <Button variant="ghost" onClick={() => window.print()} disabled={!data}><Printer aria-hidden="true" /> Imprimir</Button>
        </div>
      </section>
      {!valido && <p role="alert" className="print-hidden mt-3 text-[0.8125rem] text-destructive-foreground">La fecha final debe ser igual o posterior a la inicial.</p>}
      {descarga.error && <p role="alert" className="print-hidden mt-3 text-[0.8125rem] text-destructive-foreground">{descarga.error}</p>}

      {estado.cargando && !data ? (
        <Esqueleto compacto />
      ) : estado.error && !data ? (
        <Aviso tono="error" titulo="No se pudo generar el informe">{estado.error}</Aviso>
      ) : data && (
        <div aria-busy={estado.cargando || undefined} className={estado.cargando ? 'opacity-60' : undefined}>
          {estado.error && <p role="alert" className="mt-4 text-[0.8125rem] text-warning-foreground">{estado.error} Se muestra el intervalo anterior.</p>}
          <Encabezado data={data} />
          <Totales data={data} />
          <Seccion titulo="Cobertura de captura por docente" descripcion="Clases concluidas con lista esperada en el intervalo. El registro en SICAT es evidencia de captura; no confirma presencia física del docente.">
            <Tabla
              columnas={['Docente', 'Horas/semana', 'Esperadas', 'Completas', 'Parciales', 'Sin captura', 'Tardías', 'Cobertura']}
              numericas={[1, 2, 3, 4, 5, 6, 7]}
              filas={data.docentes.map((d) => [d.nombre, d.horasSemanales, d.esperadas, d.completas, d.parciales, d.sinCaptura, d.tardias, porcentaje(d.cobertura)])}
              vacio="Sin docentes con clases en la carrera."
            />
          </Seccion>
          <Seccion titulo="Listas sin captura o parciales">
            <Tabla
              columnas={['Fecha', 'Horario', 'Materia', 'Grupo', 'Docente', 'Estado']}
              filas={data.listasPendientes.map((l) => [fechaCorta(l.fecha), `${l.horaInicio}–${l.horaFin}`, l.materia, l.grupo, l.docente, l.estado === 'CAPTURA_PARCIAL' ? `Captura parcial (${l.registros} de ${l.alumnos})` : 'Sin captura'])}
              vacio="Todas las listas del intervalo están completas."
            />
          </Seccion>
          <Seccion titulo="Avance de unidades por materia y grupo" descripcion="Estado al día de hoy; las unidades son de la materia y se comparten entre grupos.">
            <Tabla
              columnas={['Materia', 'Grupo', 'Docente', 'Unidades', 'Calificaciones pendientes', 'Entregas sin revisar', 'Cierre']}
              numericas={[4, 5]}
              filas={data.avance.map((o) => [o.materia, o.grupo, o.docentes.join(', ') || 'Sin docente asignado', o.unidades.map((u) => `U${u.orden} ${ESTADO_UNIDAD[u.status]?.label.toLowerCase() ?? u.status}`).join(' · ') || 'Sin unidades', o.calificacionesPendientes, o.entregasPendientes, o.cierre ? `Cerrado el ${new Date(o.cierre.cerradoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${o.cierre.acreditados} de ${o.cierre.total} acreditados` : 'Sin cerrar'])}
              vacio="Sin materias ofertadas en el periodo."
            />
          </Seccion>
          <Seccion titulo="Alumnos en riesgo" descripcion="Al corte de hoy, con el mismo criterio de Inicio y Grupos.">
            <Tabla
              columnas={['Alumno', 'Número de control', 'Grupo', 'Materias', 'Motivos']}
              filas={data.riesgos.map((a) => [<span key="n" className="flex items-center gap-2">{a.nombre}<SexoBadge sexo={a.sexo} /></span>, a.numeroControl ?? '—', a.grupos.join(', '), a.materias.join(', '), a.motivos.join(' · ')])}
              vacio="Sin alumnos en riesgo con el criterio vigente."
            />
          </Seccion>
          <Seccion titulo="Seguimientos registrados en el intervalo">
            <Tabla
              columnas={['Fecha', 'Caso', 'Nota', 'Estado', 'Registró']}
              filas={data.seguimientos.map((n) => [fechaHoraCorta(n.fecha), n.caso, n.texto, n.estado === 'CERRADA' ? 'Cerrado' : 'Abierto', n.autor])}
              vacio="Sin notas de seguimiento en el intervalo."
            />
          </Seccion>
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

function Totales({ data }) {
  const t = data.totales
  const filas = [
    ['Clases con lista esperada', t.clasesEsperadas],
    ['Listas completas', t.listasCompletas],
    ['Listas sin captura o parciales', t.listasPendientes],
    ['Cobertura de captura', porcentaje(t.cobertura)],
    ['Calificaciones de unidad pendientes', t.calificacionesPendientes],
    ['Alumnos en riesgo', t.alumnosRiesgo],
    ['Notas de seguimiento', t.seguimientos],
  ]
  return (
    <section aria-labelledby="informe-resumen" className="mt-8">
      <SeccionTitulo id="informe-resumen" titulo="Resumen" />
      <dl className="grid border-t border-border text-[0.8125rem] sm:grid-cols-2">
        {filas.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 sm:odd:pr-6 sm:even:pl-6">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Seccion({ titulo, descripcion, children }) {
  const id = `informe-${titulo.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="mt-10 break-inside-avoid-page">
      <SeccionTitulo id={id} titulo={titulo} descripcion={descripcion} />
      {children}
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
