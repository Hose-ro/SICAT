import { useEffect, useMemo, useState } from 'react'
import { FileDown, FileSpreadsheet, LoaderCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import TaskNotice from '@/components/TaskNotice'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'
import { useAuthStore } from '@/store/authStore'
import logoTecnm from '@/logoTec/tecnm.png'
import escudoCosamaloapan from '@/logoTec/escudo-cosamaloapan.png'

const SELECT = 'mt-1.5 h-11 w-full rounded-[var(--radius-item)] border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40'
const fecha = (valor) => new Date(`${valor}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const porcentaje = (valor) => `${valor ?? 0}%`

function useReporteParcial() {
  const user = useAuthStore((state) => state.user)
  const [params] = useSearchParams()
  const [contexto, setContexto] = useState(null)
  const [seleccion, setSeleccion] = useState({ carreraId: '', docenteId: '' })
  const [estado, setEstado] = useState({ data: null, loading: true, error: '' })
  const [reintento, setReintento] = useState(0)

  useEffect(() => {
    let activo = true
    api.get('/reportes/parcial-semestre/contexto')
      .then(({ data }) => {
        if (!activo) return
        const solicitada = Number(params.get('carreraId'))
        const carreraId = String(data.carreras.some((carrera) => carrera.id === solicitada) ? solicitada : data.seleccion?.carreraId ?? data.carreras?.[0]?.id ?? '')
        const disponibles = (data.docentes ?? []).filter((docente) => docente.carreraIds.includes(Number(carreraId)))
        const solicitado = Number(params.get('docenteId'))
        const docenteId = String(disponibles.some((docente) => docente.id === solicitado) ? solicitado : data.seleccion?.docenteId ?? disponibles[0]?.id ?? '')
        setContexto(data)
        setSeleccion({ carreraId, docenteId })
        if (!carreraId || !docenteId) setEstado({ data: null, loading: false, error: '' })
      })
      .catch((error) => activo && setEstado({ data: null, loading: false, error: error.response?.data?.message ?? 'No se pudo preparar el reporte.' }))
    return () => { activo = false }
  }, [params, reintento])

  useEffect(() => {
    if (!contexto || !seleccion.carreraId || !seleccion.docenteId) {
      return undefined
    }
    let activo = true
    api.get('/reportes/parcial-semestre', { params: seleccion })
      .then(({ data }) => activo && setEstado({ data, loading: false, error: '' }))
      .catch((error) => activo && setEstado({ data: null, loading: false, error: error.response?.data?.message ?? 'No se pudo generar el reporte parcial.' }))
    return () => { activo = false }
  }, [contexto, seleccion])

  const cambiarCarrera = (carreraId) => {
    const disponibles = contexto.docentes.filter((docente) => docente.carreraIds.includes(Number(carreraId)))
    setEstado((actual) => ({ ...actual, loading: true, error: '' }))
    setSeleccion({ carreraId, docenteId: user?.rol === 'DOCENTE' ? String(user.id) : String(disponibles[0]?.id ?? '') })
  }
  const cambiarDocente = (docenteId) => {
    setEstado((actual) => ({ ...actual, loading: true, error: '' }))
    setSeleccion((actual) => ({ ...actual, docenteId }))
  }
  return { contexto, seleccion, cambiarCarrera, cambiarDocente, estado, reintentar: () => setReintento((n) => n + 1) }
}

export default function ReporteParcialSemestre() {
  const { contexto, seleccion, cambiarCarrera, cambiarDocente, estado, reintentar } = useReporteParcial()
  const [descargando, setDescargando] = useState('')
  const [descargaError, setDescargaError] = useState('')
  const docentes = useMemo(() => (contexto?.docentes ?? []).filter((docente) => docente.carreraIds.includes(Number(seleccion.carreraId))), [contexto, seleccion.carreraId])

  const descargar = async (formato) => {
    if (!estado.data || descargando) return
    setDescargando(formato)
    setDescargaError('')
    try {
      const respuesta = await api.get('/reportes/parcial-semestre/exportar', { params: { ...seleccion, formato }, responseType: 'blob' })
      const nombre = respuesta.headers?.['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1]
        ?? `reporte-parcial.${formato === 'pdf' ? 'pdf' : 'xlsx'}`
      descargarArchivo(respuesta.data, nombre)
    } catch (error) {
      setDescargaError((await mensajeDeBlob(error.response?.data)) ?? 'No se pudo descargar el reporte.')
    } finally {
      setDescargando('')
    }
  }

  return (
    <div className="mx-auto max-w-[88rem] space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Reporte parcial del semestre</h1>
          <p className="mt-1.5 max-w-[65ch] text-sm text-muted-foreground">Consulta el avance por materia y grupo antes de descargar el formato institucional.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => descargar('pdf')} disabled={!estado.data || Boolean(descargando)}>
            {descargando === 'pdf' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}
            {descargando === 'pdf' ? 'Generando…' : 'Descargar PDF'}
          </Button>
          <Button onClick={() => descargar('excel')} disabled={!estado.data || Boolean(descargando)}>
            {descargando === 'excel' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
            {descargando === 'excel' ? 'Generando…' : 'Descargar Excel'}
          </Button>
        </div>
      </header>

      {contexto && (
        <section aria-label="Datos del reporte" className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
          <label className="text-xs font-medium text-muted-foreground">
            Carrera
            <select value={seleccion.carreraId} onChange={(event) => cambiarCarrera(event.target.value)} className={SELECT}>
              {contexto.carreras.map((carrera) => <option key={carrera.id} value={carrera.id}>{carrera.nombre}</option>)}
            </select>
          </label>
          {contexto.rol === 'JEFE_CARRERA' && (
            <label className="text-xs font-medium text-muted-foreground">
              Docente
              <select value={seleccion.docenteId} onChange={(event) => cambiarDocente(event.target.value)} className={SELECT}>
                {docentes.map((docente) => <option key={docente.id} value={docente.id}>{docente.nombre}</option>)}
              </select>
            </label>
          )}
        </section>
      )}

      {descargaError && <p role="alert" className="text-sm text-destructive-foreground">{descargaError}</p>}
      {estado.error && <TaskNotice error={estado.error} onRetry={reintentar} />}
      {estado.loading && !estado.data && (
        <div role="status" aria-label="Generando reporte" className="space-y-4">
          <Skeleton className="h-36 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-80 w-full rounded-[var(--radius-card)]" />
        </div>
      )}
      {estado.data && <Documento reporte={estado.data} actualizando={estado.loading} />}
    </div>
  )
}

function Documento({ reporte, actualizando }) {
  const filas = [...reporte.filas, { ...reporte.totales, id: 'total', materia: { nombre: 'TOTAL' }, unidad: null, semestre: '', grupo: { nombre: '' } }]
  return (
    <article aria-busy={actualizando || undefined} className={`overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[0_18px_60px_-44px_var(--primary-glow)] ${actualizando ? 'opacity-60' : ''}`}>
      <header className="grid grid-cols-[5rem_minmax(0,1fr)_4.25rem] items-center gap-4 border-b border-border px-4 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_5rem] sm:px-7">
        <img src={logoTecnm} alt="Tecnológico Nacional de México" className="h-12 w-full object-contain sm:h-16" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground sm:text-base">{reporte.institucion}</p>
          <p className="mt-1 text-[0.6875rem] text-muted-foreground sm:text-xs">Nombre del formato: Reporte parcial del semestre del SGI del G3</p>
          <p className="mt-1 text-[0.625rem] text-muted-foreground">Página 1 de 1 · Versión {reporte.version}</p>
        </div>
        <img src={escudoCosamaloapan} alt="Escudo del Instituto Tecnológico Superior de Cosamaloapan" className="h-14 w-full object-contain sm:h-[4.5rem]" />
      </header>

      <div className="px-4 py-6 sm:px-7 sm:py-8">
        <div className="text-center">
          <h2 className="text-base font-semibold uppercase tracking-[-0.01em] text-foreground">{reporte.institucion}</h2>
          <p className="mt-1 text-xs uppercase text-muted-foreground">{reporte.area}</p>
          <p className="mt-4 text-sm font-semibold text-foreground">División de: {reporte.carrera.nombre}</p>
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-3 border-y border-border py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Reporte" value="Parcial" />
          <Dato label="Semestre" value={reporte.periodoTexto} />
          <Dato label="Periodo reportado" value={`${fecha(reporte.intervalo.desde)} al ${fecha(reporte.intervalo.hasta)}`} />
          <Dato label="Profesor(a)" value={reporte.docente.nombre} />
          <Dato label="Grupos atendidos" value={reporte.gruposAtendidos} />
          <Dato label="Asignaturas diferentes" value={reporte.asignaturasDiferentes} />
          <Dato label="Pendientes de calificación" value={reporte.totales.pendientes} />
          <Dato label="Sin sexo registrado" value={reporte.totales.total.sinDato} />
        </dl>

        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border pb-6 sm:grid-cols-4">
          <Resumen label="Alumnos" value={reporte.totales.total.total} />
          <Resumen label="Acreditados" value={`${reporte.totales.acreditados.total} · ${porcentaje(reporte.totales.porcentajeAcreditados.total)}`} />
          <Resumen label="No acreditados" value={`${reporte.totales.noAcreditados.total} · ${porcentaje(reporte.totales.porcentajeNoAcreditados.total)}`} />
          <Resumen label="Desertores detectados" value={`${reporte.totales.desertores.total} · ${porcentaje(reporte.totales.porcentajeDesertores.total)}`} />
        </div>

        <div tabIndex={0} role="region" aria-label="Detalle del reporte parcial" className="mt-7 overflow-x-auto rounded-[var(--radius-item)] border border-border focus-visible:ring-3 focus-visible:ring-ring/40">
          <table className="w-full min-w-[1180px] border-collapse text-[0.75rem]">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th rowSpan="2" className="sticky left-0 z-20 bg-primary px-3 py-3 text-left">Asignatura</th>
                <th rowSpan="2" className="px-2 py-3">Unidad</th><th rowSpan="2" className="px-2 py-3">Sem.</th><th rowSpan="2" className="px-2 py-3">Grupo</th>
                <GrupoCabecera letra="A" titulo="Alumnos" columnas={2} />
                <GrupoCabecera letra="B" titulo="Acreditados" columnas={4} />
                <GrupoCabecera letra="C" titulo="% acreditados" columnas={2} />
                <GrupoCabecera letra="D" titulo="No acreditados" columnas={2} />
                <GrupoCabecera letra="E" titulo="% no acreditados" columnas={2} />
                <GrupoCabecera letra="F" titulo="Desertores" columnas={2} />
                <GrupoCabecera letra="G" titulo="% desertores" columnas={2} />
              </tr>
              <tr className="border-t border-primary-foreground/25 text-[0.6875rem]">
                <th>H</th><th>M</th><th>PO H</th><th>PO M</th><th>SO H</th><th>SO M</th>
                <th>H</th><th>M</th><th>H</th><th>M</th><th>H</th><th>M</th><th>H</th><th>M</th><th>H</th><th>M</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((fila) => <Fila key={fila.id ?? `${fila.materia.id}:${fila.grupo.id}`} fila={fila} total={fila.id === 'total'} />)}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-2 text-xs leading-relaxed text-muted-foreground">
          {reporte.notas.map((nota, index) => <p key={nota}><span className="font-semibold text-foreground">{index + 1}.</span> {nota}</p>)}
        </div>
      </div>
    </article>
  )
}

function Dato({ label, value }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium text-foreground first-letter:uppercase">{value}</dd></div>
}
function Resumen({ label, value }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p></div>
}
function GrupoCabecera({ letra, titulo, columnas }) {
  return <th colSpan={columnas} className="border-l border-primary-foreground/25 px-2 py-2"><span className="block text-[0.625rem] font-medium opacity-80">{letra}</span>{titulo}</th>
}
function Fila({ fila, total }) {
  const c = (valor, porcentajeValor = false) => <td className="px-2 py-2 text-center tabular-nums">{porcentajeValor ? porcentaje(valor) : valor}</td>
  return (
    <tr className={total ? 'bg-accent font-semibold text-foreground' : 'bg-card text-foreground hover:bg-muted/45'}>
      <th scope="row" className={`sticky left-0 z-10 min-w-56 px-3 py-2 text-left ${total ? 'bg-accent' : 'bg-card'}`}>{fila.materia.nombre}</th>
      {c(fila.unidad?.orden ?? '—')}{c(fila.semestre || '—')}{c(fila.grupo.nombre || '—')}
      {c(fila.total.hombres)}{c(fila.total.mujeres)}{c(fila.po.hombres)}{c(fila.po.mujeres)}{c(fila.so.hombres)}{c(fila.so.mujeres)}
      {c(fila.porcentajeAcreditados.hombres, true)}{c(fila.porcentajeAcreditados.mujeres, true)}
      {c(fila.noAcreditados.hombres)}{c(fila.noAcreditados.mujeres)}{c(fila.porcentajeNoAcreditados.hombres, true)}{c(fila.porcentajeNoAcreditados.mujeres, true)}
      {c(fila.desertores.hombres)}{c(fila.desertores.mujeres)}{c(fila.porcentajeDesertores.hombres, true)}{c(fila.porcentajeDesertores.mujeres, true)}
    </tr>
  )
}
