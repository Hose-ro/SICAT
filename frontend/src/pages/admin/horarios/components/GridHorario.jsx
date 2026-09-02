import { useMemo, useState } from 'react'
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

function siguienteHora(hora) {
  const [h] = hora.split(':').map(Number)
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`
}

const HORAS = generarHoras(7, 22)
const HORA_INICIO_GRID = 7 * 60

export default function GridHorario({
  modo = 'docente',
  modoEdicion = false,
  claseEnEdicion = null,
  onEditarClase,
  onNuevaClase,
}) {
  const { docenteSeleccionado, grupoSeleccionado, clases } = useHorarioStore()
  const [detalle, setDetalle] = useState(null)

  const celdas = useMemo(() => {
    const resultado = {}
    DIAS_LOWER.forEach((dia) => {
      resultado[dia] = []
    })

    clases.forEach((clase, claseIdx) => {
      clase.bloques.forEach((bloque) => {
        const diaIdx = DIAS_LOWER.indexOf(bloque.dia.trim().toLowerCase())
        if (diaIdx === -1) return

        const inicioMin = aMinutos(bloque.horaInicio) - HORA_INICIO_GRID
        const finMin = aMinutos(bloque.horaFin) - HORA_INICIO_GRID

        resultado[DIAS_LOWER[diaIdx]].push({
          clase,
          bloque,
          colorIndex: claseIdx,
          rowStart: Math.floor(inicioMin / 60) + 1,
          rowSpan: Math.max(1, Math.ceil((finMin - inicioMin) / 60)),
        })
      })
    })

    return resultado
  }, [clases])

  const horasSemanales = useMemo(
    () =>
      clases.reduce(
        (acc, clase) =>
          acc +
          clase.bloques.reduce(
            (suma, bloque) =>
              suma + (aMinutos(bloque.horaFin) - aMinutos(bloque.horaInicio)) / 60,
            0,
          ),
        0,
      ),
    [clases],
  )

  const contextoSeleccionado = modo === 'grupo' ? grupoSeleccionado : docenteSeleccionado

  function handleClickBloque(clase) {
    if (modoEdicion) {
      onEditarClase?.(clase)
      return
    }
    setDetalle(clase)
  }

  if (!contextoSeleccionado) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        {modo === 'grupo'
          ? 'Selecciona un grupo para ver o editar su horario'
          : 'Selecciona un docente para ver o editar su horario'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{contextoSeleccionado.nombre}</h2>
          <p className="text-sm text-slate-500">
            {modo === 'grupo'
              ? `${contextoSeleccionado.carrera?.nombre ?? 'Carrera'} · Sem ${contextoSeleccionado.semestre} · ${contextoSeleccionado.periodo}`
              : `${clases.length} clase${clases.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`}
          </p>
        </div>
        {modoEdicion && (
          <p className="text-xs text-blue-600">
            Haz clic en una clase para editarla, o en un espacio libre para crear una nueva.
          </p>
        )}
      </div>

      {clases.length === 0 && !modoEdicion && (
        <div className="flex h-32 items-center justify-center text-sm text-slate-400">
          Este horario todavía no tiene clases programadas.
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: '64px repeat(6, 1fr)' }}>
          <div className="py-1 text-center text-xs text-slate-400" />
          {DIAS.map((dia) => (
            <div key={dia} className="py-1 text-center text-xs font-semibold text-slate-600">
              {dia}
            </div>
          ))}

          {HORAS.map((hora, rowIdx) => (
            <div key={`fila-${hora}`} className="contents">
              <div
                className="border-t border-slate-100 pr-2 pt-1 text-right text-xs text-slate-400"
                style={{ gridRow: rowIdx + 1 }}
              >
                {hora}
              </div>

              {DIAS.map((dia, diaIdx) =>
                modoEdicion ? (
                  <button
                    key={`${dia}-${hora}`}
                    type="button"
                    onClick={() =>
                      onNuevaClase?.({
                        dia,
                        horaInicio: hora,
                        horaFin: siguienteHora(hora),
                      })
                    }
                    title={`Nueva clase · ${dia} ${hora}`}
                    className="group min-h-[48px] border-l border-t border-slate-100 transition hover:bg-blue-50"
                    style={{ gridRow: rowIdx + 1, gridColumn: diaIdx + 2 }}
                  >
                    <span className="text-sm font-medium text-blue-500 opacity-0 transition group-hover:opacity-100">
                      +
                    </span>
                  </button>
                ) : (
                  <div
                    key={`${dia}-${hora}`}
                    className="min-h-[48px] border-l border-t border-slate-100"
                    style={{ gridRow: rowIdx + 1, gridColumn: diaIdx + 2 }}
                  />
                ),
              )}
            </div>
          ))}

          {DIAS_LOWER.map((dia, diaIdx) =>
            celdas[dia].map(({ clase, bloque, colorIndex, rowStart, rowSpan }) => (
              <div
                key={`${dia}-${bloque.horarioId}-${bloque.dia}`}
                style={{
                  gridColumn: diaIdx + 2,
                  gridRow: `${rowStart} / span ${rowSpan}`,
                  padding: '2px',
                }}
              >
                <TarjetaMateria
                  horario={{ ...clase, ...bloque }}
                  colorIndex={colorIndex}
                  onClick={() => handleClickBloque(clase)}
                  modoEdicion={modoEdicion}
                  activa={claseEnEdicion?.clave === clase.clave}
                />
              </div>
            )),
          )}
        </div>
      </div>

      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDetalle(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-xl bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">{detalle.materia.nombre}</h3>
                <p className="text-xs text-slate-400">{detalle.materia.clave}</p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-sm text-slate-600">
              <p><span className="font-medium">Docente:</span> {detalle.docente.nombre}</p>
              <p><span className="font-medium">Aula:</span> {detalle.aula?.nombre || (detalle.bloques.some((b) => b.aula) ? 'Distinta por día' : 'Sin aula asignada')}</p>
              {detalle.grupo && <p><span className="font-medium">Grupo:</span> {detalle.grupo.nombre}</p>}
              {detalle.materia.carrera && (
                <p><span className="font-medium">Carrera:</span> {detalle.materia.carrera.nombre}</p>
              )}
              {detalle.semestre && <p><span className="font-medium">Semestre:</span> {detalle.semestre}</p>}
            </div>

            <div className="rounded-lg border border-slate-200">
              {detalle.bloques.map((bloque) => (
                <div
                  key={`${bloque.horarioId}-${bloque.dia}`}
                  className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="font-medium text-slate-700">{bloque.dia}</span>
                  <span className="text-slate-500">
                    {bloque.horaInicio}–{bloque.horaFin}
                    {bloque.aula ? ` · ${bloque.aula.nombre}` : ''}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                onEditarClase?.(detalle)
                setDetalle(null)
              }}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Editar clase
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
