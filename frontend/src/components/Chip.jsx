import { cn } from '@/lib/utils'

const TONO = {
  warning: 'bg-warning/15 text-warning-foreground',
  success: 'bg-success/10 text-success-foreground',
  destructive: 'bg-destructive/10 text-destructive-foreground',
  neutral: 'bg-muted text-foreground',
  muted: 'bg-muted text-muted-foreground',
  accent: 'bg-accent text-primary-ink',
}

/** Etiqueta de estado con el tinte semántico del tono (siempre con texto). */
export function Chip({ tone = 'neutral', className, children }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', TONO[tone], className)}>
      {children}
    </span>
  )
}
