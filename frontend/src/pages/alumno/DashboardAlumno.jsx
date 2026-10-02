import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarOff,
  ClipboardCheck,
  GraduationCap,
  Radio,
  Upload,
  UserX,
} from 'lucide-react'
import api from '../../api/axios'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/utils'
import { useAuthStore } from '../../store/authStore'
import { plazoTarea } from '../../lib/tareas'
import { pedirPermisoAvisos, permisoAvisos } from '../../lib/avisosSistema'

const CLASES_ACTIVAS_MS = 30000

const MOTIVO_TAREA = {
  corregir: { etiqueta: 'Para corregir', clase: 'bg-warning/15 text-warning-foreground' },
  atrasada: { etiqueta: 'Atrasada', clase: 'bg-destructive/10 text-destructive-foreground' },
  hoy: { etiqueta: 'Vence hoy', clase: 'bg-warning/15 text-warning-foreground' },
  pendiente: { etiqueta: 'Por entregar', clase: 'bg-muted text-muted-foreground' },
}
const ORDEN_MOTIVO = { corregir: 0, atrasada: 1, hoy: 2, pendiente: 3 }

const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const aMinutos = (hora) => {
  const [h, m] = String(hora ?? '0:0').split(':').map(Number)
  return h * 60 + m
}

/**
 * Lo que el alumno todavía puede hacer: entregar lo que no ha entregado y
 * corregir lo que le devolvieron. Primero lo urgente.
 */
export function tareasPorHacer(items, ahora = new Date()) {
  return items
    .filter(({ tarea, miEntrega, puedeEditarEntrega }) =>
      puedeEditarEntrega && tarea.estado !== 'CERRADA' &&
      (!miEntrega || miEntrega.estadoRevision === 'INCORRECTA'))
    .map((item) => {
      const plazo = plazoTarea(item.tarea, ahora)
      const motivo = item.miEntrega?.estadoRevision === 'INCORRECTA'
        ? 'corregir'
        : plazo.vencido ? 'atrasada' : plazo.dias === 0 ? 'hoy' : 'pendiente'
      return { ...item, plazo, motivo }
    })
    .sort((a, b) =>
      ORDEN_MOTIVO[a.motivo] - ORDEN_MOTIVO[b.motivo] ||
      (a.plazo.dias ?? Infinity) - (b.plazo.dias ?? Infinity))
}

export function calificacionesRecientes(items, limite = 3) {
  return items
    .filter(({ miEntrega }) => miEntrega?.estadoRevision === 'CALIFICADA' && miEntrega.calificacion != null)
    .sort((a, b) => new Date(b.miEntrega.fechaRevision ?? 0) - new Date(a.miEntrega.fechaRevision ?? 0))
    .slice(0, limite)
}

/** Clases de hoy en orden, marcando la que está en curso y la que sigue. */
export function clasesDeHoy(horarios, ahora = new Date()) {
  const dia = normalizar(ahora.toLocaleDateString('es-MX', { weekday: 'long' }))
  const minutos = ahora.getHours() * 60 + ahora.getMinutes()
  const deHoy = horarios
    .filter((h) => String(h.dias ?? '').split(',').some((d) => normalizar(d) === dia))
    .sort((a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio))
  let siguienteMarcada = false
  return deHoy.map((h) => {
    let estado = 'pendiente'
    if (aMinutos(h.horaFin) <= minutos) estado = 'terminada'
    else if (aMinutos(h.horaInicio) <= minutos) estado = 'ahora'
    else if (!siguienteMarcada) {
      estado = 'siguiente'
      siguienteMarcada = true
    }
    return { ...h, estado }
  })
}

