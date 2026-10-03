import { useState } from 'react'
import { ArrowDown, ArrowUp, BellRing, Check, ChevronDown, Loader2, Search, Undo2 } from 'lucide-react'
import SexoBadge from '@/components/SexoBadge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fechaCorta, horaCorta } from '@/lib/tareas'
import { Kbd } from './Estados'
import { Segmentado } from './Controles'
import TiraEntregas from './TiraEntregas'

function Linea({ fila, presencial }) {
  const { entrega, estado } = fila
  if (estado === 'ENTREGADA') return <>Entregó {fechaCorta(entrega.fechaEntrega)}, {horaCorta(entrega.fechaEntrega)}{entrega.fueTardia && ' · tardía'}</>
  if (estado === 'CALIFICADA') return <>Calificada{entrega.fueTardia && ' · tardía'}</>
  if (estado === 'REVISADA') return 'Revisada'
  if (estado === 'INCORRECTA') return entrega.permiteCorreccion ? 'Devuelta para corregir' : 'Devuelta'
  if (presencial) return estado === 'NO_ENTREGADA' ? 'No presentó · 0' : 'Sin calificar'
  return estado === 'NO_ENTREGADA' ? 'Sin entregar' : 'Aún no entrega'
}

function Marca({ fila, guardando, reciente }) {
  const { entrega, estado } = fila
  if (guardando) return <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Guardando" />
  if (estado === 'CALIFICADA') {
    return typeof entrega.calificacion === 'number'
      ? <span key={reciente ?? 'fija'} className={cn('text-sm font-semibold tabular-nums text-foreground', reciente && 'tarea-asentar')}>{entrega.calificacion}</span>
      : <Check className="size-4 text-success" aria-label="Calificada" />
  }
  if (estado === 'ENTREGADA') return <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
  if (estado === 'REVISADA') return <Check className="size-4 text-success" aria-hidden="true" />
  if (estado === 'INCORRECTA') return <Undo2 className="size-4 text-muted-foreground" aria-hidden="true" />
  if (estado === 'NO_ENTREGADA') return <span className="size-2 rounded-full bg-destructive" aria-hidden="true" />
  return null
}

/** Lista del grupo para moverse entre entregas: filtros, búsqueda y quién falta. */
export default function ListaRevision({
  filas, visibles, r, presencial, vencida, filtro, onFiltro, busqueda, onBusqueda, soloTardias, onSoloTardias,
  seleccion, onSeleccion, guardando, reciente, recordado, recordando, onRecordar,
}) {
  const [abierta, setAbierta] = useState(false)
  const mensajeVacio = busqueda || soloTardias ? 'Nadie coincide con la búsqueda.'
    : filtro === 'ENTREGADA' ? 'Sin entregas pendientes. Elige «Todos» para ver al grupo completo.'
      : filtro === 'SIN' ? 'Todos entregaron.' : 'Sin alumnos en esta tarea.'

  return (
    <aside aria-label="Alumnos del grupo" className="rounded-[var(--radius-card)] border border-border bg-card @min-[40rem]:col-span-2 @min-[56rem]:sticky @min-[56rem]:top-4 @min-[56rem]:col-span-1">
      <div className="border-b border-border p-4">
        <p className="text-sm font-medium text-foreground tabular-nums">
          {presencial ? `${r.calificadas + r.noPresentaron} de ${r.total} calificados` : `${r.calificadas + r.revisadas} de ${r.entregadas} revisadas`}
        </p>
        <TiraEntregas filas={filas} enClase={presencial} ajustar className="mt-3" />
        <Segmentado apilado className="mt-3 w-full" label="Filtrar alumnos" value={filtro} onChange={onFiltro} options={[
          { value: 'ENTREGADA', label: 'Por calificar', count: r.porCalificar, tono: r.porCalificar ? 'text-warning-foreground' : undefined },
          { value: 'TODAS', label: 'Todos', count: r.total },
          { value: 'SIN', label: 'Faltan', count: r.sinEntregar, tono: r.sinEntregar && vencida ? 'text-destructive-foreground' : undefined },
        ]} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[7rem] flex-1">
            <span className="sr-only">Buscar alumno por nombre o número de control</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={busqueda} onChange={(event) => onBusqueda(event.target.value)} placeholder="Buscar"
              className="h-9 w-full rounded-[10px] border border-input bg-background pl-8 pr-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
          </label>
          {r.tardias > 0 && (
            <button type="button" aria-pressed={soloTardias} onClick={() => onSoloTardias(!soloTardias)}
              className={cn('h-9 shrink-0 rounded-[10px] border px-2.5 text-xs font-medium transition-colors duration-150',
                soloTardias ? 'border-warning/40 bg-warning/15 text-warning-foreground' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground')}>
              Tardías <span className="tabular-nums">{r.tardias}</span>
            </button>
          )}
        </div>
      </div>

      <button type="button" onClick={() => setAbierta((valor) => !valor)} aria-expanded={abierta}
        className="flex min-h-11 w-full items-center justify-between border-b border-border px-4 text-sm font-medium text-foreground @min-[56rem]:hidden">
        {abierta ? 'Ocultar la lista' : `Ver la lista (${visibles.length})`}
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-200', abierta && 'rotate-180')} aria-hidden="true" />
      </button>
      <ul className={cn('max-h-[min(58vh,34rem)] overflow-y-auto p-2', !abierta && 'hidden @min-[56rem]:block')}>
        {visibles.map((fila) => {
          const activa = fila.alumno.id === seleccion
          return (
            <li key={fila.alumno.id}>
              <button type="button" onClick={() => onSeleccion(fila.alumno.id)} aria-current={activa ? 'true' : undefined}
                className={cn('flex min-h-12 w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-muted',
                  activa && 'bg-accent hover:bg-accent')}>
                <SexoBadge sexo={fila.alumno.sexo} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{fila.alumno.nombre}</span>
                  <span className="block truncate text-xs text-muted-foreground"><Linea fila={fila} presencial={presencial} /></span>
                </span>
                <Marca fila={fila} guardando={guardando[fila.alumno.id]} reciente={reciente?.alumnoId === fila.alumno.id ? reciente.seq : null} />
              </button>
            </li>
          )
        })}
        {!visibles.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{mensajeVacio}</li>}
      </ul>

      {filtro === 'SIN' && r.sinEntregar > 0 && !presencial && (
        <div className="border-t border-border p-3">
          <Button variant="outline" className="w-full" onClick={onRecordar} disabled={recordado || recordando}>
            <BellRing aria-hidden="true" />
            {recordado ? 'Recordatorio enviado' : recordando ? 'Enviando…' : `Recordar a ${r.sinEntregar === 1 ? 'quien falta' : `los ${r.sinEntregar} que faltan`}`}
          </Button>
        </div>
      )}
      <p className="hidden items-center gap-1.5 border-t border-border px-4 py-3 text-xs text-muted-foreground @min-[56rem]:flex">
        <Kbd><ArrowUp className="size-3" aria-label="Flecha arriba" /></Kbd>
        <Kbd><ArrowDown className="size-3" aria-label="Flecha abajo" /></Kbd>
        cambiar de alumno
      </p>
    </aside>
  )
}
