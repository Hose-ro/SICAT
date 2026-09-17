import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
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
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
            {modo === 'grupo'
              ? `${contextoSeleccionado.carrera?.nombre ?? 'Carrera'} · Sem ${contextoSeleccionado.semestre} · ${contextoSeleccionado.periodo}`
              : `${clases.length} clase${clases.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`}
          </p>
        </div>
        {modoEdicion && (
          <p className="text-xs text-primary-ink">
            Haz clic en una clase para editarla, o en un espacio libre para crear una nueva.
          </p>
        )}
      </div>

      {clases.length === 0 && !modoEdicion && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Este horario todavía no tiene clases programadas.
        </div>
      )}

      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Cuadrícula semanal">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: '64px repeat(6, 1fr)' }}>
          <div className="py-1 text-center text-xs text-muted-foreground" />
          {DIAS.map((dia) => (
            <div key={dia} className="py-1 text-center text-xs font-semibold text-muted-foreground">
              {dia}
            </div>
          ))}

          {HORAS.map((hora, rowIdx) => (
            <div key={`fila-${hora}`} className="contents">
              <div
                className="border-t border-border pr-2 pt-1 text-right text-xs text-muted-foreground"
                style={{ gridRow: rowIdx + 1 }}
              >
                {hora}
              </div>

              {DIAS.map((dia, diaIdx) =>
                modoEdicion ? (
                  <Button variant="ghost" aria-label={`Nueva clase · ${dia} ${hora}`}
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
                    className="group min-h-[48px] border-l border-t border-border  hover:bg-accent"
                    style={{ gridRow: rowIdx + 1, gridColumn: diaIdx + 2 }}
                  >
                    <span className="text-sm font-medium text-primary-ink opacity-0 transition group-hover:opacity-100">
                      +
                    </span>
                  </Button>
                ) : (
                  <div
                    key={`${dia}-${hora}`}
                    className="min-h-[48px] border-l border-t border-border"
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
        <Modal open onClose={() => setDetalle(null)} title={detalle.materia.nombre}><p className="text-sm text-muted-foreground">{detalle.materia.clave}</p>
            

            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium">Docente:</span> {detalle.docente.nombre}</p>
              <p><span className="font-medium">Aula:</span> {detalle.aula?.nombre || (detalle.bloques.some((b) => b.aula) ? 'Distinta por día' : 'Sin aula asignada')}</p>
              {detalle.grupo && <p><span className="font-medium">Grupo:</span> {detalle.grupo.nombre}</p>}
              {detalle.materia.carrera && (
                <p><span className="font-medium">Carrera:</span> {detalle.materia.carrera.nombre}</p>
              )}
              {detalle.semestre && <p><span className="font-medium">Semestre:</span> {detalle.semestre}</p>}
            </div>

            <div className="rounded-lg border border-border">
              {detalle.bloques.map((bloque) => (
                <div
                  key={`${bloque.horarioId}-${bloque.dia}`}
                  className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="font-medium text-foreground">{bloque.dia}</span>
                  <span className="text-muted-foreground">
                    {bloque.horaInicio}–{bloque.horaFin}
                    {bloque.aula ? ` · ${bloque.aula.nombre}` : ''}
                  </span>
                </div>
              ))}
            </div>

            <Button variant="default"
              onClick={() => {
                onEditarClase?.(detalle)
                setDetalle(null)
              }}
              className="w-full px-4 py-2 text-sm font-medium"
            >
              Editar clase
            </Button>
          </Modal>
      )}
    </div>
  )
}
