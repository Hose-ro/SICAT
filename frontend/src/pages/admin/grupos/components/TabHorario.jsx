import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGrupoStore } from '../../../../store/grupoStore'

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const DIAS_LOWER = DIAS.map((d) => d.toLowerCase())

function generarHoras(inicio = 7, fin = 22) {
  const horas = []
  for (let h = inicio; h < fin; h++) {
    horas.push(`${String(h).padStart(2, '0')}:00`)
  }
  return horas
}

function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

const HORAS = generarHoras(7, 22)
const HORA_INICIO_GRID = 7 * 60

const COLORES = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-emerald-100 border-emerald-300 text-emerald-800',
  'bg-violet-100 border-violet-300 text-violet-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-rose-100 border-rose-300 text-rose-800',
  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'bg-orange-100 border-orange-300 text-orange-800',
  'bg-teal-100 border-teal-300 text-teal-800',
]

function etiquetaAula(aula) {
  if (!aula) return 'Sin aula'
  return aula.edificio ? `${aula.nombre} · ${aula.edificio}` : aula.nombre
}

export default function TabHorario({ grupo }) {
  const { cargarHorario, cargarAulas, asignarAula, seleccionarGrupo, aulas } = useGrupoStore()
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [aulaMasiva, setAulaMasiva] = useState('')
  const [guardando, setGuardando] = useState(null)
  const [aviso, setAviso] = useState('')
  const [errorAula, setErrorAula] = useState('')

  useEffect(() => {
    cargarAulas()
  }, [cargarAulas])

  useEffect(() => {
    let activo = true

    async function cargar() {
      if (!grupo?.id) {
        if (activo) {
          setHorarios([])
          setLoading(false)
          setError('')
        }
        return
      }

      setLoading(true)
      setError('')

      const respuesta = await cargarHorario(grupo.id)

      if (!activo) return

      if (!respuesta || !Array.isArray(respuesta.horarios)) {
        setHorarios([])
        setLoading(false)
        setError('No se pudo cargar el horario del grupo')
        return
      }

      setHorarios(respuesta.horarios)
      setLoading(false)
    }

    cargar()
    return () => {
      activo = false
    }
  }, [grupo?.id, cargarHorario])

  const aplicarAula = useCallback(
    async (aulaId, horarioId, mensajeExito) => {
      setErrorAula('')
      setAviso('')
      setGuardando(horarioId ?? 'todas')
      try {
        const respuesta = await asignarAula(grupo.id, aulaId, horarioId)
        if (Array.isArray(respuesta?.horarios)) setHorarios(respuesta.horarios)
        await seleccionarGrupo(grupo.id)
        setAviso(mensajeExito)
      } catch (e) {
        setErrorAula(e.message)
      } finally {
        setGuardando(null)
      }
    },
    [asignarAula, seleccionarGrupo, grupo?.id],
  )

  const resumenAulas = useMemo(() => {
    const nombres = new Set(
      horarios.filter((h) => h.aula).map((h) => h.aula.nombre),
    )
    const sinAula = horarios.filter((h) => !h.aula).length
    return { nombres: [...nombres], sinAula }
  }, [horarios])

  const celdas = useMemo(() => {
    const resultado = {}
    DIAS_LOWER.forEach((dia) => {
      resultado[dia] = []
    })

    const colorPorMateria = new Map()

    horarios.forEach((horario) => {
      if (!horario?.dias || !horario?.horaInicio || !horario?.horaFin) return

      if (!colorPorMateria.has(horario.materiaId)) {
        colorPorMateria.set(horario.materiaId, colorPorMateria.size % COLORES.length)
      }

      const diasHorario = horario.dias.split(',').map((dia) => dia.trim().toLowerCase())
      const inicioMin = aMinutos(horario.horaInicio) - HORA_INICIO_GRID
      const finMin = aMinutos(horario.horaFin) - HORA_INICIO_GRID
      const rowStart = Math.floor(inicioMin / 60) + 1
      const rowSpan = Math.max(1, Math.ceil((finMin - inicioMin) / 60))
      const colorIndex = colorPorMateria.get(horario.materiaId) ?? 0

      diasHorario.forEach((dia) => {
        const diaIdx = DIAS_LOWER.indexOf(dia)
        if (diaIdx !== -1) {
          resultado[DIAS_LOWER[diaIdx]].push({
            horario,
            colorIndex,
            rowStart,
            rowSpan,
          })
        }
      })
    })

    DIAS_LOWER.forEach((dia) => {
      resultado[dia].sort((a, b) => {
        if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart
        return a.horario.horaInicio.localeCompare(b.horario.horaInicio)
      })
    })

    return resultado
  }, [horarios])

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">Cargando horario...</p>
  }

  if (error) {
    return <p className="text-sm text-red-500 py-8 text-center">{error}</p>
  }

  if (horarios.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-400">No hay bloques de horario asignados</p>
        <p className="mt-1 text-xs text-gray-400">
          Programa el horario del grupo en Horarios para poder asignarle un aula.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-gray-800">Aula del grupo</h2>
          <p className="text-xs text-gray-500">
            Asigna una misma aula a todas las clases del horario, o define un aula distinta
            por clase en la lista de abajo.
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={aulaMasiva}
            onChange={(e) => setAulaMasiva(e.target.value)}
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona un aula</option>
            {aulas.map((aula) => (
              <option key={aula.id} value={aula.id}>
                {etiquetaAula(aula)}
                {aula.capacidad ? ` · ${aula.capacidad} lugares` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              aplicarAula(
                Number(aulaMasiva),
                undefined,
                'Aula aplicada a todas las clases del grupo.',
              )
            }
            disabled={!aulaMasiva || guardando !== null}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando === 'todas' ? 'Aplicando...' : 'Aplicar a todas las clases'}
          </button>
          <button
            onClick={() =>
              aplicarAula(null, undefined, 'Se quitó el aula de todas las clases del grupo.')
            }
            disabled={guardando !== null || resumenAulas.nombres.length === 0}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Quitar aula
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {resumenAulas.nombres.length === 0
            ? 'Ninguna clase tiene aula asignada.'
            : resumenAulas.nombres.length === 1 && resumenAulas.sinAula === 0
              ? `Todas las clases se imparten en ${resumenAulas.nombres[0]}.`
              : `El horario usa ${resumenAulas.nombres.length} aula${resumenAulas.nombres.length === 1 ? '' : 's'}` +
                (resumenAulas.sinAula > 0
                  ? ` y ${resumenAulas.sinAula} clase${resumenAulas.sinAula === 1 ? '' : 's'} sin aula.`
                  : '.')}
        </p>

        {aviso && (
          <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">{aviso}</p>
        )}
        {errorAula && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{errorAula}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">Aula por clase</h2>
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
          {horarios.map((horario) => (
            <li
              key={horario.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {horario.materia?.nombre}
                </p>
                <p className="text-xs text-gray-500">
                  {horario.dias} · {horario.horaInicio}–{horario.horaFin}
                  {horario.docente ? ` · ${horario.docente.nombre}` : ''}
                </p>
              </div>
              <select
                value={horario.aulaId ?? ''}
                onChange={(e) =>
                  aplicarAula(
                    e.target.value ? Number(e.target.value) : null,
                    horario.id,
                    `Aula actualizada para ${horario.materia?.nombre}.`,
                  )
                }
                disabled={guardando !== null}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 sm:w-64"
              >
                <option value="">Sin aula</option>
                {aulas.map((aula) => (
                  <option key={aula.id} value={aula.id}>
                    {etiquetaAula(aula)}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[720px]"
          style={{ gridTemplateColumns: `60px repeat(${DIAS.length}, 1fr)` }}
        >
          <div />
          {DIAS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-2">
              {d}
            </div>
          ))}

          {HORAS.map((hora, rowIdx) => (
            <div key={`fila-${hora}`} className="contents">
              <div
                className="text-right pr-2 text-xs text-gray-400"
                style={{ gridRow: rowIdx + 1, gridColumn: 1 }}
              >
                {hora}
              </div>

              {DIAS.map((dia) => (
                <div
                  key={`${dia}-${hora}`}
                  className="border-t border-l border-gray-100"
                  style={{ gridRow: rowIdx + 1, gridColumn: DIAS.indexOf(dia) + 2, minHeight: 48 }}
                />
              ))}
            </div>
          ))}

          {DIAS_LOWER.map((dia, diaIdx) =>
            celdas[dia].map(({ horario, colorIndex, rowStart, rowSpan }) => (
              <div
                key={`${dia}-${horario.id}`}
                className={`m-0.5 rounded-lg border p-1.5 text-xs overflow-hidden ${COLORES[colorIndex]}`}
                style={{
                  gridColumn: diaIdx + 2,
                  gridRow: `${rowStart} / span ${rowSpan}`,
                }}
              >
                <p className="font-semibold truncate">{horario.materia?.nombre}</p>
                {horario.docente && (
                  <p className="truncate opacity-80">{horario.docente.nombre}</p>
                )}
                <p className="truncate opacity-70">
                  {horario.aula ? horario.aula.nombre : 'Sin aula'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
