import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '../api/axios'
import { usePeriodoStore } from '../store/periodoStore'
import { claveDeFecha as claveFecha, fechaDeClave as fechaLocal, periodoDeHorario } from '../lib/periodo'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function primerMesVisible(rango) {
  const hoy = claveFecha(new Date())
  const clave = hoy < rango.fechaInicio ? rango.fechaInicio : hoy > rango.fechaFin ? rango.fechaFin : hoy
  const fecha = fechaLocal(clave)
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

/**
 * Un bloque tiene clase ese día si cae en uno de sus días de la semana y
 * dentro del calendario de su modalidad: el mixto no empieza ni termina
 * con el escolarizado.
 */
function aplica(horario, fecha, clave, periodos) {
  const dias = (horario.dias ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(',').map((dia) => dia.trim())
  if (!dias.includes(NOMBRES_DIA[fecha.getDay()])) return false
  const periodo = periodoDeHorario(periodos, horario)
  return clave >= periodo.fechaInicio && clave <= periodo.fechaFin
}

/**
 * El mismo calendario sirve para dos cosas: el docente marca sus propios días
 * sin clases (sólo donde tiene horario) y el admin marca festivos para toda la
 * institución (cualquier día del periodo). Cambian los textos, el endpoint y
 * qué celdas se pueden elegir.
 */
const MODOS = {
  docente: {
    endpoint: '/periodos/actual/suspensiones',
    titulo: 'Calendario de clases',
    descripcion: 'Consulta tus clases y marca los días sin actividades.',
    ayuda: 'Elige uno o varios días con clases. La suspensión aplicará a todas tus clases de esas fechas y no requerirá pase de lista.',
    boton: 'Marcar sin clases',
  },
  institucional: {
    endpoint: '/periodos/actual/suspensiones-institucionales',
    titulo: 'Calendario escolar',
    descripcion: 'Marca los días festivos o de suspensión oficial para toda la institución.',
    ayuda: 'Elige uno o varios días del periodo. Ningún docente tendrá clases ni pase de lista en esas fechas.',
    boton: 'Marcar festivo para todos',
  },
}

export default function CalendarioClases({ horarios = [], modo = 'docente' }) {
  const config = MODOS[modo]
  const institucional = modo === 'institucional'
  const { periodos, cargarPeriodos } = usePeriodoStore()
  // Unión de los calendarios que le tocan al usuario: acota los meses visibles.
  const rango = periodos?.rango ?? null
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(null)
  const [suspensiones, setSuspensiones] = useState([])
  const [seleccion, setSeleccion] = useState([])
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    if (!periodos) cargarPeriodos().catch(() => {})
  }, [periodos, cargarPeriodos])

  useEffect(() => {
    if (rango) setMes((actual) => {
      const claveMes = actual && claveFecha(actual).slice(0, 7)
      return !actual || claveMes < rango.fechaInicio.slice(0, 7) || claveMes > rango.fechaFin.slice(0, 7)
        ? primerMesVisible(rango)
        : actual
    })
  }, [rango])

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    setCargando(true)
    api.get(config.endpoint)
      .then(({ data }) => { if (vigente) setSuspensiones(data) })
      .catch((err) => { if (vigente) setError(err.response?.data?.message ?? 'No se pudo cargar el calendario.') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [abierto, config.endpoint])

  const porFecha = useMemo(() => new Map(suspensiones.map((item) => [item.fecha, item])), [suspensiones])
  const celdas = useMemo(() => {
    if (!mes || !rango) return []
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const desplazamiento = (primero.getDay() + 6) % 7
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    return Array.from({ length: Math.ceil((desplazamiento + total) / 7) * 7 }, (_, index) => {
      const dia = index - desplazamiento + 1
      if (dia < 1 || dia > total) return null
      const fecha = new Date(mes.getFullYear(), mes.getMonth(), dia)
      const clave = claveFecha(fecha)
      const enPeriodo = clave >= rango.fechaInicio && clave <= rango.fechaFin
      return {
        dia,
        clave,
        enPeriodo,
        clases: enPeriodo ? horarios.filter((horario) => aplica(horario, fecha, clave, periodos)) : [],
      }
    })
  }, [mes, rango, periodos, horarios])

  // En modo docente un festivo institucional no se toca: lo levanta el admin.
  const bloqueada = (clave) => !institucional && Boolean(porFecha.get(clave)?.institucional)
  const elegible = (celda) => !bloqueada(celda.clave) && (
    institucional ? celda.enPeriodo || porFecha.has(celda.clave) : celda.clases.length > 0 || porFecha.has(celda.clave)
  )

  const cambiarMes = (paso) => {
    setMes((actual) => new Date(actual.getFullYear(), actual.getMonth() + paso, 1))
    setSeleccion([])
    setMotivo('')
    setError('')
    setMensaje('')
  }

  const elegir = (clave) => {
    if (!seleccion.length) setMotivo(porFecha.get(clave)?.motivo ?? '')
    setSeleccion((actual) => {
      if (actual.includes(clave)) return actual.filter((item) => item !== clave)
      return [...actual, clave].sort()
    })
    setError('')
    setMensaje('')
  }

  const guardar = async (event) => {
    event.preventDefault()
    if (!seleccion.length) return
    setGuardando(true)
    setError('')
    try {
      const { data } = await api.post(config.endpoint, { fechas: seleccion, motivo: motivo.trim() })
      setSuspensiones(data)
      setMensaje(`${seleccion.length} ${seleccion.length === 1 ? 'día registrado' : 'días registrados'} sin clases${institucional ? ' para toda la institución' : ''}.`)
      setSeleccion([])
      setMotivo('')
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo guardar la suspensión.')
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async () => {
    const fecha = seleccion[0]
    if (!fecha || seleccion.length !== 1 || !porFecha.has(fecha) || bloqueada(fecha)) return
    setGuardando(true)
    setError('')
    try {
      const { data } = await api.delete(`${config.endpoint}/${fecha}`)
      setSuspensiones(data)
      setSeleccion([])
      setMotivo('')
      setMensaje('El día vuelve a tener clases programadas.')
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo quitar la suspensión.')
    } finally {
      setGuardando(false)
    }
  }

  const inicioMes = mes && rango && claveFecha(mes).slice(0, 7) <= rango.fechaInicio.slice(0, 7)
  const finMes = mes && rango && claveFecha(mes).slice(0, 7) >= rango.fechaFin.slice(0, 7)

  return (
    <section className="rounded-2xl border border-border bg-card print:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-controls="calendario-clases-panel"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink"><CalendarDays className="h-5 w-5" /></span>
          <span><span className="block text-base font-semibold text-foreground">{config.titulo}</span><span className="block text-sm text-muted-foreground">{config.descripcion}</span></span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div id="calendario-clases-panel" className="border-t border-border px-4 pb-5 pt-4 sm:px-5">
          {!rango || !mes ? <p className="text-sm text-muted-foreground">Cargando periodo escolar…</p> : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.45fr)]">
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold capitalize text-foreground">{mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</h3>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" type="button" onClick={() => cambiarMes(-1)} disabled={inicioMes} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" type="button" onClick={() => cambiarMes(1)} disabled={finMes} aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground sm:gap-2">
                  {DIAS.map((dia, index) => <div key={index} className="py-2" aria-label={['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][index]}>{dia}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {celdas.map((celda, index) => celda ? (
                    <button
                      key={celda.clave}
                      type="button"
                      disabled={!elegible(celda) || guardando}
                      onClick={() => elegir(celda.clave)}
                      aria-pressed={seleccion.includes(celda.clave)}
                      aria-label={`${fechaLocal(celda.clave).toLocaleDateString('es-MX', { dateStyle: 'full' })}: ${porFecha.has(celda.clave) ? `sin clases${porFecha.get(celda.clave).institucional ? ' (institucional)' : ''}, ${porFecha.get(celda.clave).motivo}` : institucional ? (celda.enPeriodo ? 'día del periodo' : 'fuera del periodo') : `${celda.clases.length} ${celda.clases.length === 1 ? 'clase' : 'clases'}`}`}
                      className={`min-h-16 rounded-xl border p-1.5 text-left transition-colors sm:min-h-20 sm:p-2 ${seleccion.includes(celda.clave) ? 'ring-2 ring-primary' : ''} ${porFecha.has(celda.clave) ? 'border-destructive/40 bg-destructive/10 text-destructive-foreground hover:bg-destructive/15' : (institucional ? celda.enPeriodo : celda.clases.length) ? 'border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15' : 'border-transparent text-muted-foreground/50'} disabled:cursor-default`}
                    >
                      <span className="block text-sm font-semibold">{celda.dia}</span>
                      {porFecha.has(celda.clave)
                        ? <span className="mt-1 block truncate text-[10px] font-semibold sm:text-xs">{!institucional && porFecha.get(celda.clave).institucional ? 'Festivo' : 'Sin clases'}</span>
                        : !institucional && celda.clases.length > 0 && <span className="mt-1 block text-[10px] sm:text-xs">{celda.clases.length} {celda.clases.length === 1 ? 'clase' : 'clases'}</span>}
                    </button>
                  ) : <div key={`vacio-${index}`} />)}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span><span className="mr-1 inline-block h-3 w-3 rounded bg-primary/25 align-middle" />{institucional ? 'Día del periodo' : 'Día con clases'}</span>
                  <span><span className="mr-1 inline-block h-3 w-3 rounded bg-destructive/30 align-middle" />{institucional ? 'Sin clases para todos' : 'Sin clases'}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground">{seleccion.length ? `${seleccion.length} ${seleccion.length === 1 ? 'día seleccionado' : 'días seleccionados'}` : 'Selecciona un día'}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{config.ayuda}</p>
                {!institucional && !celdas.some((celda) => celda?.clases.length) && <p className="mt-3 text-xs text-muted-foreground">No hay clases programadas en este mes del periodo.</p>}
                {seleccion.length > 0 && <p className="mt-3 text-xs font-medium text-foreground">{seleccion.map((clave) => fechaLocal(clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })).join(' · ')}</p>}
                {seleccion.length === 1 && Boolean(celdas.find((celda) => celda?.clave === seleccion[0])?.clases.length) && (
                  <ul className="mt-3 space-y-1 border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground">
                    {celdas.find((celda) => celda?.clave === seleccion[0]).clases.map((clase) => (
                      <li key={clase.id ?? `${clase.materiaId}-${clase.horaInicio}`}>
                        <span className="font-medium text-foreground">{clase.materia?.nombre ?? 'Clase'}</span> · {clase.horaInicio}–{clase.horaFin}
                      </li>
                    ))}
                  </ul>
                )}
                {seleccion.length === 1 && porFecha.has(seleccion[0]) && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">Motivo actual: {porFecha.get(seleccion[0]).motivo}</p>}
                {!institucional && celdas.some((celda) => celda && bloqueada(celda.clave)) && (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {celdas.filter((celda) => celda && bloqueada(celda.clave)).map((celda) => (
                      <li key={celda.clave}><span className="font-medium text-destructive-foreground">{fechaLocal(celda.clave).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span> · festivo institucional: {porFecha.get(celda.clave).motivo}</li>
                    ))}
                  </ul>
                )}
                <form onSubmit={guardar} className="mt-4 space-y-3">
                  <label className="block text-xs font-medium text-foreground" htmlFor="motivo-suspension">Motivo por el que no habrá clases</label>
                  <textarea id="motivo-suspension" value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={500} rows={3} disabled={!seleccion.length || guardando} placeholder="Ej. Día festivo, suspensión institucional…" className="w-full resize-y rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <Button type="submit" disabled={!seleccion.length || !motivo.trim() || guardando} className="w-full">{guardando ? 'Guardando…' : config.boton}</Button>
                </form>
                {seleccion.length === 1 && porFecha.has(seleccion[0]) && <Button variant="outline" type="button" onClick={quitar} disabled={guardando} className="mt-2 w-full border-destructive/40 text-destructive-foreground">Restablecer clases de este día</Button>}
                {cargando && <p role="status" className="mt-3 text-xs text-muted-foreground">Cargando suspensiones…</p>}
                {error && <p role="alert" className="mt-3 text-xs text-destructive-foreground">{error}</p>}
                {mensaje && <p role="status" className="mt-3 text-xs text-success-foreground">{mensaje}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
