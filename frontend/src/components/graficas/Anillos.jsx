import { cn } from '@/lib/utils'
import { tonoRegistro } from './util'
import './graficas.css'

const VISTA = 56
const centro = VISTA / 2

/**
 * Anillo de progreso con el porcentaje al centro. El trazo se dibuja desde vacío
 * al montar; `--i` en un ancestro escalona la entrada en listas.
 */
export function AnilloProgreso({ pct, grosor = 5, className, etiqueta, children }) {
  const r = centro - grosor / 2 - 0.5
  const c = 2 * Math.PI * r
  const tono = tonoRegistro(pct)
  return (
    <div className={cn('relative size-16 shrink-0', className)}>
      <svg viewBox={`0 0 ${VISTA} ${VISTA}`} className="size-full -rotate-90" aria-hidden="true">
        <circle cx={centro} cy={centro} r={r} fill="none" strokeWidth={grosor} className="stroke-muted" />
        {pct > 0 && (
          <circle
            cx={centro} cy={centro} r={r} fill="none" strokeWidth={grosor} strokeLinecap="round"
            className={cn('anillo-trazo', `anillo-${tono}`)}
            style={{ '--vacio': c, strokeDasharray: c, strokeDashoffset: c * (1 - Math.min(pct, 100) / 100) }}
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        {children ?? (
          <span className={cn('text-[0.8125rem] font-semibold tabular-nums', tono ? `anillo-texto-${tono}` : 'text-muted-foreground')}>
            {etiqueta && <span className="sr-only">{etiqueta}: </span>}{pct == null ? '—' : `${pct}%`}
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * Anillo partido en segmentos ({ valor, tono }) que suman el total. Cada tramo
 * se dibuja en orden, con un hueco pequeño entre ellos.
 */
export function AnilloSegmentos({ segmentos, grosor = 5, className, children }) {
  const r = centro - grosor / 2 - 0.5
  const c = 2 * Math.PI * r
  const total = segmentos.reduce((n, s) => n + s.valor, 0)
  const visibles = segmentos.filter((s) => s.valor > 0)
  const hueco = visibles.length > 1 ? 1.5 : 0
  let inicio = 0
  return (
    <div className={cn('relative size-16 shrink-0', className)}>
      <svg viewBox={`0 0 ${VISTA} ${VISTA}`} className="size-full -rotate-90" aria-hidden="true">
        <circle cx={centro} cy={centro} r={r} fill="none" strokeWidth={grosor} className="stroke-muted" />
        {total > 0 && visibles.map((s, i) => {
          const largo = Math.max((s.valor / total) * c - hueco, 0.01)
          const offset = -inicio
          inicio += (s.valor / total) * c
          return (
            <circle
              key={s.tono}
              cx={centro} cy={centro} r={r} fill="none" strokeWidth={grosor}
              className={cn('anillo-tramo', `anillo-${s.tono}`)}
              style={{ '--largo': largo, '--orden': i, strokeDasharray: `${largo} ${c}`, strokeDashoffset: offset }}
            />
          )
        })}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">{children}</span>
    </div>
  )
}
