import { useState } from 'react'
import TarjetaMateria, { colorParaMateria } from './TarjetaMateria'
import SelectorAula from './SelectorAula'
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

export default function GridHorario({ onMateriaClick, modo = 'docente' }) {
  const { docenteSeleccionado, grupoSeleccionado, materias, quitarDocente } = useHorarioStore()
  const [detalle, setDetalle] = useState(null)

  function handleClick(materia) {
    setDetalle(materia)
    onMateriaClick?.(materia)
  }

  // Build a map: dia -> list of {materia, colorIndex, rowStart, rowSpan}
  const celdas = {}
  DIAS_LOWER.forEach((d) => (celdas[d] = []))

  materias.forEach((materia, idx) => {
    const diasMateria = materia.dias.split(',').map((d) => d.trim().toLowerCase())
    const inicioMin = aMinutos(materia.horaInicio) - HORA_INICIO_GRID
    const finMin = aMinutos(materia.horaFin) - HORA_INICIO_GRID
    const rowStart = Math.floor(inicioMin / 60) + 1
    const rowSpan = Math.ceil((finMin - inicioMin) / 60)

    diasMateria.forEach((dia) => {
      const diaIdx = DIAS_LOWER.indexOf(dia)
      if (diaIdx !== -1) {
        celdas[DIAS_LOWER[diaIdx]].push({ materia, colorIndex: idx, rowStart, rowSpan })
      }
    })
  })

  const horasSemanales = materias.reduce((acc, m) => {
    const h = (aMinutos(m.horaFin) - aMinutos(m.horaInicio)) / 60
    const dias = m.dias.split(',').length
    return acc + h * dias
  }, 0)

  const contextoSeleccionado = modo === 'grupo' ? grupoSeleccionado : docenteSeleccionado

  return (
    <div className="flex flex-col gap-4">
      {contextoSeleccionado && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {modo === 'grupo' ? contextoSeleccionado.nombre : contextoSeleccionado.nombre}
            </h2>
            <p className="text-sm text-slate-500">
              {modo === 'grupo'
                ? `${contextoSeleccionado.carrera?.nombre ?? 'Carrera'} · Sem ${contextoSeleccionado.semestre} · ${contextoSeleccionado.periodo}`
                : `${materias.length} materia${materias.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`}
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
            className="grid min-w-[640px]"
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
              <>
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
              </>
            ))}

            {/* Materia blocks */}
            {DIAS_LOWER.map((dia, diaIdx) =>
              celdas[dia].map(({ materia, colorIndex, rowStart, rowSpan }) => (
                <div
                  key={`${dia}-${materia.id}`}
                  style={{
                    gridColumn: diaIdx + 2,
                    gridRow: `${rowStart} / span ${rowSpan}`,
                    padding: '2px',
                  }}
                >
                  <TarjetaMateria
                    materia={materia}
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
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">{detalle.nombre}</h3>
                <p className="text-xs text-slate-400">{detalle.clave}</p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="text-sm space-y-1 text-slate-600">
              <p><span className="font-medium">Días:</span> {detalle.dias}</p>
              <p><span className="font-medium">Horario:</span> {detalle.horaInicio} – {detalle.horaFin}</p>
              {detalle.carrera && <p><span className="font-medium">Carrera:</span> {detalle.carrera.nombre}</p>}
              {detalle.semestre && <p><span className="font-medium">Semestre:</span> {detalle.semestre}</p>}
            </div>

            <SelectorAula materia={detalle} onClose={() => setDetalle(null)} />

            <button
              onClick={async () => {
                await quitarDocente(detalle.id)
                setDetalle(null)
              }}
              className="w-full text-sm text-red-600 hover:underline text-left mt-1"
            >
              Quitar docente de esta materia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
