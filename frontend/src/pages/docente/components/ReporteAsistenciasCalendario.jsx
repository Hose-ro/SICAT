import { useEffect, useId, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'

const VACIO = { materias: [], unidades: [], fechasClase: [], diasClase: [] }
const clave = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
const fechaLocal = (fecha) => { const [y, m, d] = fecha.split('-').map(Number); return new Date(y, m - 1, d) }
const campo = 'mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground'

export default function ReporteAsistenciasCalendario({ grupoInicial = '', materiaInicial = '', onVer }) {
  const id = useId()
  const [seleccion, setSeleccion] = useState({ grupoId: grupoInicial, materiaId: grupoInicial ? materiaInicial : '', unidadId: '' })
  const [grupos, setGrupos] = useState([])
  const [consulta, setConsulta] = useState({ key: '', datos: VACIO, cargando: true, error: '' })
  const [intento, setIntento] = useState(0)
  const key = `${seleccion.grupoId}:${seleccion.materiaId}:${seleccion.unidadId}:${intento}`

  useEffect(() => {
    const controller = new AbortController()
    let vigente = true
    const params = Object.fromEntries(Object.entries({ orden: 'grupo', ...seleccion }).filter(([, valor]) => valor))
    api.get('/asistencias/filtros-disponibles', { params, signal: controller.signal })
      .then(({ data }) => {
        if (!vigente) return
        setGrupos(data.grupos ?? [])
        setConsulta({ key, datos: { ...VACIO, ...data }, cargando: false, error: '' })
      })
      .catch((error) => {
        if (!vigente) return
        const mensaje = error.response?.data?.message
        setConsulta({ key, datos: VACIO, cargando: false, error: Array.isArray(mensaje) ? mensaje.join('. ') : mensaje || 'No se pudieron cargar las opciones del reporte.' })
      })
    return () => { vigente = false; controller.abort() }
  }, [key, seleccion])

  const actual = consulta.key === key
  const datos = actual ? consulta.datos : VACIO
  const cargando = !actual || consulta.cargando
  const error = actual ? consulta.error : ''
  const grupo = grupos.find((g) => String(g.id) === seleccion.grupoId)
  const materia = datos.materias.find((m) => String(m.id) === seleccion.materiaId)
  const unidad = datos.unidades.find((u) => String(u.id) === seleccion.unidadId)
  const cambiar = (campo, valor) => setSeleccion((s) => campo === 'grupoId'
    ? { grupoId: valor, materiaId: '', unidadId: '' }
    : campo === 'materiaId' ? { ...s, materiaId: valor, unidadId: '' } : { ...s, unidadId: valor })

  const ver = (fecha) => {
    if (!grupo || !materia || !unidad || !datos.fechasClase.includes(fecha)) return
    onVer({
      materiaId: seleccion.materiaId,
      opciones: { grupoId: seleccion.grupoId, unidadId: seleccion.unidadId, fecha },
      descripcion: `${grupo.nombre} · ${materia.nombre} · ${unidad.nombre} · ${fechaLocal(fecha).toLocaleDateString('es-MX', { dateStyle: 'long' })}`,
    })
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="min-w-0 rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h3 id={`${id}-titulo`} className="flex items-center gap-2 text-base font-semibold text-foreground"><CalendarDays className="size-5 text-primary-ink" aria-hidden="true" /> Reporte por día</h3>
        <p className="mt-1 text-sm text-muted-foreground">Elige grupo, materia y unidad; después abre el reporte desde el calendario.</p>
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0"><label htmlFor={`${id}-grupoId`} className="text-xs font-medium text-muted-foreground">Grupo</label>
            <select id={`${id}-grupoId`} className={campo} value={seleccion.grupoId} onChange={(e) => cambiar('grupoId', e.target.value)} disabled={!grupos.length && cargando}>
              <option value="">{!grupos.length && cargando ? 'Cargando grupos…' : 'Selecciona un grupo'}</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}{g.modalidad === 'MIXTO' ? ' · Mixto' : ''}</option>)}
            </select>
          </div>
          <div className="min-w-0"><label htmlFor={`${id}-materiaId`} className="text-xs font-medium text-muted-foreground">Materia</label>
            <select id={`${id}-materiaId`} className={campo} value={seleccion.materiaId} onChange={(e) => cambiar('materiaId', e.target.value)} disabled={!seleccion.grupoId || cargando || !datos.materias.length}>
              <option value="">{!seleccion.grupoId ? 'Primero elige un grupo' : cargando ? 'Cargando materias…' : 'Selecciona una materia'}</option>
              {datos.materias.map((m) => <option key={m.id} value={m.id}>{m.clave ? `${m.clave} · ` : ''}{m.nombre}</option>)}
            </select>
          </div>
          <div className="min-w-0"><label htmlFor={`${id}-unidadId`} className="text-xs font-medium text-muted-foreground">Unidad</label>
            <select id={`${id}-unidadId`} className={campo} value={seleccion.unidadId} onChange={(e) => cambiar('unidadId', e.target.value)} disabled={!seleccion.materiaId || cargando || !datos.unidades.length}>
              <option value="">{!seleccion.materiaId ? 'Primero elige una materia' : cargando ? 'Cargando unidades…' : 'Selecciona una unidad'}</option>
              {datos.unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        </div>
        {cargando && <p role="status" className="text-sm text-muted-foreground">Consultando tus clases…</p>}
        {error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive-foreground">{error}<Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button></div>
          : !cargando && !grupos.length ? <p className="text-sm text-muted-foreground">No tienes grupos con horarios activos para consultar.</p>
            : !cargando && seleccion.grupoId && !datos.materias.length ? <p className="text-sm text-muted-foreground">No tienes materias disponibles en este grupo.</p>
              : !cargando && seleccion.materiaId && !datos.unidades.length ? <p className="text-sm text-muted-foreground">Esta materia todavía no tiene unidades registradas.</p> : null}
        {!cargando && !error && unidad && (
          <CalendarioReporte key={key} fechas={datos.fechasClase} dias={datos.diasClase} onVer={ver} />
        )}
      </div>
    </section>
  )
}

