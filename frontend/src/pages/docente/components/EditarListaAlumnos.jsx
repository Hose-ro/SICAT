import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CircleCheck, LoaderCircle, Pencil, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import api from '../../../api/axios'
import SexoSelector from '../../../components/SexoSelector'
import {
  CAMPOS_ALUMNO,
  datosFaltantes,
  normalizarCampo,
  resumirDatosAlumnos,
  validarCampo,
} from '../../../lib/datosAlumno'

const FILTROS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'faltantes', etiqueta: 'Con datos faltantes' },
  { valor: 'sinSexo', etiqueta: 'Sin sexo' },
]

const SIN_RESULTADOS = {
  todos: 'Este grupo no tiene alumnos.',
  faltantes: 'Todos los alumnos tienen sus datos completos.',
  sinSexo: 'Todos los alumnos tienen el sexo registrado.',
}

function coincideFiltro(filtro, alumno) {
  if (filtro === 'sinSexo') return !alumno.sexo
  if (filtro === 'faltantes') return datosFaltantes(alumno).length > 0
  return true
}

function idsDelFiltro(filtro, alumnos) {
  if (filtro === 'todos') return null
  return new Set(
    alumnos.filter((alumno) => coincideFiltro(filtro, alumno)).map((alumno) => alumno.id),
  )
}

function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function mensajeError(error, fallback) {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}

function sinClave(objeto, clave) {
  if (!objeto || !(clave in objeto)) return objeto
  const resto = { ...objeto }
  delete resto[clave]
  return resto
}

/**
 * Captura rápida del padrón del grupo: el sexo se asigna con un clic y los
 * datos de contacto se guardan al salir de cada casilla, sin recargar la
 * lista. Enter baja al mismo dato del siguiente alumno, como en una hoja de
 * cálculo, para llenar una columna completa sin usar el mouse.
 */
