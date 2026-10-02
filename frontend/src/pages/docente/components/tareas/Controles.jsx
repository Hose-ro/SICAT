import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function limpiarSeparadores(items) {
  const lista = items.filter(Boolean)
  return lista.filter((item, i) => !item.separator || (i > 0 && i < lista.length - 1 && !lista[i - 1].separator))
}

/** Menú «⋯» con acciones secundarias. `items`: [{ label, icon, onSelect, variant, disabled } | { separator: true }] */
export function MenuAcciones({ label, items, className, trigger, align = 'end' }) {
  const lista = limpiarSeparadores(items)
  if (!lista.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label}
        className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-muted hover:text-foreground active:translate-y-px aria-expanded:bg-muted aria-expanded:text-foreground', className)}>
        {trigger ?? <MoreHorizontal className="size-4" aria-hidden="true" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-auto min-w-56">
        {lista.map((item, i) => (item.separator
          ? <DropdownMenuSeparator key={`separador-${i}`} />
          : (
            <DropdownMenuItem key={item.label} variant={item.variant} disabled={item.disabled} onClick={item.onSelect} className="py-1.5">
              {item.icon && <item.icon aria-hidden="true" />}
              {item.label}
            </DropdownMenuItem>
          )))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Grupo de opciones excluyentes con el estilo de pestañas compactas.
 * `apilado` pone la cifra arriba y la etiqueta abajo (filtros con conteo).
 */
export function Segmentado({ label, value, onChange, options, className, apilado = false }) {
  // Flechas para moverse entre opciones, como cualquier grupo de radios.
  const onKeyDown = (event) => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!paso) return
    event.preventDefault()
    const actual = options.findIndex((option) => option.value === value)
    const siguiente = options[(actual + paso + options.length) % options.length]
    onChange(siguiente.value)
    event.currentTarget.parentElement?.querySelector(`[data-valor="${String(siguiente.value)}"]`)?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label}
      className={cn(apilado ? 'grid auto-cols-fr grid-flow-col' : 'inline-flex max-w-full overflow-x-auto', 'rounded-[12px] border border-border bg-muted p-0.5', className)}>
      {options.map((option, index) => {
        const activo = value === option.value
        const enfocable = activo || (index === 0 && !options.some((item) => item.value === value))
        return (
          <button key={option.value} type="button" role="radio" aria-checked={activo} tabIndex={enfocable ? 0 : -1}
            data-valor={String(option.value)} onClick={() => onChange(option.value)} onKeyDown={onKeyDown}
            className={cn(
              'rounded-[10px] text-muted-foreground transition-colors duration-150 hover:text-foreground',
              apilado ? 'flex min-w-0 flex-col items-center px-1 py-1.5' : 'inline-flex h-8 shrink-0 items-center gap-1.5 px-3 text-[13px] font-medium',
              activo && 'bg-card text-foreground ring-1 ring-border',
            )}>
            {apilado ? (
              <>
                <span className={cn('text-base font-semibold leading-tight tabular-nums', option.tono)}>{option.count}</span>
                <span className="max-w-full text-center text-[11px] font-medium leading-tight">{option.label}</span>
              </>
            ) : (
              <>
                {option.label}
                {option.count !== undefined && <span className="tabular-nums opacity-80">{option.count}</span>}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
