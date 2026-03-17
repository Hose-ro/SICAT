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
  const materias = grupo?.materias ?? []

  if (materias.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No hay materias con horario asignado</p>
  }

  // Build a map: dia -> list of celdas
  const celdas = {}
  DIAS_LOWER.forEach((d) => (celdas[d] = []))

  materias.forEach((materia, idx) => {
    if (!materia.dias || !materia.horaInicio || !materia.horaFin) return
    const diasMateria = materia.dias.split(',').map((d) => d.trim().toLowerCase())
    const inicioMin = aMinutos(materia.horaInicio) - HORA_INICIO_GRID
    const finMin = aMinutos(materia.horaFin) - HORA_INICIO_GRID
    const rowStart = Math.floor(inicioMin / 60) + 1
    const rowSpan = Math.max(1, Math.ceil((finMin - inicioMin) / 60))

    diasMateria.forEach((dia) => {
      const diaIdx = DIAS_LOWER.indexOf(dia)
      if (diaIdx !== -1) {
        celdas[DIAS_LOWER[diaIdx]].push({ materia, colorIndex: idx % COLORES.length, rowStart, rowSpan })
      }
    })
  })

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px]"
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
          <>
            {/* Hora label */}
            <div
              key={`hora-${hora}`}
              className="text-right pr-2 text-xs text-gray-400"
              style={{ gridRow: rowIdx + 1, gridColumn: 1 }}
            >
              {hora}
            </div>

            {/* Empty cells */}
            {DIAS.map((d) => (
              <div
                key={`${d}-${hora}`}
                className="border-t border-l border-gray-100"
                style={{ gridRow: rowIdx + 1, gridColumn: DIAS.indexOf(d) + 2, minHeight: 48 }}
              />
            ))}
          </>
        ))}

        {/* Materias */}
        {DIAS_LOWER.map((dia, diaIdx) =>
          celdas[dia].map(({ materia, colorIndex, rowStart, rowSpan }) => (
            <div
              key={`${dia}-${materia.id}`}
              className={`m-0.5 rounded-lg border p-1.5 text-xs overflow-hidden ${COLORES[colorIndex]}`}
              style={{
                gridColumn: diaIdx + 2,
                gridRow: `${rowStart} / span ${rowSpan}`,
              }}
            >
              <p className="font-semibold truncate">{materia.nombre}</p>
              {materia.docente && (
                <p className="truncate opacity-80">{materia.docente.nombre}</p>
              )}
              {materia.aula && (
                <p className="truncate opacity-70">{materia.aula.nombre}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