export default function EditarListaAlumnos({
  grupoId,
  alumnos,
  filtroInicial = 'todos',
  onActualizado,
  onEditarCompleto,
}) {
  const [filtro, setFiltro] = useState(filtroInicial)
  // Quién entra al filtro se decide al elegirlo: si se recalculara en cada
  // cambio, el alumno recién completado desaparecería a media captura.
  const [idsFiltro, setIdsFiltro] = useState(() => idsDelFiltro(filtroInicial, alumnos))
  const [busqueda, setBusqueda] = useState('')
  const [borradores, setBorradores] = useState({})
  const [errores, setErrores] = useState({})
  const [ocupados, setOcupados] = useState({})
  const [guardados, setGuardados] = useState({})
  const enVuelo = useRef({})
  const temporizadores = useRef({})

  useEffect(() => {
    const pendientes = temporizadores.current
    return () => Object.values(pendientes).forEach(clearTimeout)
  }, [])

  const resumen = useMemo(() => resumirDatosAlumnos(alumnos), [alumnos])
  const conteos = {
    todos: alumnos.length,
    faltantes: resumen.incompletos,
    sinSexo: resumen.sinSexo,
  }

  const numeroDeLista = useMemo(
    () => new Map(alumnos.map((alumno, indice) => [alumno.id, indice + 1])),
    [alumnos],
  )

  const visibles = useMemo(() => {
    const texto = sinAcentos(busqueda.trim())
    return alumnos.filter(
      (alumno) =>
        (!idsFiltro || idsFiltro.has(alumno.id)) &&
        (!texto ||
          sinAcentos(alumno.nombre).includes(texto) ||
          (alumno.numeroControl ?? '').toLowerCase().includes(texto)),
    )
  }, [alumnos, idsFiltro, busqueda])

  const elegirFiltro = (valor) => {
    setFiltro(valor)
    setIdsFiltro(idsDelFiltro(valor, alumnos))
  }

  const ponerError = (alumnoId, campo, mensaje) => {
    setErrores((prev) => ({
      ...prev,
      [alumnoId]: mensaje
        ? { ...prev[alumnoId], [campo]: mensaje }
        : sinClave(prev[alumnoId], campo),
    }))
  }

  const marcarGuardado = (alumnoId) => {
    clearTimeout(temporizadores.current[alumnoId])
    setGuardados((prev) => ({ ...prev, [alumnoId]: true }))
    temporizadores.current[alumnoId] = setTimeout(() => {
      setGuardados((prev) => sinClave(prev, alumnoId))
    }, 2000)
  }

  const enviar = async (alumno, campo, valor) => {
    const clave = `${alumno.id}:${campo}`
    enVuelo.current[clave] = valor
    setOcupados((prev) => ({ ...prev, [clave]: true }))
    ponerError(alumno.id, campo, '')
    try {
      const { data } = await api.patch(
        `/grupos/mis-grupos/${grupoId}/alumnos/${alumno.id}`,
        { [campo]: valor },
      )
      // Sólo se toma el dato enviado: otra casilla de la misma fila pudo
      // guardarse en paralelo y no hay que pisarla con una respuesta vieja.
      onActualizado(alumno.id, { [campo]: data?.[campo] ?? valor })
      marcarGuardado(alumno.id)
      return true
    } catch (err) {
      ponerError(alumno.id, campo, mensajeError(err, 'No se pudo guardar'))
      return false
    } finally {
      delete enVuelo.current[clave]
      setOcupados((prev) => sinClave(prev, clave))
    }
  }

  const asignarSexo = async (alumno, sexo) => {
    const anterior = alumno.sexo ?? null
    onActualizado(alumno.id, { sexo })
    const guardado = await enviar(alumno, 'sexo', sexo)
    if (!guardado) onActualizado(alumno.id, { sexo: anterior })
  }

  const cambiarBorrador = (alumnoId, campo, valor) => {
    setBorradores((prev) => ({
      ...prev,
      [alumnoId]: { ...prev[alumnoId], [campo]: valor },
    }))
    if (errores[alumnoId]?.[campo]) ponerError(alumnoId, campo, '')
  }

  /** Quita el borrador; con `siValeA`, sólo si nadie lo cambió mientras se guardaba. */
  const descartarBorrador = (alumnoId, campo, siValeA) => {
    setBorradores((prev) => {
      const fila = prev[alumnoId]
      if (!fila || !(campo in fila)) return prev
      if (siValeA !== undefined && normalizarCampo(campo, fila[campo]) !== siValeA) {
        return prev
      }
      return { ...prev, [alumnoId]: sinClave(fila, campo) }
    })
  }

  const guardarCampo = async (alumno, campo) => {
    const borrador = borradores[alumno.id]?.[campo]
    if (borrador === undefined) return

    const valor = normalizarCampo(campo, borrador)
    if (valor === (alumno[campo] ?? '')) {
      descartarBorrador(alumno.id, campo)
      ponerError(alumno.id, campo, '')
      return
    }
    const invalido = validarCampo(campo, valor)
    if (invalido) {
      ponerError(alumno.id, campo, invalido)
      return
    }
    if (enVuelo.current[`${alumno.id}:${campo}`] === valor) return

    if (await enviar(alumno, campo, valor)) {
      descartarBorrador(alumno.id, campo, valor)
    }
  }

  const deshacer = (alumnoId, campo) => {
    descartarBorrador(alumnoId, campo)
    ponerError(alumnoId, campo, '')
  }

  // Al mover el foco, el blur de la casilla actual es el que guarda.
  const irAlSiguiente = (alumnoId, campo, input) => {
    const indice = visibles.findIndex((alumno) => alumno.id === alumnoId)
    const siguiente = visibles[indice + 1]
    const destino = siguiente && document.getElementById(`lista-${campo}-${siguiente.id}`)
    if (destino) destino.focus()
    else input.blur()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filtrar alumnos" className="flex flex-wrap gap-1.5">
          {FILTROS.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={filtro === valor}
              onClick={() => elegirFiltro(valor)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                filtro === valor
                  ? 'border-primary/40 bg-primary/10 text-primary-ink'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {etiqueta}
              <span className="tabular-nums opacity-80">{conteos[valor]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-56">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label="Buscar alumno por nombre o número de control"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar alumno..."
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {busqueda.trim()
            ? 'Ningún alumno coincide con la búsqueda.'
            : SIN_RESULTADOS[filtro]}
        </p>
      ) : (
        <ol
          aria-label="Alumnos del grupo"
          className="divide-y divide-border rounded-xl border border-border sm:max-h-[min(58vh,34rem)] sm:overflow-y-auto"
        >
          {visibles.map((alumno) => (
            <FilaEdicion
              key={alumno.id}
              alumno={alumno}
              numero={numeroDeLista.get(alumno.id)}
              borrador={borradores[alumno.id]}
              errores={errores[alumno.id] ?? {}}
              guardandoSexo={Boolean(ocupados[`${alumno.id}:sexo`])}
              guardando={Object.keys(ocupados).some((clave) =>
                clave.startsWith(`${alumno.id}:`),
              )}
              guardado={Boolean(guardados[alumno.id])}
              onSexo={(sexo) => asignarSexo(alumno, sexo)}
              onCambiar={(campo, valor) => cambiarBorrador(alumno.id, campo, valor)}
              onGuardar={(campo) => guardarCampo(alumno, campo)}
              onDeshacer={(campo) => deshacer(alumno.id, campo)}
              onSiguiente={(campo, input) => irAlSiguiente(alumno.id, campo, input)}
              onEditarCompleto={() => onEditarCompleto(alumno)}
            />
          ))}
        </ol>
      )}

      <p className="text-xs text-muted-foreground">
        Cada dato se guarda al salir de la casilla. <kbd className="font-sans font-medium text-foreground">Enter</kbd>{' '}
        baja al siguiente alumno y <kbd className="font-sans font-medium text-foreground">Esc</kbd>{' '}
        deshace lo escrito.
      </p>
    </div>
  )
}

function EstadoFila({ guardando, guardado, completo }) {
  if (guardando) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        Guardando...
      </span>
    )
  }
  if (guardado) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-success-foreground">
        <Check aria-hidden="true" className="size-3.5" />
        Guardado
      </span>
    )
  }
  if (completo) {
    return (
      <span title="Datos completos" className="shrink-0 text-success-foreground">
        <CircleCheck aria-hidden="true" className="size-4" />
        <span className="sr-only">Datos completos</span>
      </span>
    )
  }
  return null
}

