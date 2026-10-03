import { useId, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import SexoBadge from '@/components/SexoBadge'
import { Button } from '@/components/ui/button'
import useUnsavedChangesGuard from '@/hooks/useUnsavedChangesGuard'
import { moverFoco } from '@/lib/capturaTeclado'
import { notify } from '@/lib/feedback'
import { notaValida, taskError } from '@/lib/tareas'
import { cn } from '@/lib/utils'
import { useTareaStore } from '@/store/tareaStore'
import { EstadoEntregaChip } from './Estados'

const CAMPO = 'h-9 w-full min-w-0 rounded-[10px] border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:bg-muted disabled:text-muted-foreground'

/** Lo guardado de un alumno, en la forma del borrador. */
function guardado(fila) {
  const { entrega } = fila
  const registrada = entrega && !entrega.esSintetica
  return {
    calificacion: registrada && entrega.estadoRevision === 'CALIFICADA' && typeof entrega.calificacion === 'number' ? String(entrega.calificacion) : '',
    noPresento: Boolean(registrada && entrega.estadoRevision === 'NO_ENTREGADA'),
    observacion: (registrada && entrega.observacion) || '',
  }
}

const igual = (a, b) => a.calificacion.trim() === b.calificacion.trim() && a.noPresento === b.noPresento && a.observacion.trim() === b.observacion.trim()

/**
 * Captura en lista de una actividad en clase (un examen en papel, una
 * exposición): una fila por alumno, la calificación con Enter para bajar y
 * "No presentó" para quien faltó (cuenta como 0). Sólo se manda lo que cambió.
 */
export default function CapturaCalificaciones({ tarea, filas, onGuardado }) {
  const idTitulo = useId()
  const [borradores, setBorradores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const bloqueada = tarea.estado === 'BORRADOR'

  const valores = useMemo(() => Object.fromEntries(filas.map((fila) => [fila.alumno.id, borradores[fila.alumno.id] ?? guardado(fila)])), [filas, borradores])
  const cambiados = filas.filter((fila) => borradores[fila.alumno.id] && !igual(borradores[fila.alumno.id], guardado(fila)))
  const invalidos = cambiados.filter((fila) => {
    const valor = valores[fila.alumno.id]
    return !valor.noPresento && valor.calificacion.trim() !== '' && !notaValida(valor.calificacion.trim())
  })
  const capturados = filas.filter((fila) => {
    const valor = valores[fila.alumno.id]
    return valor.noPresento || notaValida(valor.calificacion.trim())
  }).length
  useUnsavedChangesGuard(cambiados.length > 0, {
    title: 'Calificaciones sin guardar',
    description: `Tienes ${cambiados.length === 1 ? '1 calificación' : `${cambiados.length} calificaciones`} sin guardar. Si sales, se perderán.`,
    confirmLabel: 'Descartar cambios',
  })

  const editar = (fila, cambios) => {
    setBorradores((actuales) => ({ ...actuales, [fila.alumno.id]: { ...(actuales[fila.alumno.id] ?? guardado(fila)), ...cambios } }))
  }

  const guardar = async () => {
    if (!cambiados.length || invalidos.length || guardando) return
    setGuardando(true)
    const calificaciones = cambiados.map((fila) => {
      const valor = valores[fila.alumno.id]
      const antes = guardado(fila)
      const item = { alumnoId: fila.alumno.id }
      if (valor.noPresento) item.noPresento = true
      else item.calificacion = valor.calificacion.trim() === '' ? null : Number(valor.calificacion.trim())
      if (valor.observacion.trim() !== antes.observacion.trim()) item.observacion = valor.observacion.trim() || null
      return item
    })
    try {
      const respuesta = await useTareaStore.getState().capturarCalificaciones(tarea.id, calificaciones)
      setBorradores({})
      onGuardado(respuesta)
      notify(`Se ${calificaciones.length === 1 ? 'guardó 1 calificación' : `guardaron ${calificaciones.length} calificaciones`}.`, 'success')
    } catch (error) {
      notify(error.response?.status === 404
        ? 'El servidor todavía no tiene la captura en lista. Actualiza el backend para usarla.'
        : taskError(error, 'No se pudieron guardar las calificaciones. Tus cambios siguen en la lista.'))
    } finally {
      setGuardando(false)
    }
  }

  if (bloqueada) {
    return (
      <p className="mt-5 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Publica la actividad para capturar sus calificaciones.
      </p>
    )
  }

  return (
    <section aria-labelledby={idTitulo} className="mt-5 rounded-[var(--radius-card)] border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 sm:px-5">
        <h2 id={idTitulo} className="text-base font-semibold text-foreground">Captura en lista</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{capturados} de {filas.length}</span> calificados
        </p>
      </div>
      <p className="px-4 pt-1 text-sm text-muted-foreground sm:px-5">
        Escribe la calificación (1 a 100) y presiona Enter para pasar al siguiente. «No presentó» cuenta como 0; sin calificación, no cuenta.
      </p>

      <div role="region" aria-labelledby={idTitulo} tabIndex={0} className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium sm:pl-5">No. control</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Alumno</th>
              <th scope="col" className="w-28 px-3 py-2.5 font-medium">Calificación</th>
              <th scope="col" className="px-3 py-2.5 font-medium">No presentó</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Observación</th>
              <th scope="col" className="px-3 py-2.5 font-medium sm:pr-5">Estado</th>
            </tr>
          </thead>
          <tbody data-captura-grupo className="divide-y divide-border">
            {filas.map((fila) => {
              const valor = valores[fila.alumno.id]
              const cambio = cambiados.includes(fila)
              const invalido = invalidos.includes(fila)
              const nombre = fila.alumno.nombre
              return (
                <tr key={fila.alumno.id} className={cn(cambio && 'bg-accent/40')}>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground sm:pl-5">{fila.alumno.numeroControl ?? '—'}</td>
                  <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">{nombre}<SexoBadge sexo={fila.alumno.sexo} /></span>
                  </th>
                  <td className="px-3 py-2">
                    <input type="text" inputMode="decimal" autoComplete="off" aria-label={`Calificación de ${nombre}`}
                      data-captura="calificacion" data-columna="nota" onKeyDown={moverFoco}
                      value={valor.noPresento ? '0' : valor.calificacion} disabled={valor.noPresento || guardando}
                      aria-invalid={invalido || undefined}
                      onChange={(event) => editar(fila, { calificacion: event.target.value.replace(/[^\d.]/g, '').slice(0, 5) })}
                      className={cn(CAMPO, 'w-20 text-right tabular-nums')} />
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex min-h-9 items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" className="size-4 accent-primary" checked={valor.noPresento} disabled={guardando}
                        onChange={(event) => editar(fila, { noPresento: event.target.checked })} />
                      <span className="sr-only">{nombre} no presentó</span>
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" aria-label={`Observación para ${nombre}`} maxLength={500} value={valor.observacion} disabled={guardando}
                      onChange={(event) => editar(fila, { observacion: event.target.value })} className={cn(CAMPO, 'min-w-[9rem]')} />
                  </td>
                  <td className="px-3 py-2 sm:pr-5">
                    {cambio
                      ? <span className="text-xs font-medium text-primary-ink">Sin guardar</span>
                      : <EstadoEntregaChip estado={fila.estado} entrega={fila.entrega} tarea={tarea} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-[var(--radius-card)] border-t border-border bg-card px-4 py-3 sm:px-5">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {cambiados.length
            ? <>{cambiados.length === 1 ? '1 cambio sin guardar' : `${cambiados.length} cambios sin guardar`}{invalidos.length > 0 && <span className="text-destructive-foreground"> · corrige {invalidos.length === 1 ? '1 calificación' : `${invalidos.length} calificaciones`} fuera de 1 a 100</span>}</>
            : 'Todo guardado'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setBorradores({})} disabled={!cambiados.length || guardando}>Descartar</Button>
          <Button onClick={guardar} disabled={!cambiados.length || invalidos.length > 0 || guardando}>
            <Save aria-hidden="true" />
            {guardando ? 'Guardando…' : `Guardar calificaciones${cambiados.length ? ` (${cambiados.length})` : ''}`}
          </Button>
        </div>
      </div>
    </section>
  )
}