function CalendarioReporte({ fechas, dias, onVer }) {
  const [mes, setMes] = useState(() => {
    const hoy = clave(new Date())
    const inicio = fechas[0]
    const fin = fechas.at(-1)
    const elegida = fin ? (hoy < inicio ? inicio : hoy > fin ? fin : hoy) : hoy
    const fecha = fechaLocal(elegida)
    return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  })
  if (!fechas.length) return <p className="rounded-xl bg-muted px-4 py-5 text-sm text-muted-foreground">No hay sesiones registradas para esta unidad y grupo. El calendario aparecerá cuando haya una clase registrada.</p>
  const disponibles = new Set(fechas)
  const sesiones = new Map(dias.map((d) => [d.fecha, d.sesiones]))
  const mesClave = clave(mes).slice(0, 7)
  const desplazamiento = (mes.getDay() + 6) % 7
  const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas = Array.from({ length: Math.ceil((desplazamiento + total) / 7) * 7 }, (_, i) => {
    const dia = i - desplazamiento + 1
    return dia > 0 && dia <= total ? new Date(mes.getFullYear(), mes.getMonth(), dia) : null
  })
  const titulo = mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const cambiarMes = (paso) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + paso, 1))
  return (
    <div className="min-w-0 border-t border-border pt-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="font-semibold text-foreground">{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h4>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" aria-label="Mes anterior del reporte" disabled={mesClave <= fechas[0].slice(0, 7)} onClick={() => cambiarMes(-1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" aria-label="Mes siguiente del reporte" disabled={mesClave >= fechas.at(-1).slice(0, 7)} onClick={() => cambiarMes(1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground sm:gap-2">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <span key={d} className="py-2">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={`vacio-${i}`} />
          const valor = clave(fecha)
          const habilitado = disponibles.has(valor)
          const cantidad = sesiones.get(valor) ?? 1
          return <button key={valor} type="button" disabled={!habilitado} onClick={() => onVer(valor)} aria-label={`${fecha.toLocaleDateString('es-MX', { dateStyle: 'full' })}: ${habilitado ? `ver reporte de ${cantidad} ${cantidad === 1 ? 'sesión' : 'sesiones'}` : 'sin sesiones registradas'}`}
            className={`min-w-0 rounded-xl border p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-20 sm:p-3 ${habilitado ? 'min-h-16 border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15' : 'min-h-16 border-transparent text-muted-foreground/60'}`}>
            <span className="text-sm font-semibold">{fecha.getDate()}</span>
            {habilitado && <span className="mt-1 block text-[11px] sm:text-xs" aria-hidden="true"><span className="sm:hidden">×{cantidad}</span><span className="hidden sm:inline">{cantidad} {cantidad === 1 ? 'clase' : 'clases'}</span></span>}
          </button>
        })}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><span className="size-3 rounded bg-primary/25" aria-hidden="true" /> Fechas con sesiones registradas en la unidad. Selecciona un día para verlo y descargarlo.</p>
    </div>
  )
}
