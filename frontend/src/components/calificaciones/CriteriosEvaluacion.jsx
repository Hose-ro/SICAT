import { useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MenuAcciones, Segmentado } from '@/pages/docente/components/tareas/Controles'
import { confirmAction, notify } from '@/lib/feedback'
import { cn } from '@/lib/utils'
import {
  MAX_CRITERIOS,
  META_MAXIMA,
  META_POR_DEFECTO,
  TIPOS_CRITERIO,
  TIPOS_PLANTILLA,
  esDeActividad,
  normalizarNombre,
  sumaPesos,
  tipoCriterio,
  validarCriterios,
} from '@/lib/criterios'
import { useCalificacionStore } from '@/store/calificacionStore'

const CAMPO = 'h-10 w-full min-w-0 rounded-[10px] border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive'
const TIPOS_ACTIVIDAD = Object.entries(TIPOS_CRITERIO).filter(([, tipo]) => tipo.actividad)

let siguienteClave = 0
const nuevaClave = () => `criterio-${(siguienteClave += 1)}`

const aFila = (criterio) => ({
  key: nuevaClave(),
  id: criterio.id ?? null,
  nombre: criterio.nombre,
  tipo: criterio.tipo,
  peso: String(criterio.peso),
  meta: criterio.meta != null ? String(criterio.meta) : criterio.tipo === 'PARTICIPACION' ? String(META_POR_DEFECTO) : '',
})

// Compara filas del borrador (texto) con las guardadas (números).
const firma = (filas) => JSON.stringify(
  (filas ?? []).map((fila) => [
    fila.id ?? null,
    fila.nombre.trim(),
    fila.tipo,
    String(fila.peso),
    fila.tipo === 'PARTICIPACION' && fila.meta != null ? String(fila.meta) : '',
  ]),
)

/** Filas guardadas del alcance: la lista de todas las unidades o la propia de una unidad (null si usa la de todas). */
function guardadas(datos, alcance) {
  if (alcance === 'base') return datos.base.criterios
  const unidad = datos.unidades.find((item) => item.unidad.id === alcance)
  return unidad?.personalizada ? unidad.criterios : null
}

function nombreLibre(filas, base) {
  const usados = new Set(filas.map((fila) => normalizarNombre(fila.nombre)))
  if (!usados.has(normalizarNombre(base))) return base
  let numero = 2
  while (usados.has(normalizarNombre(`${base} ${numero}`))) numero += 1
  return `${base} ${numero}`
}

const aPayload = (filas) => filas.map((fila) => ({
  ...(fila.id ? { id: fila.id } : {}),
  nombre: fila.nombre.trim(),
  tipo: fila.tipo,
  peso: Number(fila.peso),
  ...(fila.tipo === 'PARTICIPACION' ? { meta: Number(fila.meta) } : {}),
}))

/**
 * Editor de los criterios de evaluación de un grupo: una lista para todas las
 * unidades y, si hace falta, porcentajes propios para alguna unidad. Todos los
 * criterios (asistencia y participación incluidas) suman 100.
 */
