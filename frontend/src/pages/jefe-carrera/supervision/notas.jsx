import { cn } from '@/lib/utils'
import { formatoNota, tipoCalificacion } from './formato'

/** Promedio de SICAT de un alumno: definitivo solo si todas sus unidades están cerradas o capturadas. */
export function Promedio({ r, compacto = false }) {
  if (r.tipo === 'SIN_CAPTURA') return <span className="text-muted-foreground" aria-label="Sin captura">{compacto ? '—' : 'Sin captura'}</span>
  return (
    <span className={compacto ? 'inline-flex flex-wrap items-baseline justify-end gap-x-1' : 'inline-flex flex-col items-end'}>
      <span className={cn('font-semibold tabular-nums', compacto && r.promedio < 70 ? 'text-destructive-foreground' : 'text-foreground')}>{formatoNota(r.promedio)}</span>
      <span className="text-xs text-muted-foreground">{compacto ? (r.tipo === 'REAL' ? 'Def.' : 'Prov.') : <>{r.tipo === 'REAL' ? 'Definitivo' : 'Provisional'} · {r.calificadas} de {r.unidades} unidades</>}</span>
    </span>
  )
}

/** Calificación de una unidad; sin captura nunca se muestra como cero. */
export function Nota({ row, compacto = false }) {
  if (!row) return <span className="text-muted-foreground">—</span>
  const tipo = tipoCalificacion(row)
  if (tipo === 'SIN_CAPTURA') return <span className="text-xs text-muted-foreground" aria-label="Sin captura">{compacto ? '—' : 'Sin captura'}</span>
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn('tabular-nums', compacto && row.calificacionFinal < 70 ? 'font-semibold text-destructive-foreground' : tipo === 'REAL' ? 'font-semibold text-foreground' : 'text-foreground')}>{formatoNota(row.calificacionFinal)}</span>
      {!compacto && tipo === 'PROVISIONAL' && <span className="text-xs text-muted-foreground">Provisional</span>}
    </span>
  )
}