function fechaLarga(fecha) {
  const texto = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function fechaClaveLarga(clave) {
  const [y, m, d] = clave.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

function Tarjeta({ titulo, icono: Icono, accion, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`} aria-label={titulo}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icono className="h-4 w-4 text-primary-ink" aria-hidden="true" />
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

function Vacio({ children }) {
  return <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">{children}</p>
}

function ErrorSeccion({ children }) {
  return <p role="alert" className="text-sm text-destructive-foreground">{children}</p>
}

function ClasesEnCurso({ clases }) {
  if (!clases.length) return null
  return (
    <div className="space-y-2">
      {clases.map((sesion) => (
        <Link
          key={sesion.id}
          to={`/alumno/materias/${sesion.materia?.id}`}
          role="status"
          className="flex items-start gap-3 rounded-2xl border-2 border-primary/40 bg-primary/10 p-4 text-foreground transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Radio className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              Clase en curso: {sesion.materia?.nombre}
            </span>
            <span className="block text-sm text-muted-foreground">
              {[sesion.docente?.nombre && `${sesion.docente.nombre} inició la clase`, sesion.horarioMateria?.aula?.nombre]
                .filter(Boolean).join(' · ')}
              {' — está pasando lista.'}
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function ActivarAvisos() {
  const [permiso, setPermiso] = useState(permisoAvisos)
  if (permiso !== 'default') return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Bell className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-foreground">
        Activa los avisos para saber en cuanto tu profe inicie la clase, aunque tengas SICAT en otra pestaña.
      </p>
      <Button type="button" onClick={async () => setPermiso(await pedirPermisoAvisos())}>
        Activar avisos
      </Button>
    </div>
  )
}

function TareasPendientes({ tareas }) {
  if (!tareas.length) return <Vacio>No tienes tareas por entregar. ¡Vas al día!</Vacio>
  return (
    <ul className="divide-y divide-border">
      {tareas.slice(0, 5).map(({ tarea, motivo, plazo }) => (
        <li key={tarea.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
          {/* En teléfono el título va en su propio renglón para que se lea completo. */}
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="text-sm font-medium text-foreground sm:truncate">{tarea.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {[tarea.materia?.nombre, plazo.relativo].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className={`mr-auto rounded-full px-2.5 py-0.5 text-xs font-medium sm:mr-0 ${MOTIVO_TAREA[motivo].clase}`}>
            {MOTIVO_TAREA[motivo].etiqueta}
          </span>
          <Link
            to={`/alumno/tareas/${tarea.id}`}
            aria-label={`${motivo === 'corregir' ? 'Corregir' : 'Entregar'} ${tarea.titulo}`}
            className={cn(buttonVariants({ size: 'sm', variant: motivo === 'pendiente' ? 'outline' : 'default' }))}
          >
            <Upload aria-hidden="true" />
            {motivo === 'corregir' ? 'Corregir' : 'Entregar'}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ClasesHoy({ clases }) {
  if (!clases.length) return <Vacio>Hoy no tienes clases.</Vacio>
  const etiqueta = { ahora: 'Ahora', siguiente: 'Sigue', terminada: 'Terminó' }
  return (
    <ol className="space-y-2">
      {clases.map((clase) => (
        <li
          key={clase.id ?? `${clase.materia?.id}-${clase.horaInicio}`}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
            clase.estado === 'ahora' ? 'bg-primary/10' : clase.estado === 'terminada' ? 'opacity-60' : 'bg-muted/40'
          }`}
        >
          <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {clase.horaInicio}–{clase.horaFin}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{clase.materia?.nombre}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {[clase.aula?.nombre, clase.docente?.nombre].filter(Boolean).join(' · ')}
            </span>
          </span>
          {etiqueta[clase.estado] && (
            <span className="text-xs font-medium text-primary-ink">{etiqueta[clase.estado]}</span>
          )}
        </li>
      ))}
    </ol>
  )
}

