import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hand, Minus, Search } from 'lucide-react'
import { confirmAction, notify } from '@/lib/feedback'
import {
  EVENTO_COLA, borrarBorrador, enCola, encolar, escribirBorrador, leerBorrador, procesarCola, quitarDeCola,
} from '@/lib/colaAsistencia'
import useUnsavedChangesGuard from '@/hooks/useUnsavedChangesGuard'
import { cn } from '@/lib/utils'
import SexoBadge from '../../../components/SexoBadge'
import { useAsistenciaStore } from '../../../store/asistenciaStore'

// Atajos de teclado: actúan sobre el alumno resaltado, tenga o no el foco
// (Safari no enfoca un botón al hacer clic). Se pueden apagar (WCAG 2.1.4).
const TECLAS = { a: 'ASISTENCIA', r: 'RETARDO', f: 'FALTA', j: 'JUSTIFICADA' }
const PREFERENCIA_ATAJOS = 'sicat:atajos-pase-lista'
// Donde una letra es texto o pertenece a otra cosa, no es un atajo.
const FUERA_DE_ATAJOS = 'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'

function leerAtajos() {
  try {
    return localStorage.getItem(PREFERENCIA_ATAJOS) !== 'no'
  } catch {
    return true
  }
}

const ESTADOS = [
  { valor: 'ASISTENCIA', etiqueta: 'Asistencia', letra: 'A', plural: ['asistencia', 'asistencias'], activo: 'bg-success/22 text-success-foreground ring-success/40' },
  { valor: 'RETARDO', etiqueta: 'Retardo', letra: 'R', plural: ['retardo', 'retardos'], activo: 'bg-warning/20 text-warning-foreground ring-warning/50' },
  { valor: 'FALTA', etiqueta: 'Falta', letra: 'F', plural: ['falta', 'faltas'], activo: 'bg-destructive/18 text-destructive-foreground ring-destructive/40' },
  { valor: 'JUSTIFICADA', etiqueta: 'Justificado', letra: 'J', plural: ['justificado', 'justificados'], activo: 'bg-accent text-primary-ink ring-primary/30' },
]

// Con más alumnos que esto, encontrar a uno a ojo ya cuesta.
const MINIMO_PARA_BUSCAR = 12

