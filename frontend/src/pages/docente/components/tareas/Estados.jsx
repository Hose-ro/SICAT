import { Check, CheckCheck, CircleDashed, Clock3, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ESTADO_DOCENTE_LABEL, TASK_STATE_LABEL } from '@/lib/tareas'

const TONO = {
  warning: 'bg-warning/15 text-warning-foreground',
  success: 'bg-success/10 text-success-foreground',
  destructive: 'bg-destructive/10 text-destructive-foreground',
  neutral: 'bg-muted text-foreground',
  muted: 'bg-muted text-muted-foreground',
  accent: 'bg-accent text-primary-ink',
}

const TONO_ENTREGA = { ENTREGADA: 'warning', REVISADA: 'success', CALIFICADA: 'success', INCORRECTA: 'neutral', NO_ENTREGADA: 'destructive', PENDIENTE: 'muted' }
const ICONO_ENTREGA = { ENTREGADA: Clock3, REVISADA: CheckCheck, CALIFICADA: Check, INCORRECTA: Undo2, NO_ENTREGADA: CircleDashed, PENDIENTE: CircleDashed }
const TONO_TAREA = { BORRADOR: 'muted', PUBLICADA: 'success', VENCIDA: 'warning', CERRADA: 'neutral' }

export function Chip({ tone = 'neutral', className, children }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', TONO[tone], className)}>
      {children}
    </span>
  )
}

/** Estado de una entrega desde el punto de vista del docente; `estado` viene de estadoDocente(). */
export function EstadoEntregaChip({ estado, entrega, className }) {
  const Icon = ICONO_ENTREGA[estado] ?? CircleDashed
  const nota = estado === 'CALIFICADA' && typeof entrega?.calificacion === 'number' ? entrega.calificacion : null
  const tipo = estado === 'CALIFICADA' && entrega?.calificacionTipo && entrega.calificacionTipo !== 'NUMERICA'
    ? (entrega.calificacionTipo === 'FIRMA' ? 'Firma' : 'Revisado')
    : null
  return (
    <Chip tone={TONO_ENTREGA[estado] ?? 'muted'} className={className}>
      <Icon className="size-3.5" aria-hidden="true" />
      {ESTADO_DOCENTE_LABEL[estado] ?? estado}
      {nota !== null && <span className="font-semibold tabular-nums">· {nota}</span>}
      {tipo && <span>· {tipo}</span>}
    </Chip>
  )
}

export function EstadoTareaChip({ estado, className }) {
  return <Chip tone={TONO_TAREA[estado] ?? 'neutral'} className={className}>{TASK_STATE_LABEL[estado] ?? estado}</Chip>
}

/** Tecla modificadora del sistema para los atajos (⌘ en Mac, Ctrl en lo demás). */
export function TeclaModificadora() {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}
