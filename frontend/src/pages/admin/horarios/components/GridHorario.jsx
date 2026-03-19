import { useState } from 'react'
import TarjetaMateria from './TarjetaMateria'
import { useHorarioStore } from '../../../../store/horarioStore'

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

export default function GridHorario({ onMateriaClick, onEdit, modo = 'docente' }) {
  const { docenteSeleccionado, grupoSeleccionado, horarios, eliminarHorario, saving } = useHorarioStore()
  const [detalle, setDetalle] = useState(null)

  function handleClick(horario) {
    setDetalle(horario)
    onMateriaClick?.(horario)
  }

  // Build a map: dia -> list of {horario, colorIndex, rowStart, rowSpan}
  const celdas = {}
  DIAS_LOWER.forEach((d) => (celdas[d] = []))

  horarios.forEach((horario, idx) => {
    const diasMateria = horario.dias.split(',').map((d) => d.trim().toLowerCase())
    const inicioMin = aMinutos(horario.horaInicio) - HORA_INICIO_GRID
    const finMin = aMinutos(horario.horaFin) - HORA_INICIO_GRID
    const rowStart = Math.floor(inicioMin / 60) + 1
    const rowSpan = Math.ceil((finMin - inicioMin) / 60)

    diasMateria.forEach((dia) => {
      const diaIdx = DIAS_LOWER.indexOf(dia)
      if (diaIdx !== -1) {
        celdas[DIAS_LOWER[diaIdx]].push({ horario, colorIndex: idx, rowStart, rowSpan })
      }
    })
  })

  const horasSemanales = horarios.reduce((acc, horario) => {
    const h = (aMinutos(horario.horaFin) - aMinutos(horario.horaInicio)) / 60
    const dias = horario.dias.split(',').length
    return acc + h * dias
  }, 0)

  const contextoSeleccionado = modo === 'grupo' ? grupoSeleccionado : docenteSeleccionado

  return (
    <div className="flex flex-col gap-4">
      {contextoSeleccionado && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {modo === 'grupo' ? contextoSeleccionado.nombre : contextoSeleccionado.nombre}
            </h2>
            <p className="text-sm text-slate-500">
              {modo === 'grupo'
                ? `${contextoSeleccionado.carrera?.nombre ?? 'Carrera'} · Sem ${contextoSeleccionado.semestre} · ${contextoSeleccionado.periodo}`
                : `${horarios.length} horario${horarios.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`}
            </p>
          </div>
        </div>
      )}

      {!contextoSeleccionado && (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          {modo === 'grupo' ? 'Selecciona un grupo para ver su horario' : 'Selecciona un docente para ver su horario'}
        </div>
      )}

      {contextoSeleccionado && (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[720px]"
            style={{ gridTemplateColumns: '64px repeat(6, 1fr)' }}
          >
            {/* Header */}
            <div className="text-xs text-slate-400 text-center py-1" />
            {DIAS.map((dia) => (
              <div key={dia} className="text-xs font-semibold text-center py-1 text-slate-600">
                {dia}
              </div>
            ))}

            {/* Rows */}
            {HORAS.map((hora, rowIdx) => (
              <div key={`fila-${hora}`} className="contents">
                {/* Hora label */}
                <div
                  key={`hora-${hora}`}
                  className="text-xs text-slate-400 text-right pr-2 pt-1 border-t border-slate-100"
                  style={{ gridRow: rowIdx + 1 }}
                >
                  {hora}
                </div>

                {/* Empty cells */}
                {DIAS_LOWER.map((dia) => (
                  <div
                    key={`${dia}-${hora}`}
                    className="border-t border-slate-100 min-h-[48px]"
                    style={{ gridRow: rowIdx + 1, gridColumn: DIAS_LOWER.indexOf(dia) + 2 }}
                  />
                ))}
              </div>
            ))}

            {/* Materia blocks */}
            {DIAS_LOWER.map((dia, diaIdx) =>
              celdas[dia].map(({ horario, colorIndex, rowStart, rowSpan }) => (
                <div
                  key={`${dia}-${horario.id}`}
                  style={{
                    gridColumn: diaIdx + 2,
                    gridRow: `${rowStart} / span ${rowSpan}`,
                    padding: '2px',
                  }}
                >
                  <TarjetaMateria
                    horario={horario}
                    colorIndex={colorIndex}
                    onClick={handleClick}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Detalle modal */}
      {detalle && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setDetalle(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-xl bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">{detalle.materia.nombre}</h3>
                <p className="text-xs text-slate-400">{detalle.materia.clave}</p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="text-sm space-y-1 text-slate-600">
              <p><span className="font-medium">Materia:</span> {detalle.materia.nombre}</p>
              <p><span className="font-medium">Clave:</span> {detalle.materia.clave}</p>
              <p><span className="font-medium">Docente:</span> {detalle.docente.nombre}</p>
              <p><span className="font-medium">Aula:</span> {detalle.aula?.nombre || 'Sin aula asignada'}</p>
              {detalle.grupo && <p><span className="font-medium">Grupo:</span> {detalle.grupo.nombre}</p>}
              <p><span className="font-medium">Días:</span> {detalle.dias}</p>
              <p><span className="font-medium">Horario:</span> {detalle.horaInicio} – {detalle.horaFin}</p>
              {detalle.materia.carrera && <p><span className="font-medium">Carrera:</span> {detalle.materia.carrera.nombre}</p>}
              {detalle.semestre && <p><span className="font-medium">Semestre:</span> {detalle.semestre}</p>}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  onEdit?.(detalle)
                  setDetalle(null)
                }}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Editar horario
              </button>
              <button
                onClick={async () => {
                  const ok = window.confirm(`¿Eliminar el horario de "${detalle.materia.nombre}"?`)
                  if (!ok) return
                  try {
                    await eliminarHorario(detalle.id)
                    setDetalle(null)
                  } catch {}
                }}
                disabled={saving}
                className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {saving ? 'Eliminando...' : 'Eliminar horario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
