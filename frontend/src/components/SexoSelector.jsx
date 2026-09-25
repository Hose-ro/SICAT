import { cn } from '@/lib/utils'
import { SEXOS } from '@/lib/datosAlumno'

/**
 * Dos botones, Hombre y Mujer: un clic asigna. Si todavía no hay valor el
 * borde se marca para que el docente vea de un vistazo a quién le falta.
 */
export default function SexoSelector({
  value,
  onChange,
  label = 'Sexo',
  busy = false,
  className,
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex shrink-0 overflow-hidden rounded-lg border text-xs font-medium',
        value ? 'border-border' : 'border-dashed border-warning',
        className,
      )}
    >
      {SEXOS.map(({ valor, etiqueta }, indice) => {
        const activo = value === valor
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={activo}
            onClick={() => {
              if (!busy && !activo) onChange(valor)
            }}
            className={cn(
              'min-w-[4.25rem] px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60',
              indice > 0 && 'border-l border-border',
              busy && 'cursor-wait',
              activo
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-muted',
            )}
          >
            {etiqueta}
          </button>
        )
      })}
    </div>
  )
}
