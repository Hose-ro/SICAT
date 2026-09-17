import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useAsistenciaStore } from '../../../store/asistenciaStore'

const ESTADOS = ['ASISTENCIA', 'RETARDO', 'FALTA', 'JUSTIFICADA']

const ESTADO_STYLES = {
  ASISTENCIA: "border-success/30 bg-success/10 text-success-foreground",
  RETARDO: "border-warning/30 bg-warning/10 text-warning-foreground",
  FALTA: "border-destructive/30 bg-destructive/10 text-destructive-foreground",
  JUSTIFICADA: "border-border bg-accent text-primary-ink",
}

function formatDateTime(value) {
  if (!value) return 'Sin definir'
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDate(value) {
  if (!value) return 'Sin definir'
  return new Date(value).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
  })
}

export default function AsistenciaSesionPanel({
  sesionId,
  onClose,
  onSaved,
  compact = false,
}) {
  const { obtenerListaSesion, pasarLista } = useAsistenciaStore()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [sesion, setSesion] = useState(null)
  const [alumnos, setAlumnos] = useState([])
  const [alumnosDisponibles, setAlumnosDisponibles] = useState([])
  const [registros, setRegistros] = useState({})
  const [alumnoManualId, setAlumnoManualId] = useState('')

  useEffect(() => {
    if (!sesionId) return undefined

    let mounted = true
    setCargando(true)
    setFeedback('')

    obtenerListaSesion(sesionId)
      .then((data) => {
        if (!mounted) return
        setSesion(data.sesion)
        setAlumnos(data.alumnos)
        setAlumnosDisponibles(data.alumnosDisponiblesAgregar ?? [])
        const initialRegistros = {}
        data.alumnos.forEach((alumno) => {
          if (alumno.estado) initialRegistros[alumno.alumnoId] = alumno.estado
        })
        setRegistros(initialRegistros)
      })
      .finally(() => {
        if (mounted) setCargando(false)
      })

    return () => { mounted = false }
  }, [sesionId, obtenerListaSesion])

  const conteos = {
    ASISTENCIA: 0,
    RETARDO: 0,
    FALTA: 0,
    JUSTIFICADA: 0,
  }

  alumnos.forEach((alumno) => {
    const estado = registros[alumno.alumnoId]
    if (estado && conteos[estado] !== undefined) conteos[estado] += 1
  })

  const setEstado = (alumnoId, estado) => {
    setRegistros((prev) => ({ ...prev, [alumnoId]: estado }))
  }

  const marcarTodosPresentes = () => {
    const nuevos = {}
    alumnos.forEach((alumno) => {
      nuevos[alumno.alumnoId] = 'ASISTENCIA'
    })
    setRegistros(nuevos)
  }

  const agregarAlumnoManual = () => {
    if (!alumnoManualId) return
    const alumno = alumnosDisponibles.find((item) => String(item.id) === alumnoManualId)
    if (!alumno) return

    setAlumnos((prev) => [
      ...prev,
      {
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        numeroControl: alumno.numeroControl,
        estado: null,
        manual: true,
        asistenciaId: null,
      },
    ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))

    setAlumnosDisponibles((prev) => prev.filter((item) => item.id !== alumno.id))
    setAlumnoManualId('')
  }

  const handleGuardar = async () => {
    setGuardando(true)
    setFeedback('')
    try {
      const payload = alumnos.map((alumno) => ({
        alumnoId: alumno.alumnoId,
        estado: registros[alumno.alumnoId] || 'FALTA',
      }))
      const nextRegistros = {}
      payload.forEach((item) => {
        nextRegistros[item.alumnoId] = item.estado
      })
      setRegistros(nextRegistros)
      const result = await pasarLista(sesionId, payload)
      setFeedback(
        `Guardado: ${result.asistencias} asistencias, ${result.retardos} retardos, ${result.faltas} faltas, ${result.justificados} justificados.`,
      )
      if (onSaved) onSaved(result)
    } catch (error) {
      setFeedback(error.response?.data?.message || 'No se pudo guardar la asistencia.')
    } finally {
      setGuardando(false)
    }
  }

  if (!sesionId) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
        Selecciona una clase para abrir el pase de lista.
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Cargando sesión...
      </div>
    )
  }

  if (!sesion) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No se encontró la sesión seleccionada.
      </div>
    )
  }

  return (
    <section className={`rounded-3xl border border-border bg-card shadow-sm ${compact ? 'p-5' : 'p-6'}`}>
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              {sesion.materia?.clave ?? 'Clase'}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {sesion.activa ? 'Sesión activa' : 'Edición histórica'}
            </span>
            {sesion.fueFueraDeHorario && (
              <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning-foreground">
                Fuera de horario
              </span>
            )}
            {sesion.registroAtrasado && (
              <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning-foreground">
                Asistencia atrasada
              </span>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {sesion.materia?.nombre}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {sesion.grupo?.nombre ?? 'Sin grupo'} · {sesion.aula?.nombre ?? 'Aula pendiente'} · {sesion.unidad?.nombre ?? `Unidad ${sesion.unidad?.orden ?? ''}`}
            </p>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Fecha: {formatDate(sesion.fecha)}</p>
            <p>Inicio: {formatDateTime(sesion.horaInicio)}</p>
            <p>Semana: {sesion.semanaClave}</p>
            <p>Cierre: {sesion.horaFin ? formatDateTime(sesion.horaFin) : 'Clase en curso'}</p>
          </div>
        </div>

        {onClose && (
          <Button variant="outline"
            type="button"
            onClick={onClose}
            className="self-start border px-3 py-2 text-sm font-medium"
          >
            Cerrar
          </Button>
        )}
      </div>

      {sesion.fueFueraDeHorario && (
        <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Esta sesión se inició fuera del horario programado. La lista se puede capturar y editar, pero no se muestra como clase en línea para el alumno.
        </div>
      )}

      {sesion.registroAtrasado && (
        <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Esta clase se registró después de ocurrir. La asistencia queda guardada con la fecha y el horario reales de la clase.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-success/10 px-3 py-1 text-success-foreground">A {conteos.ASISTENCIA}</span>
          <span className="rounded-full bg-warning/10 px-3 py-1 text-warning-foreground">R {conteos.RETARDO}</span>
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive-foreground">F {conteos.FALTA}</span>
          <span className="rounded-full bg-accent px-3 py-1 text-primary-ink">J {conteos.JUSTIFICADA}</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost"
            type="button"
            onClick={marcarTodosPresentes}
            className="bg-success px-4 py-2 text-sm font-medium text-success-on-fill  hover:bg-success"
          >
            Marcar todos presentes
          </Button>

          {alumnosDisponibles.length > 0 && (
            <div className="flex gap-2">
              <select aria-label="Alumno para agregar manualmente"
                value={alumnoManualId}
                onChange={(event) => setAlumnoManualId(event.target.value)}
                className="rounded-xl border border-border px-3 py-2 text-sm text-foreground"
              >
                <option value="">Agregar alumno manualmente</option>
                {alumnosDisponibles.map((alumno) => (
                  <option key={alumno.id} value={alumno.id}>
                    {alumno.nombre} {alumno.numeroControl ? `· ${alumno.numeroControl}` : ''}
                  </option>
                ))}
              </select>
              <Button variant="outline"
                type="button"
                onClick={agregarAlumnoManual}
                className="border px-3 py-2 text-sm font-medium"
              >
                Agregar
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        {/* Phone layout stacks each student as a card: the three-column grid
            only has room once the 44px state pills fit beside the name. */}
        <div className="hidden gap-3 bg-background px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,1.5fr)]">
          <span>Alumno</span>
          <span>Control</span>
          <span>Estado</span>
        </div>

        <div className="divide-y divide-border">
          {alumnos.map((alumno) => (
            <div key={alumno.alumnoId} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] sm:gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{alumno.nombre}</p>
                <p className="text-xs text-muted-foreground sm:hidden">{alumno.numeroControl || 'Sin control'}</p>
                {alumno.manual && (
                  <p className="mt-1 text-xs text-warning-foreground">Agregado manualmente</p>
                )}
              </div>
              <p className="hidden truncate text-sm text-muted-foreground sm:block">{alumno.numeroControl || 'Sin control'}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Estado de ${alumno.nombre}`}>
                {ESTADOS.map((estado) => {
                  const active = registros[alumno.alumnoId] === estado
                  return (
                    <Button variant="ghost"
                      key={estado}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setEstado(alumno.alumnoId, estado)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? ESTADO_STYLES[estado]
                          : "border-border bg-card text-muted-foreground hover:bg-background"
                      }`}
                    >
                      {estado === 'ASISTENCIA' ? 'Asistencia' : estado === 'RETARDO' ? 'Retardo' : estado === 'FALTA' ? 'Falta' : 'Justificado'}
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          Si un alumno queda sin marcar, se guardará como falta en esta captura.
        </p>

        <Button variant="default"
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          className="px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : 'Guardar asistencia'}
        </Button>
      </div>

      {feedback && (
        <div className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}
    </section>
  )
}
