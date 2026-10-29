import { cn } from '@/lib/utils'
import { formatoNota, tipoCalificacion } from './formato'

/** Promedio de SICAT de un alumno: definitivo solo si todas sus unidades están cerradas o capturadas. */
export function Promedio({ r }) {
  if (r.tipo === 'SIN_CAPTURA') return <span className="text-muted-foreground">Sin captura</span>
  return (
    <span className="inline-flex flex-col items-end">
      <span className="font-semibold tabular-nums text-foreground">{formatoNota(r.promedio)}</span>
      <span className="text-xs text-muted-foreground">{r.tipo === 'REAL' ? 'Definitivo' : 'Provisional'} · {r.calificadas} de {r.unidades} unidades</span>
    </span>
  )
}

/** Calificación de una unidad; sin captura nunca se muestra como cero. */
export function Nota({ row }) {
  if (!row) return <span className="text-muted-foreground">—</span>
  const tipo = tipoCalificacion(row)
  if (tipo === 'SIN_CAPTURA') return <span className="text-xs text-muted-foreground">Sin captura</span>
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn('tabular-nums', tipo === 'REAL' ? 'font-semibold text-foreground' : 'text-foreground')}>{formatoNota(row.calificacionFinal)}</span>
      {tipo === 'PROVISIONAL' && <span className="text-xs text-muted-foreground">Provisional</span>}
    </span>
  )
}

