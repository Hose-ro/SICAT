import { useState } from 'react'
import { Check, ChevronDown, FileDown, FileSpreadsheet, FolderDown, Lock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { conteoTarea, fechaCorta, rangoFechas } from '@/lib/tareas'
import { Chip } from './Estados'
import { MenuAcciones } from './Controles'
import FilaTarea from './FilaTarea'
import NuevaTareaRapida from './NuevaTareaRapida'

function Nodo({ status }) {
  if (status === 'FINALIZADA') {
    return <span className="grid size-6 place-items-center rounded-full bg-success text-success-on-fill"><Check className="size-3.5" strokeWidth={3} aria-hidden="true" /></span>
  }
  if (status === 'ACTIVA') {
    return <span className="grid size-6 place-items-center rounded-full bg-card ring-2 ring-foreground"><span className="size-2 rounded-full bg-foreground" /></span>
  }
  return <span className="size-6 rounded-full bg-background ring-1 ring-border" />
}

function unirConPuntos(partes) {
  return partes.filter(Boolean).reduce((acc, parte, i) => (i ? [...acc, <span key={`punto-${i}`}> · </span>, parte] : [parte]), [])
}

/**
 * Una unidad de la materia con sus tareas en orden de fecha límite. `unidad`
 * es null para las tareas que no tienen unidad asignada.
 */
export default function UnidadTareas({
  unidad, tareas, ultimo, forzarAbierta, puedeCrear, formularioCompleto, procesando,
  menuTarea, onPublicar, onCrearBorrador, onCerrarUnidad, onReporte,
}) {
  const finalizada = unidad?.status === 'FINALIZADA'
  const activa = unidad?.status === 'ACTIVA'
  const [abiertaManual, setAbiertaManual] = useState(null)
  const [creando, setCreando] = useState(false)
  const abierta = forzarAbierta || (abiertaManual ?? !finalizada)

  const publicadas = tareas.filter((t) => t.estado !== 'BORRADOR')
  const porCalificar = publicadas.reduce((s, t) => s + conteoTarea(t).porCalificar, 0)
  const borradores = tareas.length - publicadas.length
  const recibiendo = publicadas.filter((t) => t.estado === 'PUBLICADA').length
  const promedios = publicadas.map((t) => t.promedio).filter((p) => typeof p === 'number')
  const promedio = promedios.length ? (promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(1) : null
  const cerrando = procesando === `unidad-${unidad?.id}`
  const titulo = unidad ? unidad.nombre : 'Sin unidad asignada'
  const rango = unidad ? rangoFechas(unidad.fechaInicio, unidad.fechaFin) : ''

  let estado = null
  if (finalizada) estado = <Chip tone="success">Finalizada</Chip>
  else if (activa) estado = <Chip tone="accent">En curso</Chip>
  else if (unidad) estado = <Chip tone="muted">{unidad.fechaInicio ? `Inicia ${fechaCorta(unidad.fechaInicio)}` : 'Sin iniciar'}</Chip>

  const faltan = [
    porCalificar > 0 && `${porCalificar} ${porCalificar === 1 ? 'entrega por calificar' : 'entregas por calificar'}`,
    borradores > 0 && `${borradores} ${borradores === 1 ? 'borrador sin publicar' : 'borradores sin publicar'}`,
  ].filter(Boolean)

  return (
    <li className="grid grid-cols-1 sm:grid-cols-[1.5rem_minmax(0,1fr)] sm:gap-x-4">
      <div className="relative hidden justify-center pt-[1.1rem] sm:flex">
        {!ultimo && <span className="absolute bottom-[-0.75rem] top-[2.6rem] w-px bg-border" aria-hidden="true" />}
        <Nodo status={unidad?.status} />
      </div>
      <div className="min-w-0 rounded-[var(--radius-card)] border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:pl-4">
          <h3 className="min-w-0 text-[1.0625rem] font-semibold leading-snug text-foreground">
            <button type="button" aria-expanded={abierta} onClick={() => setAbiertaManual(!abierta)}
              className="flex min-h-10 items-center gap-2 rounded-[10px] px-1 text-left">
              <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', !abierta && '-rotate-90')} aria-hidden="true" />
              <span>{unidad && <span className="font-medium text-muted-foreground">Unidad {unidad.orden} · </span>}{titulo}</span>
            </button>
          </h3>
          {estado}
          {rango && <span className="text-sm text-muted-foreground tabular-nums">{rango}</span>}
          {!abierta && (
            <span className="text-sm text-muted-foreground">
              {tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}{promedio && <> · promedio <span className="font-medium text-foreground tabular-nums">{promedio}</span></>}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {finalizada ? (
              <Button variant="ghost" size="sm" onClick={() => onCerrarUnidad(unidad, faltan)} disabled={cerrando}>
                <FolderDown aria-hidden="true" />{cerrando ? 'Descargando…' : 'Descargar cierre'}
              </Button>
            ) : puedeCrear && (
              <Button variant="ghost" size="sm" onClick={() => { setAbiertaManual(true); setCreando(true) }}>
                <Plus aria-hidden="true" />Tarea
              </Button>
            )}
            {unidad && (
              <MenuAcciones label={`Más acciones de la Unidad ${unidad.orden}`} items={[
                !finalizada && { label: 'Cerrar unidad y descargar cierre', icon: Lock, onSelect: () => onCerrarUnidad(unidad, faltan) },
                { separator: true },
                { label: 'Reporte de la unidad en Excel', icon: FileSpreadsheet, onSelect: () => onReporte('excel', { unidadId: unidad.id }) },
                { label: 'Reporte de la unidad en PDF', icon: FileDown, onSelect: () => onReporte('pdf', { unidadId: unidad.id }) },
              ]} />
            )}
          </div>
        </div>

        {abierta && (
          <>
            <ul className="@container border-t border-border">
              {tareas.map((tarea) => (
                <FilaTarea key={tarea.id} tarea={tarea} items={menuTarea(tarea)} publicando={procesando === `tarea-${tarea.id}`}
                  onPublicar={() => onPublicar(tarea)} />
              ))}
              {creando && (
                <NuevaTareaRapida unidad={unidad} formularioCompleto={formularioCompleto} onCancelar={() => setCreando(false)}
                  onCrear={async (datos) => { await onCrearBorrador(unidad, datos); setCreando(false) }} />
              )}
              {!tareas.length && !creando && (
                <li className="px-5 py-5 text-sm text-muted-foreground">
                  Sin tareas planeadas.
                  {puedeCrear && (
                    <>
                      {' '}
                      <button type="button" onClick={() => setCreando(true)} className="font-medium text-primary-ink underline-offset-4 hover:underline">Planear la primera</button>
                    </>
                  )}
                </li>
              )}
            </ul>
            {activa && tareas.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <p className="text-sm text-muted-foreground">
                  {porCalificar === 0 && borradores === 0 && recibiendo === 0
                    ? <><Check className="mr-1 inline size-4 text-success" aria-hidden="true" />Todo calificado. La unidad está lista para cerrarse.</>
                    : <>Antes de cerrar:{' '}{unirConPuntos([
                      porCalificar > 0 && <span key="c"><span className="font-medium text-foreground tabular-nums">{porCalificar}</span> por calificar</span>,
                      recibiendo > 0 && <span key="r"><span className="font-medium text-foreground tabular-nums">{recibiendo}</span> {recibiendo === 1 ? 'tarea recibe' : 'tareas reciben'} entregas</span>,
                      borradores > 0 && <span key="b"><span className="font-medium text-foreground tabular-nums">{borradores}</span> {borradores === 1 ? 'borrador' : 'borradores'}</span>,
                    ])}</>}
                </p>
                <Button variant="outline" size="sm" onClick={() => onCerrarUnidad(unidad, faltan)} disabled={cerrando}>
                  <Lock aria-hidden="true" />{cerrando ? 'Cerrando…' : 'Cerrar unidad'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  )
}
