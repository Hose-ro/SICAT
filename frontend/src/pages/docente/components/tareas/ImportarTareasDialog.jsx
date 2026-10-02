import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'
import { fechaCorta, taskError } from '@/lib/tareas'
import { useTareaStore } from '@/store/tareaStore'

const FIELD = 'h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`
}

/**
 * Trae las tareas que el docente ya armó en otro grupo de la misma materia
 * (normalmente el del periodo pasado). Quedan en borrador, con las fechas
 * movidas al periodo del grupo destino, para revisarlas antes de publicar.
 */
export default function ImportarTareasDialog({ open, onClose, materia, grupo, onImportadas }) {
  const [estado, setEstado] = useState({ cargando: true, error: '', grupos: [] })
  const [origenId, setOrigenId] = useState(null)
  const [seleccion, setSeleccion] = useState(() => new Set())
  const [ajustarFechas, setAjustarFechas] = useState(true)
  const [importando, setImportando] = useState(false)
  const [errorImportar, setErrorImportar] = useState('')

  useEffect(() => {
    if (!open) return
    let vigente = true
    useTareaStore.getState().obtenerImportables(materia.id, grupo.id)
      .then((grupos) => {
        if (!vigente) return
        setEstado({ cargando: false, error: '', grupos })
        setOrigenId(grupos[0]?.grupo.id ?? null)
        setSeleccion(new Set(grupos[0]?.tareas.map((t) => t.id) ?? []))
      })
      .catch((error) => {
        if (vigente) setEstado({ cargando: false, error: taskError(error, 'No se pudieron cargar tus tareas anteriores.'), grupos: [] })
      })
    return () => { vigente = false }
  }, [open, materia.id, grupo.id])

  const origen = useMemo(() => estado.grupos.find((g) => g.grupo.id === origenId) ?? null, [estado.grupos, origenId])
  const puedeAjustar = origen?.desplazamientoDias != null
  const elegidas = origen?.tareas.filter((t) => seleccion.has(t.id)) ?? []
  const todas = Boolean(origen?.tareas.length) && elegidas.length === origen.tareas.length

  const cambiarOrigen = (id) => {
    const siguiente = estado.grupos.find((g) => g.grupo.id === id)
    setOrigenId(id)
    setSeleccion(new Set(siguiente?.tareas.map((t) => t.id) ?? []))
  }
  const alternar = (id) => setSeleccion((actual) => {
    const siguiente = new Set(actual)
    if (siguiente.has(id)) siguiente.delete(id)
    else siguiente.add(id)
    return siguiente
  })

  const importar = async () => {
    if (!elegidas.length || importando) return
    setImportando(true)
    setErrorImportar('')
    try {
      const resultado = await useTareaStore.getState().importar({
        materiaId: materia.id,
        grupoDestinoId: grupo.id,
        tareaIds: elegidas.map((t) => t.id),
        ajustarFechas: ajustarFechas && puedeAjustar,
      })
      onImportadas(resultado)
    } catch (error) {
      setErrorImportar(taskError(error, 'No se pudieron importar las tareas. Intenta de nuevo.'))
    } finally {
      setImportando(false)
    }
  }

  const fechaDe = (tarea) => {
    if (!tarea.tieneFechaLimite) return 'Sin fecha límite'
    if (!ajustarFechas || !puedeAjustar || !tarea.fechaSugerida) return 'Sin fecha (la pones tú)'
    return fechaCorta(tarea.fechaSugerida)
  }

  let cuerpo
  if (estado.cargando) {
    cuerpo = <p role="status" className="text-sm text-muted-foreground">Buscando tus tareas de otros grupos…</p>
  } else if (estado.error) {
    cuerpo = <p role="alert" className="text-sm text-destructive-foreground">{estado.error}</p>
  } else if (!estado.grupos.length) {
    cuerpo = (
      <p className="text-sm text-muted-foreground">
        No tienes tareas de {materia.nombre} en otros grupos. Cuando la des en otro periodo podrás traerlas desde aquí.
      </p>
    )
  } else {
    cuerpo = (
      <>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Copiar de</span>
          <select className={FIELD} value={origenId ?? ''} onChange={(event) => cambiarOrigen(Number(event.target.value))}>
            {estado.grupos.map((g) => (
              <option key={g.grupo.id} value={g.grupo.id}>
                {g.grupo.nombre} · {g.grupo.periodo} ({plural(g.tareas.length, 'tarea', 'tareas')})
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={ajustarFechas && puedeAjustar} disabled={!puedeAjustar}
            onChange={(event) => setAjustarFechas(event.target.checked)} />
          <span>
            <span className="font-medium text-foreground">Mover las fechas al periodo de {grupo.nombre}</span>
            <span className="block text-muted-foreground">
              {puedeAjustar
                ? `Cada fecha se recorre ${plural(Math.round(origen.desplazamientoDias / 7), 'semana', 'semanas')} y cae en el mismo día de la semana.`
                : 'No se conoce el inicio de alguno de los dos periodos; las copias quedarán sin fecha.'}
            </span>
          </span>
        </label>

        <fieldset>
          <div className="flex items-center justify-between gap-3">
            <legend className="text-sm font-medium text-foreground">Tareas ({elegidas.length} de {origen?.tareas.length ?? 0})</legend>
            <Button variant="ghost" type="button" className="h-8 px-2 text-sm"
              onClick={() => setSeleccion(new Set(todas ? [] : origen.tareas.map((t) => t.id)))}>
              {todas ? 'Quitar todas' : 'Elegir todas'}
            </Button>
          </div>
          <ul className="mt-2 max-h-[45vh] divide-y divide-border overflow-y-auto rounded-[10px] border border-border">
            {origen?.tareas.map((tarea) => (
              <li key={tarea.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-muted/40">
                  <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={seleccion.has(tarea.id)} onChange={() => alternar(tarea.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{tarea.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {tarea.unidadRef ? tarea.unidadRef.nombre : 'Sin unidad'}
                      {tarea.categoria && ` · ${tarea.categoria.nombre}`}
                      {' · '}{fechaDe(tarea)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="text-sm text-muted-foreground">Las copias quedan en borrador: revísalas y publícalas cuando estén listas.</p>
        {errorImportar && <p role="alert" className="text-sm text-destructive-foreground">{errorImportar}</p>}
      </>
    )
  }

  return (
    <Modal open={open} onClose={onClose} busy={importando} wide title={`Importar tareas a ${grupo.nombre}`}
      description={`Trae las tareas que ya armaste para ${materia.nombre} en otro grupo.`}>
      {cuerpo}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onClose} disabled={importando}>Cancelar</Button>
        {estado.grupos.length > 0 && (
          <Button type="button" onClick={importar} disabled={!elegidas.length || importando}>
            {importando ? 'Importando…' : `Importar ${plural(elegidas.length, 'tarea', 'tareas')}`}
          </Button>
        )}
      </div>
    </Modal>
  )
}
