import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import UnidadesCard from './materia/UnidadesCard'
import AlumnosMateriaCard from './materia/AlumnosMateriaCard'
import AvisosMateriaCard from './materia/AvisosMateriaCard'
import TemarioCard from './materia/TemarioCard'

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function MateriaDetalle() {
  const { id } = useParams()
  // Una materia puede darse a varios grupos: ?grupo= deja ver sólo uno, sin
  // revolver alumnos, sesiones ni avisos de los demás.
  const [searchParams, setSearchParams] = useSearchParams()
  const grupoParam = Number(searchParams.get('grupo')) || null
  const { user } = useAuthStore()
  // El backend ya limita al docente a las materias que imparte: si abrió la
  // página, la materia es suya.
  const puedeGestionar = user?.rol === 'ADMIN' || user?.rol === 'DOCENTE'
  const [materia, setMateria] = useState(null)
  const [historial, setHistorial] = useState([])
  const [tareas, setTareas] = useState([])
  const [estadisticas, setEstadisticas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function cargarDetalle() {
      setLoading(true)
      setError('')

      try {
        const [materiaRes, tareasRes] = await Promise.all([
          api.get(`/materias/${id}`),
          api.get(`/tareas/materia/${id}`),
        ])

        if (!active) return

        setMateria(materiaRes.data)
        setTareas(tareasRes.data ?? [])
      } catch (err) {
        if (!active) return
        setError(err.response?.data?.message ?? 'No se pudo cargar la materia')
      } finally {
        if (active) setLoading(false)
      }
    }

    cargarDetalle()
    return () => {
      active = false
    }
  }, [id])

  const grupos = useMemo(
    () => [...(materia?.grupos ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [materia?.grupos],
  )
  // Un ?grupo= que no es de la materia se ignora: se ve la materia completa.
  const grupo = grupos.find((item) => item.id === grupoParam) ?? null
  const grupoId = grupo?.id ?? null

  // Las sesiones se piden aparte para que cambiar de grupo no recargue la página.
  const materiaCargada = Boolean(materia)
  useEffect(() => {
    if (!materiaCargada) return undefined
    let active = true
    api
      .get('/asistencias/historial', {
        params: { materiaId: id, ...(grupoId ? { grupoId } : {}) },
      })
      .then((res) => {
        if (!active) return
        setHistorial(res.data?.items ?? [])
        setEstadisticas(res.data?.estadisticas ?? null)
      })
      .catch(() => {
        if (!active) return
        setHistorial([])
        setEstadisticas(null)
      })
    return () => {
      active = false
    }
  }, [id, grupoId, materiaCargada])

  /** Tras cambiar unidades o el padrón basta con releer la materia. */
  const recargarMateria = useCallback(async () => {
    const { data } = await api.get(`/materias/${id}`)
    setMateria(data)
  }, [id])

  /** La materia vista desde el grupo elegido: padrón y grupos de ese grupo. */
  const materiaDelGrupo = useMemo(() => {
    if (!materia || !grupo) return materia
    return {
      ...materia,
      grupos: [grupo],
      inscripciones: (materia.inscripciones ?? []).filter((inscripcion) => inscripcion.grupoId === grupo.id),
    }
  }, [grupo, materia])

  // Una tarea sin grupo es para toda la materia: se ve en cada grupo.
  const tareasDelGrupo = useMemo(
    () => (grupo ? tareas.filter((tarea) => !tarea.grupoId || tarea.grupoId === grupo.id) : tareas),
    [grupo, tareas],
  )

  const elegirGrupo = (grupoId) => {
    const siguiente = new URLSearchParams(searchParams)
    if (grupoId) siguiente.set('grupo', String(grupoId))
    else siguiente.delete('grupo')
    setSearchParams(siguiente, { replace: true })
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Cargando materia...</div>
  }

  if (error || !materia) {
    return <div className="py-16 text-center text-sm text-destructive-foreground">{error || 'Materia no encontrada'}</div>
  }

  const esDocente = user?.rol === 'DOCENTE'
  // Los enlaces llevan la materia y el grupo: la otra pantalla abre ya filtrada.
  const contexto = `materia=${materia.id}${grupo ? `&grupo=${grupo.id}` : ''}`
  const alumnosActivos = materiaDelGrupo?.inscripciones?.length ?? 0
  const resumen = [
    plural(alumnosActivos, 'alumno', 'alumnos'),
    plural(materiaDelGrupo?.unidades?.length ?? 0, 'unidad', 'unidades'),
    plural(historial.length, 'clase registrada', 'clases registradas'),
    estadisticas?.porcentaje != null && historial.length ? `${estadisticas.porcentaje} % de asistencia` : null,
  ].filter(Boolean).join(' · ')
  const enlace = 'inline-flex min-h-9 items-center rounded-[10px] border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted'

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {grupo ? `${materia.nombre} · ${grupo.nombre}` : materia.nombre}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {[materia.clave, materia.carrera?.nombre, materia.semestre ? `Semestre ${materia.semestre}` : null, esDocente ? null : materia.docente?.nombre ? `Docente: ${materia.docente.nombre}` : 'Docente pendiente'].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{resumen}</p>
        </div>
        <nav aria-label="Ir con esta materia" className="flex flex-wrap gap-2">
          <Link to={`/asistencias?${contexto}`} className={enlace}>Asistencias</Link>
          <Link to={`/tareas?${contexto}`} className={enlace}>Tareas</Link>
          <Link to={`/calificaciones?${contexto}`} className={enlace}>Calificaciones</Link>
          <Link to={`/calificaciones/cierre?${contexto}`} className={enlace}>Cierre de curso</Link>
        </nav>
      </header>

      {grupos.length > 1 && (
        <nav aria-label="Grupo" className="flex flex-wrap gap-2">
          {[{ id: null, nombre: 'Todos los grupos' }, ...grupos].map((item) => {
            const activo = (grupo?.id ?? null) === item.id
            return (
              <button
                key={item.id ?? 'todos'}
                type="button"
                aria-pressed={activo}
                onClick={() => elegirGrupo(item.id)}
                className={`min-h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
                  activo
                    ? 'border-primary/30 bg-accent text-primary-ink'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
              >
                {item.nombre}
              </button>
            )
          })}
        </nav>
      )}

      {puedeGestionar && <AvisosMateriaCard key={grupo?.id ?? 'todos'} materia={materiaDelGrupo} />}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <UnidadesCard
          materia={materiaDelGrupo}
          puedeEditar={puedeGestionar}
          onActualizado={recargarMateria}
        />
        <AlumnosMateriaCard
          key={grupo?.id ?? 'todos'}
          materia={materiaDelGrupo}
          puedeEditar={puedeGestionar}
          onActualizado={recargarMateria}
        />
      </section>

      <TemarioCard key={`temario-${grupo?.id ?? 'todos'}`} materia={materia} grupo={grupo} puedeEditar={puedeGestionar} />

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="min-w-0 rounded-[var(--radius-card)] border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold text-foreground">Clases recientes</h2>
            {estadisticas && historial.length > 0 && (
              <p className="text-xs tabular-nums text-muted-foreground">
                {estadisticas.asistencias ?? 0} asistencias · {estadisticas.retardos ?? 0} retardos · {estadisticas.faltas ?? 0} faltas · {estadisticas.justificados ?? 0} justificados
              </p>
            )}
          </div>
          {historial.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Todavía no hay clases registradas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {historial.slice(0, 8).map((sesion) => (
                <li key={sesion.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{formatDate(sesion.fecha)} · {sesion.unidad?.nombre ?? 'Sin unidad'}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {grupo ? '' : `${sesion.grupo?.nombre ?? 'Sin grupo'} · `}
                      {sesion.resumen?.asistencias ?? 0} A · {sesion.resumen?.retardos ?? 0} R · {sesion.resumen?.faltas ?? 0} F
                    </p>
                  </div>
                  {esDocente && (
                    <Link to={`/docente/pasar-lista/${sesion.id}`} className="text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
                      Editar lista
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {historial.length > 8 && (
            <Link to={`/asistencias?${contexto}`} className="mt-2 inline-block text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
              Ver las {historial.length} en Asistencias
            </Link>
          )}
        </article>

        <article className="min-w-0 rounded-[var(--radius-card)] border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Tareas recientes</h2>
            {esDocente && (
              <Link to={`/docente/tareas/crear?materiaId=${materia.id}${grupo ? `&grupoId=${grupo.id}` : ''}`}
                className="text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
                Nueva tarea
              </Link>
            )}
          </div>
          {tareasDelGrupo.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Todavía no hay tareas para {grupo ? 'este grupo' : 'esta materia'}.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {tareasDelGrupo.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <Link to={`/docente/tareas/${item.id}`} className="-mx-2 flex flex-col rounded-[10px] px-2 py-3 transition-colors hover:bg-muted/60">
                    <span className="text-sm font-medium text-foreground">{item.titulo}</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {item.unidadRef?.nombre ?? 'Sin unidad'} · {item.tieneFechaLimite ? `Límite ${formatDate(item.fechaLimite)}` : 'Sin límite'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {tareasDelGrupo.length > 8 && (
            <Link to={`/tareas?${contexto}`} className="mt-2 inline-block text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
              Ver las {tareasDelGrupo.length} en Tareas
            </Link>
          )}
        </article>
      </section>
    </div>
  )
}
