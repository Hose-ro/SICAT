import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Layers,
  ScanLine,
  UserCheck,
  UsersRound,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles',
  'Jueves', 'Viernes', 'Sábado',
]

function fechaLarga(fecha) {
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`
}

/**
 * "Hoy" / "hace 3 días" a partir de la fecha real del último registro. Antes
 * este texto estaba escrito a mano y siempre decía "Hoy".
 */
function desdeCuando(iso) {
  if (!iso) return null
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null

  const inicioDeHoy = new Date()
  inicioDeHoy.setHours(0, 0, 0, 0)
  const inicio = new Date(fecha)
  inicio.setHours(0, 0, 0, 0)

  const dias = Math.round((inicioDeHoy - inicio) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  return `el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [panel, setPanel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    api
      .get('/dashboard/admin')
      .then((res) => {
        if (activo) setPanel(res.data)
      })
      .catch((err) => {
        if (activo) {
          setError(
            err.response?.data?.message ?? 'No se pudo cargar el panel',
          )
        }
      })
      .finally(() => {
        if (activo) setLoading(false)
      })
    return () => {
      activo = false
    }
  }, [])

  if (loading) return <PanelCargando />

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
        {error}
      </div>
    )
  }

  const pendientes = panel?.pendientes ?? {}
  const colas = [
    {
      clave: 'registros',
      etiqueta: 'Registros por aprobar',
      valor: pendientes.registrosPorAprobar ?? 0,
      detalle: 'Alumnos esperando acceso',
      to: '/usuarios',
      icono: <UserCheck className="size-4 shrink-0" aria-hidden="true" />,
      urgente: true,
    },
    {
      clave: 'horarios',
      etiqueta: 'Horarios por revisar',
      valor: pendientes.horariosPorRevisar ?? 0,
      detalle: 'Cargas leídas por el sistema',
      to: '/admin/horarios-importados',
      icono: <ScanLine className="size-4 shrink-0" aria-hidden="true" />,
      urgente: true,
    },
    {
      clave: 'inscripciones',
      etiqueta: 'Inscripciones pendientes',
      valor: pendientes.inscripcionesPendientes ?? 0,
      detalle: 'Solicitudes sin resolver',
      to: '/materias',
      icono: <ClipboardList className="size-4 shrink-0" aria-hidden="true" />,
      urgente: false,
    },
  ]

  const totalPendiente = colas.reduce((suma, cola) => suma + cola.valor, 0)

  return (
    <div className="space-y-5">
      <Encabezado
        nombre={user?.nombre?.split(' ')[0] ?? 'Admin'}
        periodo={panel?.periodo}
        totalPendiente={totalPendiente}
      />

      <Colas colas={colas} totalPendiente={totalPendiente} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Actividad actividad={panel?.actividad} />
        <Catalogo catalogo={panel?.catalogo} />
      </section>

      <MateriasPorConfigurar
        materias={panel?.materiasIncompletas ?? []}
        total={panel?.totalMateriasIncompletas ?? 0}
      />
    </div>
  )
}

function Encabezado({ nombre, periodo, totalPendiente }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          Bienvenido, {nombre}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fechaLarga(new Date())} — Sistema de Gestión de Asistencias y
          Calificaciones
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {totalPendiente > 0 && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive-foreground">
            {totalPendiente} pendiente{totalPendiente === 1 ? '' : 's'}
          </span>
        )}
        {periodo && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary-ink">
            Periodo {periodo}
          </span>
        )}
      </div>
    </div>
  )
}

/** Lo que el admin tiene que resolver. Es lo único que encabeza la página. */
function Colas({ colas, totalPendiente }) {
  if (totalPendiente === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card px-5 py-6 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay nada pendiente
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ningún registro, horario ni inscripción espera revisión.
        </p>
      </section>
    )
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {colas.map(({ clave, etiqueta, valor, detalle, to, icono, urgente }) => {
        const activo = valor > 0
        const acento = activo && urgente ? "text-destructive-foreground" : 'text-foreground'

        return (
          <Link
            key={clave}
            to={to}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-muted-foreground">
                {icono}
                <span className="truncate text-sm font-medium text-foreground">
                  {etiqueta}
                </span>
              </div>
              <p className={`mt-2 text-3xl font-semibold tabular-nums ${acento}`}>
                {valor}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activo ? detalle : 'Sin pendientes'}
              </p>
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
          </Link>
        )
      })}
    </section>
  )
}