const plural = (n, [uno, varios]) => `${n} ${n === 1 ? uno : varios}`

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function horaCorta(value) {
  return new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

function fechaCorta(value) {
  return new Date(value).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
}

// El interceptor de axios le pone `response` sin `status` a los errores de red.
const sinConexion = (error) => !error?.response?.status

function mensajeCarga(error) {
  const status = error?.response?.status
  if (sinConexion(error)) return 'No se pudo cargar la lista. Revisa tu conexión e inténtalo de nuevo.'
  if (status === 404) return 'Esta clase no existe o ya no está disponible.'
  if (status === 403) return 'No tienes acceso a la lista de esta clase.'
  return error.response.data?.message ?? 'No se pudo cargar la lista.'
}

const SESION_VACIA = { sesion: null, alumnos: [], disponibles: [], registros: {}, guardados: {}, participacion: {}, recuperado: null }

export default function AsistenciaSesionPanel({
  sesionId,
  onClose,
  onSaved,
  onFinalizar,
  compact = false,
}) {
  const { obtenerListaSesion, pasarLista, registrarParticipacion } = useAsistenciaStore()
  const [carga, setCarga] = useState({ estado: 'cargando', error: '' })
  const [intento, setIntento] = useState(0)
  const [datos, setDatos] = useState(SESION_VACIA)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [alumnoManualId, setAlumnoManualId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [soloSinMarcar, setSoloSinMarcar] = useState(false)
  const [borradorLocal, setBorradorLocal] = useState(true)
  // Marcas que se intentaron guardar sin red y esperan en la cola del dispositivo.
  const [encolado, setEncolado] = useState(null)
  const filasRef = useRef([])
  const [cursor, setCursor] = useState(null)
  const [atajos, setAtajos] = useState(leerAtajos)
  const teclaRef = useRef(null)

  const { sesion, alumnos, disponibles, registros, guardados, participacion, recuperado } = datos

  useEffect(() => {
    if (!sesionId) return undefined

    let mounted = true
    setCarga({ estado: 'cargando', error: '' })
    setResultado(null)
    setBusqueda('')
    setSoloSinMarcar(false)
    setEncolado(null)

    obtenerListaSesion(sesionId)
      .then((data) => {
        if (!mounted) return
        const guardadosServidor = {}
        data.alumnos.forEach((alumno) => {
          if (alumno.estado) guardadosServidor[alumno.alumnoId] = alumno.estado
        })
        let lista = data.alumnos
        let restantes = data.alumnosDisponiblesAgregar ?? []
        let marcas = guardadosServidor
        let recuperadoDe = null

        const pendiente = enCola(sesionId)
        const borrador = leerBorrador(sesionId)
        if (pendiente) {
          marcas = Object.fromEntries(pendiente.registros.map((item) => [item.alumnoId, item.estado]))
          setEncolado(marcas)
          procesarCola()
        } else if (borrador?.registros) {
          const manuales = restantes.filter((item) => borrador.manuales?.includes(item.id))
          lista = [...lista, ...manuales.map((alumno) => ({
            alumnoId: alumno.id,
            nombre: alumno.nombre,
            numeroControl: alumno.numeroControl,
            sexo: alumno.sexo,
            estado: null,
            manual: true,
          }))].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
          restantes = restantes.filter((item) => !borrador.manuales?.includes(item.id))
          const ids = new Set(lista.map((alumno) => alumno.alumnoId))
          marcas = Object.fromEntries(Object.entries(borrador.registros).filter(([id, estado]) => ids.has(Number(id)) && estado))
          const difiere = manuales.length > 0
            || lista.some((alumno) => (marcas[alumno.alumnoId] ?? null) !== (guardadosServidor[alumno.alumnoId] ?? null))
          if (difiere) recuperadoDe = borrador.actualizado ?? null
          else {
            borrarBorrador(sesionId)
            marcas = guardadosServidor
          }
        }

        setDatos({
          sesion: data.sesion,
          alumnos: lista,
          disponibles: restantes,
          registros: marcas,
          guardados: guardadosServidor,
          participacion: Object.fromEntries(data.alumnos.map((alumno) => [alumno.alumnoId, alumno.participacion ?? 0])),
          recuperado: recuperadoDe ? { actualizado: recuperadoDe } : null,
        })
        setCarga({ estado: 'listo', error: '' })
      })
      .catch((error) => {
        if (!mounted) return
        setDatos(SESION_VACIA)
        setCarga({ estado: 'error', error: mensajeCarga(error), status: error?.response?.status })
      })

    return () => { mounted = false }
  }, [sesionId, obtenerListaSesion, intento])

  useEffect(() => {
    const alEnviar = (event) => {
      const { sesionId: enviada, registros: enviados, error } = event.detail
      if (enviada !== sesionId) return
      setEncolado(null)
      if (error) {
        setResultado({ tono: 'error', mensaje: 'El servidor rechazó la lista que esperaba conexión. Revisa las marcas y guarda de nuevo.' })
        return
      }
      const marcas = Object.fromEntries(enviados.map((item) => [item.alumnoId, item.estado]))
      setDatos((prev) => ({ ...prev, guardados: marcas }))
      setResultado({ tono: 'exito', mensaje: `Lista enviada a las ${horaCorta(Date.now())}, al volver la señal.` })
    }
    window.addEventListener(EVENTO_COLA, alEnviar)
    return () => window.removeEventListener(EVENTO_COLA, alEnviar)
  }, [sesionId])

  const listo = carga.estado === 'listo'
  const sinMarcar = alumnos.filter((alumno) => !registros[alumno.alumnoId])
  const sinGuardar = listo && alumnos.some((alumno) => (registros[alumno.alumnoId] ?? null) !== (guardados[alumno.alumnoId] ?? null)
    || (alumno.manual && !(alumno.alumnoId in guardados)))

  // Lo que está en la cola ya no se pierde al salir: se enviará solo.
  const esperandoRed = Boolean(encolado) && alumnos.every((alumno) => (registros[alumno.alumnoId] || 'FALTA') === encolado[alumno.alumnoId])

  // El borrador sigue a la lista: existe sólo mientras haya algo sin guardar.
  useEffect(() => {
    if (!listo || !sesionId) return
    if (!sinGuardar) {
      borrarBorrador(sesionId)
      return
    }
    setBorradorLocal(escribirBorrador(sesionId, {
      registros,
      manuales: alumnos.filter((alumno) => alumno.manual && !(alumno.alumnoId in guardados)).map((alumno) => alumno.alumnoId),
      actualizado: Date.now(),
    }))
  }, [listo, sesionId, sinGuardar, registros, alumnos, guardados])

  const avisoSalida = useMemo(() => ({
    title: 'La lista no se ha guardado',
    description: borradorLocal
      ? 'Tus marcas quedan en este dispositivo y se recuperan al volver a abrir la clase, pero los alumnos todavía no tienen asistencia registrada.'
      : 'Si sales ahora, perderás las marcas que hiciste.',
    confirmLabel: 'Salir sin guardar',
  }), [borradorLocal])
  useUnsavedChangesGuard(sinGuardar && !esperandoRed, avisoSalida)

  const conteos = Object.fromEntries(ESTADOS.map(({ valor }) => [valor, 0]))
  alumnos.forEach((alumno) => {
    const estado = registros[alumno.alumnoId]
    if (estado) conteos[estado] += 1
  })

  const needle = normalizar(busqueda)
  const visibles = alumnos.filter((alumno) => (!soloSinMarcar || !registros[alumno.alumnoId])
    && (!needle || normalizar(alumno.nombre).includes(needle) || normalizar(alumno.numeroControl).includes(needle)))

  const actualizar = (cambio) => {
    setResultado(null)
    setDatos((prev) => ({ ...prev, ...cambio(prev) }))
  }

  // Tocar el estado que ya está marcado lo quita: así se corrige un toque de más.
  const setEstado = (alumnoId, estado) => actualizar((prev) => {
    const siguiente = { ...prev.registros }
    if (siguiente[alumnoId] === estado) delete siguiente[alumnoId]
    else siguiente[alumnoId] = estado
    return { registros: siguiente }
  })

  const marcar = (alumnoId, estado) => actualizar((prev) => ({ registros: { ...prev.registros, [alumnoId]: estado } }))

  // El alumno resaltado: el que se eligió, o el primero que falta marcar.
  const actual = visibles.find((alumno) => alumno.alumnoId === cursor)
    ?? visibles.find((alumno) => !registros[alumno.alumnoId])
    ?? visibles[0]
    ?? null

  // Mueve el resaltado; si el foco ya estaba en la lista, lo lleva a la misma columna.
  const moverA = (indice, columna, origen) => {
    const destino = Math.max(0, Math.min(indice, visibles.length - 1))
    const fila = filasRef.current[destino]
    if (!visibles[destino]) return
    setCursor(visibles[destino].alumnoId)
    fila?.scrollIntoView({ block: 'nearest' })
    if (origen?.closest?.('[data-lista-alumnos]')) fila?.querySelectorAll('[data-estado]')[columna]?.focus()
  }

  useEffect(() => {
    teclaRef.current = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !actual) return
      const origen = event.target
      if (origen.closest?.(FUERA_DE_ATAJOS) || document.querySelector('[aria-modal="true"]')) return
      const indice = visibles.findIndex((alumno) => alumno.alumnoId === actual.alumnoId)
      const estado = TECLAS[event.key.toLowerCase()]
      if (estado) {
        event.preventDefault()
        marcar(actual.alumnoId, estado)
        moverA(indice + 1, ESTADOS.findIndex((item) => item.valor === estado), origen)
        return
      }
      // Las flechas sólo se toman en la lista o sin foco; en otro control conservan su uso.
      const paso = { ArrowDown: 1, ArrowUp: -1 }[event.key]
      if (paso && (origen === document.body || origen.closest?.('[data-lista-alumnos]'))) {
        event.preventDefault()
        const columna = Math.max(0, ESTADOS.findIndex((item) => item.valor === origen.dataset?.estado))
        moverA(indice + paso, columna, origen)
      }
    }
  })

  useEffect(() => {
    if (!listo || !atajos) return undefined
    const alTeclear = (event) => teclaRef.current?.(event)
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [listo, atajos])

  const alternarAtajos = () => {
    setAtajos((activos) => {
      try {
        localStorage.setItem(PREFERENCIA_ATAJOS, activos ? 'no' : 'si')
      } catch {
        // Sin almacenamiento la preferencia dura lo que la pantalla.
      }
      return !activos
    })
  }

  const marcarRestantesPresentes = () => actualizar((prev) => ({
    registros: Object.fromEntries(prev.alumnos.map((alumno) => [alumno.alumnoId, prev.registros[alumno.alumnoId] || 'ASISTENCIA'])),
  }))

  const agregarAlumnoManual = () => {
    const alumno = disponibles.find((item) => String(item.id) === alumnoManualId)
    if (!alumno) return
    actualizar((prev) => ({
      alumnos: [...prev.alumnos, {
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        numeroControl: alumno.numeroControl,
        sexo: alumno.sexo,
        estado: null,
        manual: true,
      }].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      disponibles: prev.disponibles.filter((item) => item.id !== alumno.id),
    }))
    setAlumnoManualId('')
  }

  const descartarBorrador = async () => {
    if (!(await confirmAction({
      title: 'Descartar lo recuperado',
      description: 'Se quitan las marcas que no se habían guardado y la lista vuelve a como está en el sistema.',
      confirmLabel: 'Descartar',
    }))) return
    borrarBorrador(sesionId)
    setIntento((n) => n + 1)
  }

  // Se aplica al instante y, si el servidor la rechaza, se regresa.
  const cambiarParticipacion = async (alumno, delta) => {
    const anterior = participacion[alumno.alumnoId] ?? 0
    setDatos((prev) => ({ ...prev, participacion: { ...prev.participacion, [alumno.alumnoId]: Math.max(0, anterior + delta) } }))
    try {
      const guardada = await registrarParticipacion(sesionId, alumno.alumnoId, delta)
      setDatos((prev) => ({ ...prev, participacion: { ...prev.participacion, [alumno.alumnoId]: guardada.puntos } }))
    } catch (error) {
      setDatos((prev) => ({ ...prev, participacion: { ...prev.participacion, [alumno.alumnoId]: anterior } }))
      notify(error.response?.data?.message || `No se pudo registrar la participación de ${alumno.nombre}.`)
    }
  }

  const handleGuardar = async () => {
    if (guardando) return
    if (sinMarcar.length > 0) {
      const nombres = sinMarcar.slice(0, 3).map((alumno) => alumno.nombre).join(', ')
      const resto = sinMarcar.length > 3 ? ` y ${plural(sinMarcar.length - 3, ['más', 'más'])}` : ''
      const confirmado = await confirmAction({
        title: sinMarcar.length === 1 ? 'Queda 1 alumno sin marcar' : `Quedan ${sinMarcar.length} alumnos sin marcar`,
        description: `${nombres}${resto} ${sinMarcar.length === 1 ? 'se guardará' : 'se guardarán'} con falta.`,
        confirmLabel: sinMarcar.length === 1 ? 'Guardar con falta' : 'Guardar con faltas',
      })
      if (!confirmado) return
    }

    setGuardando(true)
    setResultado(null)
    const payload = alumnos.map((alumno) => ({
      alumnoId: alumno.alumnoId,
      estado: registros[alumno.alumnoId] || 'FALTA',
    }))
    try {
      const result = await pasarLista(sesionId, payload)
      const marcas = Object.fromEntries(payload.map((item) => [item.alumnoId, item.estado]))
      setDatos((prev) => ({ ...prev, registros: marcas, guardados: marcas, recuperado: null }))
      borrarBorrador(sesionId)
      quitarDeCola(sesionId)
      setEncolado(null)
      setSoloSinMarcar(false)
      setResultado({
        tono: 'exito',
        // Los conteos ya están a la vista en la barra.
        mensaje: `Lista guardada a las ${horaCorta(Date.now())}.`,
      })
      if (onSaved) onSaved(result)
    } catch (error) {
      if (sinConexion(error) && encolar({ sesionId, materia: sesion.materia?.nombre, registros: payload })) {
        const marcas = Object.fromEntries(payload.map((item) => [item.alumnoId, item.estado]))
        setDatos((prev) => ({ ...prev, registros: marcas, recuperado: null }))
        setEncolado(marcas)
        setResultado({ tono: 'pendiente', mensaje: 'Sin conexión: la lista se enviará sola cuando vuelva la señal. Ya puedes cerrar esta pantalla.' })
        return
      }
      const respaldo = borradorLocal ? ' Tus marcas siguen en este dispositivo.' : ' No cierres esta pantalla.'
      setResultado({
        tono: 'error',
        mensaje: sinConexion(error)
          ? `Sin conexión: la lista no se guardó.${respaldo} Inténtalo de nuevo cuando tengas señal.`
          : `${error.response.data?.message || 'No se pudo guardar la asistencia.'}${respaldo}`,
      })
    } finally {
      setGuardando(false)
    }
  }

  // La página decide cómo finalizar (pide la bitácora antes de cerrar la clase).
  const handleFinalizar = () => onFinalizar(sesion)

  const cerrar = async () => {
    if (sinGuardar && !esperandoRed && !(await confirmAction(avisoSalida))) return
    onClose()
  }

  // Con la lista guardada, lo que sigue es cerrar la clase.
  const puedeFinalizar = Boolean(onFinalizar && sesion?.activa && !sinGuardar && Object.keys(guardados).length)
  const marco = cn('rounded-[var(--radius-card)] border border-border bg-card', compact ? 'p-4 sm:p-5' : 'p-4 sm:p-6')

  if (!sesionId) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Selecciona una clase para abrir el pase de lista.
      </div>
    )
  }

  if (carga.estado === 'cargando') {
    return (
      <div role="status" aria-label="Cargando la lista" className={cn(marco, 'space-y-4')}>
        <Skeleton className="h-6 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-1/2 max-w-xs" />
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-16 w-full rounded-[var(--radius-item)]" />)}
      </div>
    )
  }

  if (carga.estado === 'error') {
    return (
      <div role="alert" className={cn(marco, 'text-center')}>
        <p className="text-sm font-medium text-foreground">{carga.error}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {carga.status !== 404 && carga.status !== 403 && (
            <Button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
          )}
          {onClose && <Button type="button" variant="outline" onClick={onClose}>Volver</Button>}
        </div>
      </div>
    )
  }

  const detalle = [
    sesion.materia?.clave,
    sesion.grupo?.nombre ?? 'Sin grupo',
    sesion.aula?.nombre,
    sesion.unidad?.nombre ?? (sesion.unidad?.orden ? `Unidad ${sesion.unidad.orden}` : null),
  ].filter(Boolean).join(' · ')
  const horario = [
    sesion.fecha && fechaCorta(sesion.fecha),
    sesion.horaInicio && (sesion.horaFin ? `${horaCorta(sesion.horaInicio)} – ${horaCorta(sesion.horaFin)}` : `desde ${horaCorta(sesion.horaInicio)}`),
    sesion.activa ? 'clase en curso' : 'clase cerrada',
  ].filter(Boolean).join(' · ')

  return (
    <section aria-label={`Lista de ${sesion.materia?.nombre ?? 'la clase'}`} className={marco}>
      <header className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-snug text-foreground">{sesion.materia?.nombre}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>
          <p className="text-sm text-muted-foreground">{horario}</p>
        </div>
        {onClose && (
          <Button variant="outline" type="button" onClick={cerrar} className="shrink-0">
            Cerrar
          </Button>
        )}
      </header>

      {(sesion.fueFueraDeHorario || sesion.registroAtrasado) && (
        <div className="mt-4 space-y-1 rounded-[var(--radius-item)] border border-warning/45 bg-warning/18 px-4 py-3 text-sm text-warning-foreground">
          {sesion.fueFueraDeHorario && <p>Se inició fuera de su horario: la lista cuenta, pero el alumno no la ve como clase en línea.</p>}
          {sesion.registroAtrasado && <p>Se captura después de la clase: queda con su fecha y horario reales.</p>}
        </div>
      )}

      {recuperado && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-item)] border border-border bg-muted px-4 py-3 text-sm text-foreground">
          <p>
            Recuperamos marcas que no se habían guardado
            {recuperado.actualizado ? ` (de las ${horaCorta(recuperado.actualizado)})` : ''}. Revísalas y guarda la lista.
          </p>
          <Button type="button" variant="ghost" onClick={descartarBorrador}>Descartar</Button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {alumnos.length > MINIMO_PARA_BUSCAR && (
          <label className="relative sm:w-64">
            <span className="sr-only">Buscar alumno por nombre o número de control</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar alumno"
              className="h-9 w-full rounded-[10px] border border-input bg-background pl-9 pr-3 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-sm" />
          </label>
        )}
        <Button variant="outline" type="button" onClick={marcarRestantesPresentes} disabled={sinMarcar.length === 0}>
          {sinMarcar.length === alumnos.length ? 'Marcar todos presentes' : 'Marcar a los demás presentes'}
        </Button>

        {disponibles.length > 0 && (
          <div className="flex gap-2 sm:ml-auto">
            <select aria-label="Alumno para agregar a esta clase"
              value={alumnoManualId}
              onChange={(event) => setAlumnoManualId(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-input bg-background px-3 text-base text-foreground sm:text-sm"
            >
              <option value="">Agregar alumno a esta clase</option>
              {disponibles.map((alumno) => (
                <option key={alumno.id} value={alumno.id}>
                  {alumno.nombre} {alumno.numeroControl ? `· ${alumno.numeroControl}` : ''}
                </option>
              ))}
            </select>
            <Button variant="outline" type="button" onClick={agregarAlumnoManual} disabled={!alumnoManualId}>
              Agregar
            </Button>
          </div>
        )}
      </div>

      {/* Sólo con mouse o trackpad: en el teléfono no hay teclado físico que explicar. */}
      <div className="mt-3 hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground [@media(pointer:fine)]:flex">
        {atajos ? (
          <p>
            Con teclado: <kbd className="font-semibold text-foreground">A</kbd> asistencia · <kbd className="font-semibold text-foreground">R</kbd> retardo · <kbd className="font-semibold text-foreground">F</kbd> falta · <kbd className="font-semibold text-foreground">J</kbd> justificado marcan al alumno resaltado y pasan al siguiente; <kbd className="font-semibold text-foreground">↑</kbd> <kbd className="font-semibold text-foreground">↓</kbd> cambian de alumno.
          </p>
        ) : (
          <p>Atajos de teclado desactivados.</p>
        )}
        <button type="button" aria-pressed={atajos} onClick={alternarAtajos}
          className="rounded-md font-medium text-primary-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {atajos ? 'Desactivar atajos' : 'Activar atajos'}
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-item)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {alumnos.length === 0
            ? 'Esta clase no tiene alumnos inscritos.'
            : soloSinMarcar && !needle ? 'Ya marcaste a todos.' : 'Ningún alumno coincide con la búsqueda.'}
        </p>
      ) : (
        <ul data-lista-alumnos className="@container -mx-2 mt-3 divide-y divide-border border-y border-border">
          {visibles.map((alumno, indice) => {
            const puntos = participacion[alumno.alumnoId] ?? 0
            const resaltado = atajos && alumno.alumnoId === actual?.alumnoId
            const elegir = () => setCursor(alumno.alumnoId)
            return (
              <li key={alumno.alumnoId} ref={(el) => { filasRef.current[indice] = el }}
                aria-current={resaltado ? 'true' : undefined}
                className={cn('grid scroll-mb-36 scroll-mt-4 items-center gap-x-3 gap-y-1.5 px-2 py-2.5 transition-colors duration-150', resaltado && '[@media(pointer:fine)]:bg-accent/60',
                  "[grid-template-areas:'nombre_participa'_'estado_estado'] grid-cols-[minmax(0,1fr)_auto] @[40rem]:grid-cols-[minmax(0,1fr)_auto_auto] @[40rem]:[grid-template-areas:'nombre_estado_participa']")}>
                <div className="min-w-0 [grid-area:nombre]">
                  <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <SexoBadge sexo={alumno.sexo} />
                    <span className="min-w-0 break-words">{alumno.nombre}</span>
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {alumno.numeroControl || 'Sin número de control'}
                    {alumno.manual && <span className="text-warning-foreground"> · agregado a esta clase</span>}
                  </p>
                </div>

                <div role="group" aria-label={`Estado de ${alumno.nombre}`}
                  className="grid grid-cols-4 gap-0.5 rounded-[12px] border border-border bg-muted p-0.5 [grid-area:estado] @[40rem]:w-[25rem]">
                  {ESTADOS.map(({ valor, etiqueta, activo }) => {
                    const marcado = registros[alumno.alumnoId] === valor
                    return (
                      <button key={valor} type="button" aria-pressed={marcado} data-estado={valor}
                        aria-keyshortcuts={atajos ? Object.keys(TECLAS).find((tecla) => TECLAS[tecla] === valor).toUpperCase() : undefined}
                        onClick={() => { elegir(); setEstado(alumno.alumnoId, valor) }}
                        onFocus={elegir}
                        className={cn(
                          'min-h-9 min-w-0 rounded-[10px] px-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          marcado ? cn('font-semibold ring-1', activo) : 'text-muted-foreground hover:bg-card hover:text-foreground',
                        )}>
                        {etiqueta}
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center justify-end gap-1 [grid-area:participa]" role="group" aria-label={`Participación de ${alumno.nombre}`}>
                  {puntos > 0 && (
                    <Button variant="ghost" type="button" size="icon" className="size-8 rounded-full"
                      aria-label={`Quitar un punto de participación a ${alumno.nombre}`}
                      onClick={() => cambiarParticipacion(alumno, -1)}>
                      <Minus className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  <Button variant="outline" type="button"
                    aria-label={`Sumar participación a ${alumno.nombre} (lleva ${puntos})`}
                    onClick={() => { elegir(); cambiarParticipacion(alumno, 1) }}
                    onFocus={elegir}
                    className={cn('h-8 gap-1.5 rounded-full px-3 text-xs font-semibold', puntos > 0 ? 'border-primary/40 bg-primary/10 text-primary-ink' : 'text-muted-foreground')}>
                    <Hand className="size-3.5" aria-hidden="true" />
                    {puntos > 0 ? `${puntos} ${puntos === 1 ? 'pt' : 'pts'}` : '+1'}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Fija abajo: en un grupo de 40 el botón no debe quedar a ocho pantallas. */}
      <div className="sticky bottom-[calc(var(--barra-inferior,0px)+env(safe-area-inset-bottom,0px)+0.75rem)] z-10 mt-4 rounded-[var(--radius-item)] border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-muted-foreground">
              {ESTADOS.map(({ valor, letra, etiqueta, plural: nombres }) => (
                <span key={valor}>
                  <abbr title={etiqueta} className="font-semibold text-foreground no-underline" aria-hidden="true">{letra}</abbr>
                  <span aria-hidden="true"> {conteos[valor]}</span>
                  <span className="sr-only">{plural(conteos[valor], nombres)}</span>
                </span>
              ))}
              {sinMarcar.length > 0 ? (
                <button type="button" aria-pressed={soloSinMarcar} onClick={() => setSoloSinMarcar((valor) => !valor)}
                  className="rounded-md font-medium text-warning-foreground underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  {soloSinMarcar ? 'Ver a todos' : `${sinMarcar.length} sin marcar`}
                </button>
              ) : alumnos.length > 0 && <span className="text-success-foreground">Todos marcados</span>}
            </p>
            {resultado ? (
              <p role={resultado.tono === 'error' ? 'alert' : 'status'}
                className={cn('text-sm', {
                  error: 'font-medium text-destructive-foreground',
                  pendiente: 'font-medium text-warning-foreground',
                  exito: 'text-success-foreground',
                }[resultado.tono])}>
                {resultado.mensaje}
              </p>
            ) : (
              <p role="status" className="text-xs text-muted-foreground">
                {guardando ? 'Guardando…' : esperandoRed ? 'Esperando señal para enviar' : sinGuardar ? 'Cambios sin guardar' : 'Lista al día'}
              </p>
            )}
          </div>
          {puedeFinalizar ? (
            <Button type="button" variant="outline" onClick={handleFinalizar} className="shrink-0 px-5">
              Finalizar clase
            </Button>
          ) : (
            <Button type="button" onClick={handleGuardar} disabled={guardando} className="shrink-0 px-5">
              {guardando ? 'Guardando…' : <>Guardar<span className="sr-only sm:not-sr-only"> asistencia</span></>}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
