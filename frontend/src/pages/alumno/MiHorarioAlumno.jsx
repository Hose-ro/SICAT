import { useEffect, useState } from 'react'
import { CalendarClock, Download } from 'lucide-react'
import api from '../../api/axios'
import TarjetaMateria from '../admin/horarios/components/TarjetaMateria'
import { generarHorarioPdf } from '../../lib/generarHorarioPdf'

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

export default function MiHorarioAlumno() {
  const [alumno, setAlumno] = useState(null)
  const [grupo, setGrupo] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get('/horarios/mis-horarios-alumno')
      .then((res) => {
        if (cancelled) return
        setAlumno(res.data.alumno ?? null)
        setGrupo(res.data.grupo ?? null)
        setHorarios(res.data.horarios ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.data?.message ?? 'Error al cargar tu horario')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const celdas = {}
  DIAS_LOWER.forEach((d) => (celdas[d] = []))

  horarios.forEach((horario, idx) => {
    const diasMateria = horario.dias.split(',').map((d) => d.trim().toLowerCase())
    const inicioMin = aMinutos(horario.horaInicio) - HORA_INICIO_GRID
    const finMin = aMinutos(horario.horaFin) - HORA_INICIO_GRID
    // +2: row 1 is the day-header row, hour rows start at row 2
    const rowStart = Math.floor(inicioMin / 60) + 2
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

  const sinGrupo = !loading && !error && !grupo

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 print:gap-2 print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Mi Horario</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Cargando...'
              : error
                ? ' '
                : grupo
                  ? `${grupo.nombre} · ${horarios.length} clase${horarios.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`
                  : 'Sin grupo asignado'}
          </p>
        </div>
        </div>

        {!loading && !error && grupo && horarios.length > 0 && (
          <button
            type="button"
            onClick={() =>
              generarHorarioPdf({
                nombreArchivo: `Horario - ${alumno?.nombre ?? 'Alumno'}`,
                titulo: 'Mi Horario',
                subtitulo: `${grupo?.nombre ?? ''} · ${horarios.length} clase${horarios.length !== 1 ? 's' : ''} · ${horasSemanales}h semanales`,
                horarios,
              })
            }
            className="print-hidden inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {sinGrupo && (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
          Aún no tienes un grupo asignado. Cuando el administrador te asigne uno, tu horario aparecerá aquí.
        </div>
      )}

      {!loading && !error && grupo && horarios.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
          Tu grupo aún no tiene materias asignadas en el horario.
        </div>
      )}

      {!loading && grupo && horarios.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card p-3 sm:p-4 print:overflow-visible print:border-0 print:p-0 print:shadow-none">
          <div
            className="grid min-w-[720px] print:min-w-0"
            style={{ gridTemplateColumns: '64px repeat(6, 1fr)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            <div className="py-1 text-center text-xs text-muted-foreground" style={{ gridRow: 1, gridColumn: 1 }} />
            {DIAS.map((dia, diaIdx) => (
              <div
                key={dia}
                className="py-1 text-center text-xs font-semibold text-foreground"
                style={{ gridRow: 1, gridColumn: diaIdx + 2 }}
              >
                {dia}
              </div>
            ))}

            {HORAS.map((hora, rowIdx) => (
              <div key={`fila-${hora}`} className="contents">
                <div
                  className="border-t border-border pr-2 pt-1 text-right text-xs text-muted-foreground"
                  style={{ gridRow: rowIdx + 2, gridColumn: 1 }}
                >
                  {hora}
                </div>

                {DIAS_LOWER.map((dia) => (
                  <div
                    key={`${dia}-${hora}`}
                    className="min-h-[48px] border-t border-border print:min-h-7"
                    style={{ gridRow: rowIdx + 2, gridColumn: DIAS_LOWER.indexOf(dia) + 2 }}
                  />
                ))}
              </div>
            ))}

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
                  <TarjetaMateria horario={horario} colorIndex={colorIndex} onClick={setDetalle} />
                </div>
              )),
            )}
          </div>
        </div>
      )}

      {detalle && (
        <div
          className="print-hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDetalle(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-xl bg-card p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">{detalle.materia.nombre}</h3>
                <p className="text-xs text-muted-foreground">{detalle.materia.clave}</p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Docente:</span>{' '}
                {detalle.docente?.nombre ?? 'Sin docente asignado'}
              </p>
              <p>
                <span className="font-medium text-foreground">Aula:</span>{' '}
                {detalle.aula?.nombre ?? 'Sin aula asignada'}
              </p>
              <p>
                <span className="font-medium text-foreground">Días:</span> {detalle.dias}
              </p>
              <p>
                <span className="font-medium text-foreground">Horario:</span> {detalle.horaInicio} –{' '}
                {detalle.horaFin}
              </p>
              {detalle.materia.carrera && (
                <p>
                  <span className="font-medium text-foreground">Carrera:</span> {detalle.materia.carrera.nombre}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