/** Señal de que el sistema se está usando hoy. Todo sale de la base de datos. */
function Actividad({ actividad }) {
  const clases = actividad?.clasesHoy ?? 0
  const asistencias = actividad?.asistenciasHoy ?? 0
  const tareas = actividad?.tareasPublicadas ?? 0
  const ultimo = desdeCuando(actividad?.ultimoRegistro)

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Actividad de hoy</h2>

      <dl className="mt-4 space-y-3">
        <FilaDato
          icono={<CalendarCheck className="size-4 shrink-0" aria-hidden="true" />}
          etiqueta="Clases registradas"
          valor={clases}
        />
        <FilaDato
          icono={<UsersRound className="size-4 shrink-0" aria-hidden="true" />}
          etiqueta="Asistencias capturadas"
          valor={asistencias}
        />
        <FilaDato
          icono={<ClipboardList className="size-4 shrink-0" aria-hidden="true" />}
          etiqueta="Tareas publicadas"
          valor={tareas}
        />
      </dl>

      <p className="mt-auto border-t border-border pt-4 text-xs text-muted-foreground">
        {ultimo
          ? `Última clase registrada ${ultimo}.`
          : 'Todavía no se ha registrado ninguna clase.'}
      </p>
    </section>
  )
}

function FilaDato({ icono, etiqueta, valor }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {icono}
        {etiqueta}
      </dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground">
        {valor}
      </dd>
    </div>
  )
}

/** Tamaño del sistema. Son cifras de referencia, así que van planas y densas. */
function Catalogo({ catalogo }) {
  const icono = 'size-3.5 shrink-0'
  const entradas = [
    { etiqueta: 'Carreras', valor: catalogo?.carreras ?? 0, to: '/carreras', icono: <GraduationCap className={icono} aria-hidden="true" /> },
    { etiqueta: 'Materias', valor: catalogo?.materias ?? 0, to: '/materias', icono: <BookOpen className={icono} aria-hidden="true" /> },
    { etiqueta: 'Grupos', valor: catalogo?.grupos ?? 0, to: '/admin/grupos', icono: <Layers className={icono} aria-hidden="true" /> },
    { etiqueta: 'Docentes', valor: catalogo?.docentes ?? 0, to: '/usuarios', icono: <UsersRound className={icono} aria-hidden="true" /> },
    { etiqueta: 'Alumnos', valor: catalogo?.alumnos ?? 0, to: '/usuarios', icono: <UserCheck className={icono} aria-hidden="true" /> },
  ]

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">
        Catálogo del periodo
      </h2>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entradas.map(({ etiqueta, valor, to, icono: marca }) => (
          <li key={etiqueta}>
            <Link
              to={to}
              className="flex h-full flex-col gap-1 rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {marca}
                {etiqueta}
              </span>
              <span className="text-xl font-semibold tabular-nums text-foreground">
                {valor}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Grupos cuenta solo los activos del periodo en curso.
      </p>
    </section>
  )
}

/**
 * Reemplaza la lista de "5 materias en orden alfabético": una materia sin
 * docente o sin horario activo no se puede impartir, y eso sí es trabajo
 * del admin.
 */
function MateriasPorConfigurar({ materias, total }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Materias por configurar
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sin docente asignado o sin horario activo
          </p>
        </div>
        <Link
          to="/materias"
          className="shrink-0 text-sm font-medium text-primary-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Ver todas
        </Link>
      </div>

      {materias.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Todas las materias tienen docente y horario asignados.
        </p>
      ) : (
        <>
          <ul>
            {materias.map((materia) => (
              <li key={materia.id} className="border-b border-border last:border-b-0">
                <Link
                  to={`/materias/${materia.id}`}
                  className="flex flex-col items-start gap-2 px-5 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {materia.nombre}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {materia.clave}
                      {materia.carrera ? ` · ${materia.carrera}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
                    {materia.sinDocente && <Falta>Sin docente</Falta>}
                    {materia.sinHorario && <Falta>Sin horario</Falta>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {total > materias.length && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              {total - materias.length} materia
              {total - materias.length === 1 ? '' : 's'} más por configurar.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Falta({ children }) {
  return (
    <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning-foreground ">
      {children}
    </span>
  )
}

function PanelCargando() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el panel…</span>
      <div className="h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
    </div>
  )
}
