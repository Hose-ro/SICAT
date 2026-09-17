import { useMemo, useState } from 'react'
import { Clock3, DoorOpen, Users } from 'lucide-react'
import TarjetaMateria from '@/pages/admin/horarios/components/TarjetaMateria'
import { DIAS, aMinutos, colorParaMateria, diaDeHoy } from '@/lib/horarioColors'

const DIAS_LOWER = DIAS.map((d) => d.toLowerCase())
const DIAS_LABEL = { Miercoles: 'Miércoles', Sabado: 'Sábado' }
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function generarHoras(inicio = 7, fin = 22) {
  const horas = []
  for (let h = inicio; h < fin; h++) horas.push(`${String(h).padStart(2, '0')}:00`)
  return horas
}

const HORAS = generarHoras(7, 22)
const HORA_INICIO_GRID = 7 * 60

function diasDe(horario) {
  return horario.dias.split(',').map((d) => d.trim().toLowerCase())
}

/**
 * Horario de la semana. En pantallas angostas muestra una agenda por día
 * (sin desplazamiento horizontal); desde `md` y al imprimir, la cuadrícula.
 */
export default function HorarioSemanal({ horarios, onSelect }) {
  const porDia = useMemo(() => {
    const celdas = Object.fromEntries(DIAS_LOWER.map((d) => [d, []]))
    horarios.forEach((horario, colorIndex) => {
      const inicioMin = aMinutos(horario.horaInicio) - HORA_INICIO_GRID
      const finMin = aMinutos(horario.horaFin) - HORA_INICIO_GRID
      // +2: la fila 1 es la cabecera de días; las horas empiezan en la fila 2
      const rowStart = Math.floor(inicioMin / 60) + 2
      const rowSpan = Math.ceil((finMin - inicioMin) / 60)
      diasDe(horario).forEach((dia) => {
        if (celdas[dia]) celdas[dia].push({ horario, colorIndex, rowStart, rowSpan })
      })
    })
    for (const dia of DIAS_LOWER) celdas[dia].sort((a, b) => aMinutos(a.horario.horaInicio) - aMinutos(b.horario.horaInicio))
    return celdas
  }, [horarios])

  return (
    <>
      <AgendaDia porDia={porDia} onSelect={onSelect} />
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card p-3 sm:p-4 md:block print:block print:overflow-visible print:border-0 print:p-0 print:shadow-none">
        <div
          className="grid min-w-[720px] print:min-w-0"
          style={{ gridTemplateColumns: '64px repeat(6, 1fr)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="py-1 text-center text-xs text-muted-foreground" style={{ gridRow: 1, gridColumn: 1 }} />
          {DIAS.map((dia, diaIdx) => (
            <div key={dia} className="py-1 text-center text-xs font-semibold text-foreground" style={{ gridRow: 1, gridColumn: diaIdx + 2 }}>
              {DIAS_LABEL[dia] ?? dia}
            </div>
          ))}

          {HORAS.map((hora, rowIdx) => (
            <div key={`fila-${hora}`} className="contents">
              <div className="border-t border-border pr-2 pt-1 text-right text-xs text-muted-foreground" style={{ gridRow: rowIdx + 2, gridColumn: 1 }}>
                {hora}
              </div>
              {DIAS_LOWER.map((dia, diaIdx) => (
                <div key={`${dia}-${hora}`} className="min-h-[48px] border-t border-border print:min-h-7" style={{ gridRow: rowIdx + 2, gridColumn: diaIdx + 2 }} />
              ))}
            </div>
          ))}

          {DIAS_LOWER.map((dia, diaIdx) =>
            porDia[dia].map(({ horario, colorIndex, rowStart, rowSpan }) => (
              <div key={`${dia}-${horario.id}`} style={{ gridColumn: diaIdx + 2, gridRow: `${rowStart} / span ${rowSpan}`, padding: '2px' }}>
                <TarjetaMateria horario={horario} colorIndex={colorIndex} onClick={onSelect} />
              </div>
            )),
          )}
        </div>
      </div>
    </>
  )
}

function AgendaDia({ porDia, onSelect }) {
  const [diaIdx, setDiaIdx] = useState(() => {
    const hoy = diaDeHoy()
    if (porDia[DIAS_LOWER[hoy]].length) return hoy
    const primero = DIAS_LOWER.findIndex((d) => porDia[d].length)
    return primero === -1 ? hoy : primero
  })
  const clases = porDia[DIAS_LOWER[diaIdx]]
  const hoy = diaDeHoy()

  return (
    <div className="md:hidden print:hidden">
      <div role="tablist" aria-label="Día de la semana" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1">
        {DIAS.map((dia, idx) => {
          const total = porDia[DIAS_LOWER[idx]].length
          const activo = idx === diaIdx
          return (
            <button
              key={dia}
              type="button"
              role="tab"
              aria-selected={activo}
              aria-controls="agenda-dia"
              onClick={() => setDiaIdx(idx)}
              className={`flex min-w-[3.25rem] flex-1 flex-col items-center rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                activo ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
              }`}
            >
              <span>{DIAS_CORTO[idx]}</span>
              <span className={`text-[10px] font-medium ${activo ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {total ? `${total} clase${total !== 1 ? 's' : ''}` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      <div id="agenda-dia" role="tabpanel" className="mt-3 space-y-2">
        <p className="px-1 text-sm font-semibold text-foreground">
          {DIAS_LABEL[DIAS[diaIdx]] ?? DIAS[diaIdx]}
          {diaIdx === hoy && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-primary-ink">Hoy</span>}
        </p>
        {clases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Sin clases este día.
          </div>
        ) : (
          <ul className="space-y-2">
            {clases.map(({ horario, colorIndex }) => (
              <li key={horario.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(horario)}
                  className="flex w-full items-stretch gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span aria-hidden="true" className={`${colorParaMateria(colorIndex)} w-1.5 shrink-0 rounded-full`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{horario.materia.nombre}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{horario.horaInicio}–{horario.horaFin}</span>
                      {horario.grupo && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{horario.grupo.nombre}</span>}
                      {horario.aula && <span className="inline-flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />{horario.aula.nombre}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
