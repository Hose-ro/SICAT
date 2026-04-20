import { useEffect, useMemo, useState } from 'react'
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

export default function TabHorario({ grupo }) {
  const { cargarHorario } = useGrupoStore()
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    return <p className="text-sm text-gray-400 py-8 text-center">No hay bloques de horario asignados</p>
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: `60px repeat(${DIAS.length}, 1fr)` }}
      >
        {/* Header */}
        <div />
        {DIAS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-2">
            {d}
          </div>
        ))}

        {/* Body */}
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

        {/* Horarios */}
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
              {horario.aula && (
                <p className="truncate opacity-70">{horario.aula.nombre}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
