import { Check, CheckCheck, CircleDashed, Clock3, Undo2 } from 'lucide-react'
import { Chip } from '@/components/Chip'
import { ESTADO_DOCENTE_LABEL, TASK_STATE_LABEL } from '@/lib/tareas'

export { Chip }

const TONO_ENTREGA = { ENTREGADA: 'warning', REVISADA: 'success', CALIFICADA: 'success', INCORRECTA: 'neutral', NO_ENTREGADA: 'destructive', PENDIENTE: 'muted' }
const ICONO_ENTREGA = { ENTREGADA: Clock3, REVISADA: CheckCheck, CALIFICADA: Check, INCORRECTA: Undo2, NO_ENTREGADA: CircleDashed, PENDIENTE: CircleDashed }
const TONO_TAREA = { BORRADOR: 'muted', PUBLICADA: 'success', VENCIDA: 'warning', CERRADA: 'neutral' }

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
