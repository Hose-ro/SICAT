import { useEffect, useState } from 'react'
import { useAsistenciaStore } from '../../../store/asistenciaStore'

const ESTADOS = ['ASISTENCIA', 'RETARDO', 'FALTA', 'JUSTIFICADA']

const ESTADO_STYLES = {
  ASISTENCIA: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  RETARDO: 'border-amber-200 bg-amber-100 text-amber-800',
  FALTA: 'border-rose-200 bg-rose-100 text-rose-800',
  JUSTIFICADA: 'border-sky-200 bg-sky-100 text-sky-800',
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
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500">
        Selecciona una clase para abrir el pase de lista.
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Cargando sesión...
      </div>
    )
  }

  if (!sesion) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No se encontró la sesión seleccionada.
      </div>
    )
  }

  return (
    <section className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${compact ? 'p-5' : 'p-6'}`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {sesion.materia?.clave ?? 'Clase'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {sesion.activa ? 'Sesión activa' : 'Edición histórica'}
            </span>
            {sesion.fueFueraDeHorario && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                Fuera de horario
              </span>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {sesion.materia?.nombre}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {sesion.grupo?.nombre ?? 'Sin grupo'} · {sesion.aula?.nombre ?? 'Aula pendiente'} · {sesion.unidad?.nombre ?? `Unidad ${sesion.unidad?.orden ?? ''}`}
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
            <p>Fecha: {formatDate(sesion.fecha)}</p>
            <p>Inicio: {formatDateTime(sesion.horaInicio)}</p>
            <p>Semana: {sesion.semanaClave}</p>
            <p>Cierre: {sesion.horaFin ? formatDateTime(sesion.horaFin) : 'Clase en curso'}</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cerrar
          </button>
        )}
      </div>

      {sesion.fueFueraDeHorario && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta sesión se inició fuera del horario programado. La lista se puede capturar y editar, pero no se muestra como clase en línea para el alumno.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">A {conteos.ASISTENCIA}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">R {conteos.RETARDO}</span>
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">F {conteos.FALTA}</span>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">J {conteos.JUSTIFICADA}</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={marcarTodosPresentes}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Marcar todos presentes
          </button>

          {alumnosDisponibles.length > 0 && (
            <div className="flex gap-2">
              <select
                value={alumnoManualId}
                onChange={(event) => setAlumnoManualId(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <option value="">Agregar alumno manualmente</option>
                {alumnosDisponibles.map((alumno) => (
                  <option key={alumno.id} value={alumno.id}>
                    {alumno.nombre} {alumno.numeroControl ? `· ${alumno.numeroControl}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={agregarAlumnoManual}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Agregar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Alumno</span>
          <span>Control</span>
          <span>Estado</span>
        </div>

        <div className="divide-y divide-slate-100">
          {alumnos.map((alumno) => (
            <div key={alumno.alumnoId} className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{alumno.nombre}</p>
                {alumno.manual && (
                  <p className="mt-1 text-xs text-amber-700">Agregado manualmente</p>
                )}
              </div>
              <p className="truncate text-sm text-slate-500">{alumno.numeroControl || 'Sin control'}</p>
              <div className="flex flex-wrap gap-2">
                {ESTADOS.map((estado) => {
                  const active = registros[alumno.alumnoId] === estado
                  return (
                    <button
                      key={estado}
                      type="button"
                      onClick={() => setEstado(alumno.alumnoId, estado)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? ESTADO_STYLES[estado]
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {estado === 'ASISTENCIA' ? 'Asistencia' : estado === 'RETARDO' ? 'Retardo' : estado === 'FALTA' ? 'Falta' : 'Justificado'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-500">
          Si un alumno queda sin marcar, se guardará como falta en esta captura.
        </p>

        <button
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : 'Guardar asistencia'}
        </button>
      </div>

      {feedback && (
        <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {feedback}
        </div>
      )}
    </section>
  )
}