function FilaEdicion({
  alumno,
  numero,
  borrador,
  errores,
  guardandoSexo,
  guardando,
  guardado,
  onSexo,
  onCambiar,
  onGuardar,
  onDeshacer,
  onSiguiente,
  onEditarCompleto,
}) {
  const completo = datosFaltantes(alumno).length === 0

  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {numero}
          </span>
          <p className="min-w-0 text-sm font-medium text-foreground sm:truncate">
            {alumno.nombre}
          </p>
          <span aria-live="polite" className="contents">
            <EstadoFila guardando={guardando} guardado={guardado} completo={completo} />
          </span>
        </div>
        <div className="flex items-center gap-1 pl-8 sm:pl-0">
          <SexoSelector
            value={alumno.sexo}
            busy={guardandoSexo}
            label={`Sexo de ${alumno.nombre}`}
            onChange={onSexo}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={onEditarCompleto}
            aria-label={`Editar nombre o contraseña de ${alumno.nombre}`}
            title="Nombre y contraseña"
            className="text-muted-foreground"
          >
            <Pencil aria-hidden="true" />
          </Button>
        </div>
      </div>
      {errores.sexo && (
        <p role="alert" className="mt-1 pl-8 text-[11px] text-destructive-foreground">
          {errores.sexo}
        </p>
      )}

      <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-[8.5rem_minmax(0,1fr)_8.5rem]">
        {CAMPOS_ALUMNO.map((config) => {
          const { campo } = config
          const id = `lista-${campo}-${alumno.id}`
          const enBorrador = borrador?.[campo] !== undefined
          const valor = enBorrador ? borrador[campo] : (alumno[campo] ?? '')
          const error = errores[campo]
          const falta = !alumno[campo] && !valor

          return (
            <div key={campo} className="min-w-0">
              <label
                htmlFor={id}
                className="mb-0.5 block text-[11px] font-medium text-muted-foreground"
              >
                {config.etiqueta}
                {falta && <span className="ml-1 text-warning-foreground">· falta</span>}
              </label>
              <input
                id={id}
                type={config.type}
                inputMode={config.inputMode}
                autoCapitalize={config.autoCapitalize}
                autoComplete="off"
                spellCheck={false}
                value={valor}
                placeholder={config.placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => onCambiar(campo, event.target.value)}
                onBlur={() => onGuardar(campo)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onSiguiente(campo, event.currentTarget)
                  } else if (event.key === 'Escape' && (enBorrador || error)) {
                    // Primero se deshace lo escrito; el siguiente Esc ya cierra.
                    event.preventDefault()
                    event.stopPropagation()
                    onDeshacer(campo)
                  }
                }}
                className={cn(
                  'h-8 w-full rounded-lg border bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  error
                    ? 'border-destructive'
                    : falta
                      ? 'border-dashed border-warning'
                      : 'border-border',
                  campo === 'numeroControl' && 'font-mono',
                )}
              />
              {error && (
                <p
                  id={`${id}-error`}
                  role="alert"
                  className="mt-0.5 text-[11px] text-destructive-foreground"
                >
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </li>
  )
}
