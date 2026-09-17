import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  FileText,
  GraduationCap,
  Search,
  UserPlus,
} from 'lucide-react'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import PeriodoEscolarCard from '../../components/PeriodoEscolarCard'

const DIAS_LARGOS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Estados en los que todavía se puede registrar la lista de esa clase. */
const ESTADOS_ABIERTOS = ['EN_CURSO', 'FUERA_DE_HORARIO', 'PROGRAMADA_AHORA']

function minutosDeHora(hora) {
  const [h, m] = String(hora ?? '').split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : 0
}

function formatearDuracion(minutos) {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

function fechaLarga(fecha) {
  return `${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`
}

export default function DashboardDocente() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [panel, setPanel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorClase, setErrorClase] = useState('')
  const [iniciando, setIniciando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  // El "faltan X min" del encabezado se queda viejo si nadie lo refresca.
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    let active = true
    api
      .get('/dashboard/docente')
      .then((res) => {
        if (active) setPanel(res.data)
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.message ?? 'No se pudo cargar tu panel')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  /**
   * Pasar lista necesita una sesión: si la clase ya está iniciada se reutiliza,
   * si no se abre en el momento con el horario de esa clase.
   */
  const pasarLista = useCallback(
    async (clase) => {
      if (!clase) return
      setErrorClase('')

      if (clase.sesion?.id) {
        navigate(`/docente/pasar-lista/${clase.sesion.id}`)
        return
      }

      setIniciando(true)
      try {
        const { data } = await api.post('/clases/iniciar', {
          horarioId: clase.horarioId,
        })
        navigate(`/docente/pasar-lista/${data.id}`)
      } catch (err) {
        setErrorClase(
          err.response?.data?.message ?? 'No se pudo iniciar la clase',
        )
      } finally {
        setIniciando(false)
      }
    },
    [navigate],
  )

  const claseDestacada = panel?.claseActual ?? panel?.proximaClase ?? null

  const materiasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const materias = panel?.materias ?? []
    if (!texto) return materias
    return materias.filter(
      (materia) =>
        materia.nombre.toLowerCase().includes(texto) ||
        materia.clave.toLowerCase().includes(texto) ||
        materia.grupos.some((grupo) => grupo.toLowerCase().includes(texto)),
    )
  }, [busqueda, panel?.materias])

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Cargando tu panel...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
        {error}
      </div>
    )
  }

  const pendientes = panel?.pendientes ?? {}
  const urgentes =
    (pendientes.alumnosEnRiesgo ?? 0) + (panel?.resumen?.listasPendientes ?? 0)

  return (
    <div className="space-y-5">
      <Encabezado
        nombre={user?.nombre?.split(' ')[0] ?? 'Docente'}
        fecha={ahora}
        resumen={panel?.resumen}
        urgentes={urgentes}
      />

      <PeriodoEscolarCard compacto />

      <ClaseDestacada
        clase={claseDestacada}
        ahora={ahora}
        iniciando={iniciando}
        error={errorClase}
        onPasarLista={pasarLista}
      />

      <AccesosRapidos
        claseActual={panel?.claseActual}
        onPasarLista={pasarLista}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <AgendaHoy
          clases={panel?.clasesHoy ?? []}
          iniciando={iniciando}
          onPasarLista={pasarLista}
        />
        <Pendientes pendientes={pendientes} />
      </section>

      <Materias
        materias={materiasFiltradas}
        total={panel?.materias?.length ?? 0}
        busqueda={busqueda}
        onBuscar={setBusqueda}
      />
    </div>
  )
}