export default function CriteriosEvaluacion({ datos, materiaId, grupo, alcanceInicial = 'base', plantillaInicial, onGuardado, onCambios }) {
  const guardarCriterios = useCalificacionStore((state) => state.guardarCriterios)
  const quitarCriteriosUnidad = useCalificacionStore((state) => state.quitarCriteriosUnidad)
  const [alcance, setAlcance] = useState(alcanceInicial)
  const [base, setBase] = useState({ datos, alcance: alcanceInicial })
  const [filas, setFilas] = useState(() => inicial(datos, alcanceInicial, plantillaInicial))
  const [otrosGrupos, setOtrosGrupos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  // Llegan criterios nuevos del servidor (tras guardar) o cambia el alcance:
  // el borrador vuelve a lo guardado.
  if (base.datos !== datos || base.alcance !== alcance) {
    setBase({ datos, alcance })
    setFilas(inicial(datos, alcance))
  }

  const originales = guardadas(datos, alcance)
  const cambios = firma(filas) !== firma(originales) || (filas === null) !== (originales === null)
  const problema = filas ? validarCriterios(filas) : ''
  const suma = filas ? sumaPesos(filas) : 0
  const unidadActual = alcance === 'base' ? null : datos.unidades.find((item) => item.unidad.id === alcance)
  const predeterminada = datos.base.origen === 'PREDETERMINADA'
  const cerradas = datos.unidades.filter((item) => item.unidad.status === 'FINALIZADA')

  const actualizar = (siguientes) => {
    setAviso('')
    setFilas(siguientes)
    onCambios?.(true)
  }
  const editarFila = (key, campo, valor) => actualizar(filas.map((fila) => (fila.key === key ? { ...fila, [campo]: valor } : fila)))
  const quitarFila = (key) => actualizar(filas.filter((fila) => fila.key !== key))
  const agregar = (tipo) => {
    const info = TIPOS_CRITERIO[tipo]
    const restante = Math.max(100 - sumaPesos(filas ?? []), 0)
    actualizar([
      ...(filas ?? []),
      aFila({ id: null, nombre: tipo === 'OTRO' ? '' : nombreLibre(filas ?? [], info.label), tipo, peso: restante || '', meta: null }),
    ])
  }

  const cambiarAlcance = async (siguiente) => {
    if (siguiente === alcance) return
    if (cambios && !(await confirmAction({
      title: 'Descartar cambios',
      description: 'Tienes cambios sin guardar en estos criterios. ¿Los descartas?',
      confirmLabel: 'Descartar',
    }))) return
    setAviso('')
    onCambios?.(false)
    setAlcance(siguiente)
  }

  const guardar = async () => {
    if (!filas || problema || !cambios || guardando) return
    setGuardando(true)
    setAviso('')
    const unidadId = alcance === 'base' ? undefined : alcance
    try {
      const nuevos = await guardarCriterios({ materiaId: Number(materiaId), grupoId: grupo.id, ...(unidadId ? { unidadId } : {}), criterios: aPayload(filas) })
      const lista = guardadas(nuevos, alcance) ?? []
      const copiados = []
      const fallos = []
      for (const otro of datos.gruposDelDocente.filter((item) => otrosGrupos.includes(item.id))) {
        try {
          await guardarCriterios({ materiaId: Number(materiaId), grupoId: otro.id, ...(unidadId ? { unidadId } : {}), criterios: aPayload(lista.map(aFila)) })
          copiados.push(otro.nombre)
        } catch (error) {
          fallos.push(`${otro.nombre}: ${error.response?.data?.message ?? 'no se pudo guardar'}`)
        }
      }
      const partes = [`Criterios de ${grupo.nombre} guardados.`]
      if (nuevos.reasignadas) partes.push(`${nuevos.reasignadas} ${nuevos.reasignadas === 1 ? 'tarea sin criterio quedó' : 'tareas sin criterio quedaron'} en «${lista.find((item) => item.tipo === 'TAREAS')?.nombre ?? 'Tareas'}».`)
      if (copiados.length) partes.push(`También en ${copiados.join(', ')}.`)
      setOtrosGrupos([])
      onCambios?.(false)
      onGuardado?.(nuevos)
      setAviso(partes.join(' '))
      if (fallos.length) notify(`No se copiaron a ${fallos.join('; ')}`)
    } catch (error) {
      notify(error.response?.data?.message ?? 'No se pudieron guardar los criterios.')
    } finally {
      setGuardando(false)
    }
  }

  const usarLosDeTodas = async () => {
    if (!unidadActual || guardando) return
    const ok = await confirmAction({
      title: 'Usar los criterios de todas las unidades',
      description: `La Unidad ${unidadActual.unidad.orden} dejará sus porcentajes propios y se calificará con la lista de todas las unidades.`,
      confirmLabel: 'Usar los de todas',
    })
    if (!ok) return
    setGuardando(true)
    try {
      const nuevos = await quitarCriteriosUnidad({ materiaId: Number(materiaId), grupoId: grupo.id, unidadId: unidadActual.unidad.id })
      onCambios?.(false)
      onGuardado?.(nuevos)
      setAviso(`La Unidad ${unidadActual.unidad.orden} usa los criterios de todas las unidades.`)
    } catch (error) {
      notify(error.response?.data?.message ?? 'No se pudo quitar la lista de la unidad.')
    } finally {
      setGuardando(false)
    }
  }

  const opcionesAlcance = [
    { value: 'base', label: 'Todas las unidades' },
    ...datos.unidades.map(({ unidad, personalizada }) => ({
      value: unidad.id,
      label: (
        <>
          U{unidad.orden}
          {personalizada && (
            <>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              <span className="sr-only"> (porcentajes propios)</span>
            </>
          )}
        </>
      ),
    })),
  ]

  const presentes = new Set((filas ?? []).map((fila) => fila.tipo))
  const plantillas = TIPOS_PLANTILLA.map((tipo) => {
    const info = TIPOS_CRITERIO[tipo]
    const unico = !info.actividad && presentes.has(tipo)
    return {
      label: tipo === 'OTRO' ? 'Otro (con tu nombre)' : info.label,
      icon: info.icono,
      disabled: unico || (filas?.length ?? 0) >= MAX_CRITERIOS,
      onSelect: () => agregar(tipo),
    }
  })

  return (
    <div className="@container space-y-4">
      {datos.unidades.length > 0 && (
        <Segmentado label="Criterios para" value={alcance} onChange={cambiarAlcance} options={opcionesAlcance} />
      )}

      <p className="text-sm text-muted-foreground">
        {alcance === 'base'
          ? predeterminada
            ? `${grupo.nombre} usa la ponderación predeterminada: todas las tareas valen igual, más la asistencia. Agrega criterios (examen, prácticas, participación…) y guarda para que el grupo tenga los suyos.`
            : `Se usan en todas las unidades de ${grupo.nombre}, salvo las que tengan porcentajes propios.`
          : unidadActual?.personalizada
            ? `La Unidad ${unidadActual.unidad.orden} tiene porcentajes propios.`
            : `La Unidad ${unidadActual?.unidad.orden} usa los criterios de todas las unidades.`}
        {alcance === 'base' && cerradas.length > 0 && ' Las unidades cerradas conservan los porcentajes con que se calificaron.'}
        {unidadActual?.unidad.status === 'FINALIZADA' && unidadActual.personalizada && ' Es una unidad cerrada: si cambias sus porcentajes, sus calificaciones se recalculan.'}
      </p>

      {filas === null ? (
        <div className="rounded-[14px] border border-dashed border-border px-4 py-5 text-center">
          <p className="text-sm text-foreground">{datos.base.criterios.map((item) => `${item.nombre} ${item.peso} %`).join(' · ')}</p>
          <Button variant="outline" className="mt-3" disabled={predeterminada || guardando}
            onClick={() => actualizar(datos.base.criterios.map(aFila))}>
            Personalizar esta unidad
          </Button>
          {predeterminada && (
            <p className="mt-2 text-xs text-muted-foreground">Primero guarda los criterios de todas las unidades.</p>
          )}
        </div>
      ) : (
        <>
          {filas.length > 0 ? (
            <ul className="divide-y divide-border rounded-[14px] border border-border" aria-label="Criterios">
              {filas.map((fila, indice) => (
                <FilaCriterio key={fila.key} fila={fila} indice={indice} onEditar={editarFila} onQuitar={quitarFila} />
              ))}
            </ul>
          ) : (
            <p className="rounded-[14px] border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Agrega el primer criterio.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <MenuAcciones label="Agregar criterio" items={plantillas} align="start"
              className="h-9 w-auto gap-1.5 border border-border bg-background px-3 text-sm font-medium text-foreground"
              trigger={<><Plus className="size-4" aria-hidden="true" />Agregar criterio<ChevronDown className="size-3.5" aria-hidden="true" /></>} />
            <p aria-live="polite" className={cn('text-sm tabular-nums', suma === 100 ? 'text-success-foreground' : 'text-muted-foreground')}>
              Suma {suma} %{suma !== 100 && ` · ${suma < 100 ? `faltan ${100 - suma}` : `sobran ${suma - 100}`} %`}
            </p>
          </div>

          {datos.gruposDelDocente.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-medium text-foreground">Usar también en</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {datos.gruposDelDocente.map((otro) => (
                  <label key={otro.id} className="inline-flex min-h-9 items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" className="size-4 accent-primary"
                      checked={otrosGrupos.includes(otro.id)}
                      onChange={(event) => setOtrosGrupos((actuales) => (event.target.checked ? [...actuales, otro.id] : actuales.filter((id) => id !== otro.id)))} />
                    {otro.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {filas !== null && (
          <Button onClick={guardar} disabled={!cambios || Boolean(problema) || guardando}>
            {guardando ? 'Guardando…' : 'Guardar criterios'}
          </Button>
        )}
        {unidadActual?.personalizada && (
          <Button variant="ghost" onClick={usarLosDeTodas} disabled={guardando}>Usar los de todas las unidades</Button>
        )}
        {cambios && problema && <p className="text-sm text-destructive-foreground">{problema}</p>}
      </div>
      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    </div>
  )
}

function inicial(datos, alcance, plantilla) {
  const lista = guardadas(datos, alcance)
  if (!lista) return null
  const filas = lista.map(aFila)
  if (!plantilla || !TIPOS_CRITERIO[plantilla] || filas.some((fila) => fila.tipo === plantilla)) return filas
  const info = TIPOS_CRITERIO[plantilla]
  return [...filas, aFila({ id: null, nombre: info.label, tipo: plantilla, peso: '', meta: null })]
}

function FilaCriterio({ fila, indice, onEditar, onQuitar }) {
  const tipo = tipoCriterio(fila.tipo)
  const Icono = tipo.icono
  const nombre = fila.nombre.trim() || `criterio ${indice + 1}`
  const pesoInvalido = fila.peso !== '' && !/^\d+$/.test(fila.peso)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input aria-label={`Nombre del criterio ${indice + 1}`} value={fila.nombre} maxLength={60}
        placeholder={tipo.actividad ? 'Nombre (p. ej. Examen parcial)' : tipo.label}
        onChange={(event) => onEditar(fila.key, 'nombre', event.target.value)}
        className={cn(CAMPO, 'min-w-[10rem] flex-1 basis-40')} />
      <div className="flex flex-wrap items-center gap-2 @xl:flex-nowrap">
        {esDeActividad(fila.tipo) ? (
          <select aria-label={`Tipo de ${nombre}`} value={fila.tipo} onChange={(event) => onEditar(fila.key, 'tipo', event.target.value)}
            className={cn(CAMPO, 'w-36')}>
            {TIPOS_ACTIVIDAD.map(([valor, info]) => <option key={valor} value={valor}>{info.label}</option>)}
          </select>
        ) : (
          <span className="inline-flex min-h-10 w-36 items-center text-xs text-muted-foreground">{tipo.ayuda}</span>
        )}
        <div className="relative w-24">
          <input aria-label={`Porcentaje de ${nombre}`} inputMode="numeric" value={fila.peso} aria-invalid={pesoInvalido || undefined}
            onChange={(event) => onEditar(fila.key, 'peso', event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            className={cn(CAMPO, 'pr-8 text-right tabular-nums')} />
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
        {fila.tipo === 'PARTICIPACION' && (
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Meta
            <input aria-label={`Participaciones que valen 100 en la unidad (${nombre})`} inputMode="numeric" value={fila.meta}
              onChange={(event) => onEditar(fila.key, 'meta', event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
              className={cn(CAMPO, 'w-16 text-right tabular-nums')} />
            <span className="sr-only">participaciones por unidad (máximo {META_MAXIMA})</span>
          </label>
        )}
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Quitar ${nombre}`} onClick={() => onQuitar(fila.key)}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}