function MisFaltas({ materias }) {
  const conRegistros = materias.filter((m) => m.resumen?.total > 0)
  if (!conRegistros.length) return <Vacio>Todavía no hay asistencias registradas.</Vacio>
  const ordenadas = [...conRegistros].sort((a, b) =>
    Number(b.resumen.enRiesgo) - Number(a.resumen.enRiesgo) || b.resumen.faltas - a.resumen.faltas)
  return (
    <ul className="space-y-3">
      {ordenadas.map(({ materia, resumen }) => (
        <li key={materia.id}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium text-foreground">{materia.nombre}</p>
            <p className="shrink-0 text-xs text-muted-foreground">
              {plural(resumen.faltas, 'falta', 'faltas')} · {plural(resumen.retardos, 'retardo', 'retardos')}
            </p>
          </div>
          <div
            role="meter"
            aria-label={`Asistencia en ${materia.nombre}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={resumen.porcentaje}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full ${resumen.enRiesgo ? 'bg-destructive' : 'bg-success'}`}
              style={{ width: `${resumen.porcentaje}%` }}
            />
          </div>
          <p className={`mt-1 text-xs ${resumen.enRiesgo ? 'font-medium text-destructive-foreground' : 'text-muted-foreground'}`}>
            {resumen.enRiesgo && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />}
            {resumen.porcentaje} % de asistencia{resumen.enRiesgo ? ' · en riesgo por faltas y retardos' : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

function CalificacionesRecientes({ items }) {
  if (!items.length) return <Vacio>Aún no tienes tareas calificadas.</Vacio>
  return (
    <ul className="space-y-3">
      {items.map(({ tarea, miEntrega }) => (
        <li key={tarea.id}>
          <Link to={`/alumno/tareas/${tarea.id}`} className="group flex items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            <span className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-xl text-base font-semibold tabular-nums ${
              miEntrega.calificacion >= 70 ? 'bg-success/10 text-success-foreground' : 'bg-warning/15 text-warning-foreground'
            }`}>
              {miEntrega.calificacion}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground group-hover:underline">{tarea.titulo}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {miEntrega.observacion ? `“${miEntrega.observacion}”` : tarea.materia?.nombre}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function DiasSinClases({ dias }) {
  if (!dias.length) return <Vacio>No hay días sin clases en los próximos 30 días.</Vacio>
  return (
    <ul className="space-y-2.5">
      {dias.map((dia) => (
        <li key={dia.fecha} className="text-sm">
          <p className="font-medium text-foreground first-letter:uppercase">{fechaClaveLarga(dia.fecha)}</p>
          <p className="text-xs text-muted-foreground">
            {dia.motivo}{dia.institucional ? ' · sin clases para todos' : ` · sin ${dia.materias.join(', ')}`}
          </p>
        </li>
      ))}
    </ul>
  )
}

/** Inicio del alumno: lo que tiene que hacer hoy y cómo va, en una pantalla. */
export default function DashboardAlumno() {
  const user = useAuthStore((state) => state.user)
  const [datos, setDatos] = useState({})
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(true)
  const [clasesActivas, setClasesActivas] = useState([])
  const ahora = useMemo(() => new Date(), [])

  useEffect(() => {
    let cancelado = false
    // Cada sección carga por su cuenta: si una falla, las demás se ven igual.
    const fuentes = {
      tareas: () => api.get('/tareas/mis-tareas'),
      asistencias: () => api.get('/asistencias/mis-resumen'),
      horario: () => api.get('/horarios/mis-horarios-alumno'),
      diasSinClases: () => api.get('/periodos/actual/dias-sin-clases'),
    }
    Promise.allSettled(Object.values(fuentes).map((cargar) => cargar())).then((resultados) => {
      if (cancelado) return
      const nuevos = {}
      const fallas = {}
      Object.keys(fuentes).forEach((clave, i) => {
        if (resultados[i].status === 'fulfilled') nuevos[clave] = resultados[i].value.data
        else fallas[clave] = true
      })
      setDatos(nuevos)
      setErrores(fallas)
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [])

  // La clase en curso cambia durante el día: se consulta seguido mientras se ve.
  const cargarClasesActivas = useCallback(() => {
    if (document.hidden) return
    api.get('/clases/mis-clases-activas').then((res) => setClasesActivas(res.data ?? [])).catch(() => {})
  }, [])
  useEffect(() => {
    cargarClasesActivas()
    const timer = setInterval(cargarClasesActivas, CLASES_ACTIVAS_MS)
    document.addEventListener('visibilitychange', cargarClasesActivas)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', cargarClasesActivas)
    }
  }, [cargarClasesActivas])

  const tareas = useMemo(() => tareasPorHacer(datos.tareas ?? [], ahora), [datos.tareas, ahora])
  const calificadas = useMemo(() => calificacionesRecientes(datos.tareas ?? []), [datos.tareas])
  const clasesHoy = useMemo(() => clasesDeHoy(datos.horario?.horarios ?? [], ahora), [datos.horario, ahora])
  const faltasTotales = (datos.asistencias ?? []).reduce((suma, m) => suma + (m.resumen?.faltas ?? 0), 0)
  const enRiesgo = (datos.asistencias ?? []).filter((m) => m.resumen?.enRiesgo).length

  const venceHoy = tareas.filter((t) => t.motivo === 'hoy').length
  const corregir = tareas.filter((t) => t.motivo === 'corregir').length
  const atrasadas = tareas.filter((t) => t.motivo === 'atrasada').length
  const resumen = !datos.tareas
    ? ''
    : tareas.length
      ? `Tienes ${plural(tareas.length, 'tarea pendiente', 'tareas pendientes')}${
        [venceHoy && `${venceHoy} vence${venceHoy === 1 ? '' : 'n'} hoy`,
          atrasadas && plural(atrasadas, 'atrasada', 'atrasadas'),
          corregir && `${corregir} para corregir`].filter(Boolean).map((t) => `, ${t}`).join('')}.`
      : 'No tienes tareas pendientes.'

  const siguienteTarea = tareas[0]
  const acciones = [
    {
      etiqueta: 'Entregar tarea',
      detalle: siguienteTarea ? siguienteTarea.tarea.titulo : 'Nada pendiente',
      to: siguienteTarea ? `/alumno/tareas/${siguienteTarea.tarea.id}` : '/tareas',
      icono: Upload,
    },
    {
      etiqueta: 'Mis faltas',
      detalle: datos.asistencias ? `${plural(faltasTotales, 'falta', 'faltas')} en total` : 'Ver asistencias',
      to: '/asistencias',
      icono: UserX,
    },
    { etiqueta: 'Mi horario', detalle: 'Semana completa', to: '/alumno/horario', icono: CalendarClock },
    { etiqueta: 'Calificaciones', detalle: 'Por unidad', to: '/calificaciones', icono: GraduationCap },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{fechaLarga(ahora)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Hola, {user?.nombre?.split(' ')[0] ?? 'alumno'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cargando ? 'Cargando tu resumen...' : resumen}
          {enRiesgo > 0 && (
            <span className="font-medium text-destructive-foreground">
              {' '}Cuidado: vas en riesgo por faltas en {plural(enRiesgo, 'materia', 'materias')}.
            </span>
          )}
        </p>
      </header>

      <ClasesEnCurso clases={clasesActivas} />
      <ActivarAvisos />

      <nav aria-label="Acciones rápidas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {acciones.map(({ etiqueta, detalle, to, icono: Icono }) => (
          <Link
            key={etiqueta}
            to={to}
            className="flex min-h-20 items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Icono className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{etiqueta}</span>
              <span className="block truncate text-xs text-muted-foreground">{detalle}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Tarjeta
            titulo="Tareas pendientes"
            icono={ClipboardCheck}
            accion={<Link to="/tareas" className="text-sm font-medium text-primary-ink hover:underline">Ver todas</Link>}
          >
            {errores.tareas ? <ErrorSeccion>No se pudieron cargar tus tareas.</ErrorSeccion>
              : cargando ? <Vacio>Cargando...</Vacio> : <TareasPendientes tareas={tareas} />}
          </Tarjeta>
          <Tarjeta titulo="Clases de hoy" icono={CalendarClock}>
            {errores.horario ? <ErrorSeccion>No se pudo cargar tu horario.</ErrorSeccion>
              : cargando ? <Vacio>Cargando...</Vacio> : <ClasesHoy clases={clasesHoy} />}
          </Tarjeta>
        </div>
        <div className="min-w-0 space-y-5">
          <Tarjeta
            titulo="Mis faltas"
            icono={UserX}
            accion={<Link to="/asistencias" className="text-sm font-medium text-primary-ink hover:underline">Detalle</Link>}
          >
            {errores.asistencias ? <ErrorSeccion>No se pudieron cargar tus asistencias.</ErrorSeccion>
              : cargando ? <Vacio>Cargando...</Vacio> : <MisFaltas materias={datos.asistencias ?? []} />}
          </Tarjeta>
          <Tarjeta titulo="Calificaciones recientes" icono={GraduationCap}>
            {errores.tareas ? <ErrorSeccion>No se pudieron cargar tus calificaciones.</ErrorSeccion>
              : cargando ? <Vacio>Cargando...</Vacio> : <CalificacionesRecientes items={calificadas} />}
          </Tarjeta>
          <Tarjeta titulo="Próximos días sin clases" icono={CalendarOff}>
            {errores.diasSinClases ? <ErrorSeccion>No se pudo cargar el calendario.</ErrorSeccion>
              : cargando ? <Vacio>Cargando...</Vacio> : <DiasSinClases dias={datos.diasSinClases ?? []} />}
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