function Encabezado({ nombre, fecha, resumen, urgentes }) {
  const clases = resumen?.clasesHoy ?? 0
  const listas = resumen?.listasPendientes ?? 0

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          Hola, {nombre}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fechaLarga(fecha)} · {clases} clase{clases === 1 ? '' : 's'} hoy
          {listas > 0 &&
            ` · ${listas} lista${listas === 1 ? '' : 's'} sin pasar`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {urgentes > 0 && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive-foreground">
            {urgentes} urgente{urgentes === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  )
}

function ClaseDestacada({
  clase,
  ahora,
  iniciando,
  error,
  onPasarLista,
}) {
  if (!clase) {
    return (
      <section className="rounded-2xl border border-border bg-card px-5 py-6 text-center">
        <p className="text-sm font-medium text-foreground">
          No tienes más clases hoy
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprovecha para revisar entregas o programar tus próximas sesiones.
        </p>
      </section>
    )
  }

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const restante = minutosDeHora(clase.horaFin) - minutosAhora
  const faltanParaEmpezar = minutosDeHora(clase.horaInicio) - minutosAhora
  const iniciada = Boolean(clase.sesion?.activa)
  const puedeRegistrar = ESTADOS_ABIERTOS.includes(clase.estado)

  let etiqueta = 'Siguiente clase'
  let tonoEtiqueta = 'bg-muted text-muted-foreground'
  if (iniciada) {
    etiqueta = 'Clase iniciada'
    tonoEtiqueta = "bg-success/15 text-success-foreground "
  } else if (clase.dentroDeHorario) {
    etiqueta = 'En curso'
    tonoEtiqueta = "bg-success/15 text-success-foreground "
  }

  let detalleTiempo = `${clase.horaInicio} – ${clase.horaFin}`
  if (clase.dentroDeHorario && restante > 0) {
    detalleTiempo = `termina en ${formatearDuracion(restante)} · ${detalleTiempo}`
  } else if (!clase.dentroDeHorario && faltanParaEmpezar > 0) {
    detalleTiempo = `empieza en ${formatearDuracion(faltanParaEmpezar)} · ${detalleTiempo}`
  }

  return (
    <section className="rounded-2xl border-2 border-primary/40 bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${tonoEtiqueta}`}
        >
          {etiqueta}
        </span>
        <span className="text-xs text-muted-foreground">{detalleTiempo}</span>
      </div>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {clase.materia?.nombre}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {clase.grupo?.nombre ?? 'Sin grupo'} ·{' '}
            {clase.aula?.nombre ?? 'Sin aula'}
            {clase.unidadActiva
              ? ` · ${clase.unidadActiva.nombre}`
              : ' · Sin unidad activa'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {puedeRegistrar && (
            <Button variant="default"
              type="button"
              onClick={() => onPasarLista(clase)}
              disabled={iniciando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              <ClipboardCheck className="h-4 w-4" />
              {iniciada ? 'Pasar lista' : 'Iniciar y pasar lista'}
            </Button>
          )}
          <Link
            to={`/materias/${clase.materiaId}`}
            className="inline-flex items-center rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Ver materia
          </Link>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </p>
      )}
    </section>
  )
}

function AccesosRapidos({ claseActual, onPasarLista }) {
  const navigate = useNavigate()

  const accesos = [
    {
      icono: ClipboardCheck,
      titulo: 'Pasar lista',
      detalle: claseActual
        ? claseActual.materia?.nombre
        : 'Sin clase en curso ahora',
      onClick: () =>
        claseActual ? onPasarLista(claseActual) : navigate('/asistencias'),
    },
    {
      icono: FilePlus2,
      titulo: 'Nueva tarea',
      detalle: 'Asignar a un grupo',
      onClick: () => navigate('/docente/tareas/crear'),
    },
    {
      icono: GraduationCap,
      titulo: 'Capturar calificaciones',
      onClick: () => navigate('/calificaciones'),
    },
    {
      icono: CalendarPlus,
      titulo: 'Programar clase',
      detalle: 'Horario y aula',
      onClick: () => navigate('/docente/horario/editar'),
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {accesos.map((acceso) => (
        <Button variant="outline"
          key={acceso.titulo}
          type="button"
          onClick={acceso.onClick}
          className="flex flex-col items-start gap-1.5 border p-4 text-left"
        >
          <acceso.icono className="h-5 w-5 text-primary-ink" />
          <span className="text-sm font-medium text-foreground">
            {acceso.titulo}
          </span>
          {acceso.detalle && (
            <span className="text-xs text-muted-foreground">
              {acceso.detalle}
            </span>
          )}
        </Button>
      ))}
    </section>
  )
}

function AgendaHoy({ clases, iniciando, onPasarLista }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Agenda de hoy</h2>
        <Link to="/docente/horario" className="text-xs text-primary-ink">
          Mi horario
        </Link>
      </div>

      {clases.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Hoy no tienes clases programadas.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {clases.map((clase) => (
            <li
              key={clase.horarioId}
              className="flex items-center gap-3 py-2.5"
            >
              <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">
                {clase.horaInicio}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {clase.materia?.nombre}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {clase.grupo?.nombre ?? 'Sin grupo'} ·{' '}
                  {clase.aula?.nombre ?? 'Sin aula'}
                </p>
              </div>
              <EstadoClase
                clase={clase}
                iniciando={iniciando}
                onPasarLista={onPasarLista}
              />
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function EstadoClase({ clase, iniciando, onPasarLista }) {
  if (clase.estado === 'FINALIZADA') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-success-foreground ">
        <Check className="h-3.5 w-3.5" />
        Registrada
      </span>
    )
  }

  if (ESTADOS_ABIERTOS.includes(clase.estado) || clase.estado === 'PASADA') {
    const atrasada = clase.estado === 'PASADA'
    return (
      <Button variant="ghost"
        type="button"
        onClick={() => onPasarLista(clase)}
        disabled={iniciando}
        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
          atrasada
            ? "bg-destructive/10 text-destructive-foreground hover:bg-destructive/20"
            : "bg-primary/10 text-primary-ink hover:bg-primary/20"
        }`}
      >
        {atrasada ? 'Sin registrar' : 'Pasar lista'}
      </Button>
    )
  }

  return (
    <span className="shrink-0 text-xs text-muted-foreground">Programada</span>
  )
}

function Pendientes({ pendientes }) {
  const filas = [
    {
      icono: AlertTriangle,
      tono: "text-destructive-foreground",
      texto: `${pendientes.alumnosEnRiesgo ?? 0} alumno${pendientes.alumnosEnRiesgo === 1 ? '' : 's'} en riesgo por inasistencias`,
      to: '/asistencias',
    },
    {
      icono: FileText,
      tono: "text-warning-foreground ",
      texto: `${pendientes.entregasSinCalificar ?? 0} entrega${pendientes.entregasSinCalificar === 1 ? '' : 's'} sin calificar`,
      to: '/tareas',
    },
    {
      icono: UserPlus,
      tono: "text-primary-ink",
      texto: `${pendientes.solicitudes ?? 0} solicitud${pendientes.solicitudes === 1 ? '' : 'es'} de inscripción`,
      to: '/docente/solicitudes',
    },
  ]

  const sinPendientes = filas.every((fila) => fila.texto.startsWith('0 '))

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">
        Requiere tu atención
      </h2>

      {sinPendientes ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Estás al día. No hay pendientes por revisar.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {filas.map((fila) => (
            <li key={fila.to}>
              <Link
                to={fila.to}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-muted/50"
              >
                <fila.icono className={`h-4 w-4 shrink-0 ${fila.tono}`} />
                <span className="min-w-0 flex-1 text-sm text-foreground">
                  {fila.texto}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function Materias({ materias, total, busqueda, onBuscar }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Mis materias{' '}
          <span className="font-normal text-muted-foreground">· {total}</span>
        </h2>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Buscar materia o grupo"
            type="search"
            value={busqueda}
            onChange={(event) => onBuscar(event.target.value)}
            placeholder="Buscar materia o grupo"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>

      {materias.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {total === 0
            ? 'Todavía no impartes materias en este periodo.'
            : 'Ninguna materia coincide con tu búsqueda.'}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {materias.map((materia) => (
            <li key={materia.id}>
              <Link
                to={`/materias/${materia.id}`}
                className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 transition hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {materia.nombre}
                  {materia.grupos.length > 0 && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {materia.grupos.join(', ')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {materia.porcentajeAsistencia === null
                    ? 'Sin registros'
                    : `${materia.porcentajeAsistencia}% asistencia`}
                </span>
                <EstadoMateria materia={materia} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function EstadoMateria({ materia }) {
  if (materia.alumnosEnRiesgo > 0) {
    return (
      <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive-foreground">
        {materia.alumnosEnRiesgo} en riesgo
      </span>
    )
  }

  if (materia.entregasSinCalificar > 0) {
    return (
      <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning-foreground ">
        {materia.entregasSinCalificar} por calificar
      </span>
    )
  }

  return (
    <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success-foreground ">
      Al día
    </span>
  )
}
