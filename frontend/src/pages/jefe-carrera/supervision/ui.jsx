import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Check, Copy, LoaderCircle, Mail, Phone, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/utils'
import { horaCorta, periodoTexto } from './formato'
import { useJefatura, useResumen } from './useJefatura'

export const selectClass = 'h-11 w-full rounded-[0.7rem] border border-border bg-card pl-3 pr-8 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40'
export const linkClass = 'font-medium text-primary-ink underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40'

/**
 * Marco de cada vista de jefatura: resuelve carrera y periodo, muestra su
 * contexto y los estados sin datos antes de entregar el resumen a la vista.
 */
export function JefaturaPage({ titulo, subtitulo, accion, volver, children, sinResumen = false }) {
  const j = useJefatura()
  const resumen = useResumen(sinResumen ? {} : { carreraId: j.carreraId, periodo: j.periodo })

  // En un expediente el título es la entidad (grupo, docente, materia), resuelta con el resumen.
  const texto = typeof titulo === 'function' ? (resumen.data && titulo(resumen.data)) || 'Expediente' : titulo
  const sub = typeof subtitulo === 'function' ? resumen.data && subtitulo(resumen.data) : subtitulo
  const encabezado = <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-foreground">{texto}</h1>
  if (j.cargando) return <>{encabezado}<Esqueleto compacto /></>
  if (j.error) return <>{encabezado}<Aviso tono="error" titulo="No se pudo abrir la jefatura" accion={<Button variant="outline" onClick={j.reintentar}>Reintentar</Button>}>{j.error}</Aviso></>
  if (!j.carreras.length) {
    return <>{encabezado}<Aviso titulo="Sin carrera asignada">Tu cuenta de jefatura todavía no tiene una carrera activa. Coordinación puede asignarla desde Usuarios.</Aviso></>
  }
  if (!j.carreraId) return <ElegirCarrera j={j} />

  return (
    <div className="jefatura">
      <ContextoBar j={j} resumen={sinResumen ? null : resumen} />
      {volver && (
        <Link to={j.to(volver.to)} className={cn(linkClass, 'mt-4 inline-flex min-h-11 items-center gap-1 text-sm')}>
          <ArrowLeft className="size-4" aria-hidden="true" /> {volver.label}
        </Link>
      )}
      <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', volver ? 'pt-1' : 'pt-7')}>
        <div className="min-w-0">
          {encabezado}
          {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
      {resumen.denegado ? (
        <Aviso tono="error" titulo="Fuera de tu alcance">Esta carrera no está asignada a tu jefatura.</Aviso>
      ) : !sinResumen && resumen.cargando ? (
        <Esqueleto compacto />
      ) : !sinResumen && !resumen.data ? (
        <Aviso tono="error" titulo="No se pudo cargar el periodo" accion={<Button variant="outline" onClick={resumen.reintentar}>Reintentar</Button>}>{resumen.error}</Aviso>
      ) : (
        children({ j, resumen: resumen.data, estado: resumen })
      )}
    </div>
  )
}

function ContextoBar({ j, resumen }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 text-[0.8125rem] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
        {j.carreras.length > 1 ? (
          <label className="min-w-0">
            <span className="sr-only">Carrera</span>
            <select value={j.carreraId} onChange={(e) => j.setCarrera(e.target.value)} className={cn(selectClass, 'h-9 max-w-[22rem] font-medium')}>
              {j.carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        ) : (
          <strong className="font-medium text-foreground">{j.carrera?.nombre}</strong>
        )}
        <span aria-hidden="true" className="text-muted-foreground">·</span>
        <label>
          <span className="sr-only">Periodo escolar</span>
          <select value={j.periodo} onChange={(e) => j.setPeriodo(e.target.value)} className={cn(selectClass, 'h-9 w-auto font-medium')}>
            {j.periodos.map((p) => <option key={p} value={p}>{periodoTexto(p)}{p === j.periodoActual ? ' (actual)' : ''}</option>)}
          </select>
        </label>
        {j.historico && <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">Histórico · solo consulta</span>}
      </div>
      {resumen && <EstadoActualizacion resumen={resumen} />}
    </div>
  )
}

function EstadoActualizacion({ resumen }) {
  if (resumen.error && resumen.data) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-warning-foreground">
        <AlertCircle className="size-3.5" aria-hidden="true" />
        Sin actualizar desde {horaCorta(resumen.actualizado)}
        <Button variant="outline" size="sm" onClick={resumen.reintentar}><RefreshCw aria-hidden="true" /> Reintentar</Button>
      </div>
    )
  }
  if (!resumen.actualizado) return null
  return (
    <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {resumen.actualizando && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
      {resumen.actualizando ? 'Actualizando…' : `Datos al ${new Date(resumen.actualizado).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
    </p>
  )
}

function ElegirCarrera({ j }) {
  return (
    <section className="mx-auto max-w-xl py-10">
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.025em] text-foreground">Elige una carrera</h1>
      <p className="mt-2 text-sm text-muted-foreground">Tienes varias carreras asignadas. Cada vista muestra una sola, para no mezclar cifras ni expedientes.</p>
      <ul className="mt-6 divide-y divide-border rounded-[var(--radius-item)] border border-border bg-card">
        {j.carreras.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => j.setCarrera(c.id)} className="flex min-h-14 w-full items-center justify-between gap-4 px-4 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
              <span className="font-medium text-foreground">{c.nombre}</span>
              <span className="text-xs text-muted-foreground">{c.codigo}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Esqueleto({ compacto = false }) {
  return (
    <div aria-busy="true" aria-label="Cargando información" className="space-y-4 pt-7">
      {!compacto && <div className="h-9 w-1/2 animate-pulse rounded-lg bg-muted" />}
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
      <div className="h-72 animate-pulse rounded-[var(--radius-card)] bg-muted" />
    </div>
  )
}

export function Aviso({ tono = 'neutral', titulo, children, accion }) {
  return (
    <div role={tono === 'error' ? 'alert' : undefined} className={cn('mt-6 rounded-[var(--radius-item)] border px-5 py-5 text-sm', tono === 'error' ? 'border-destructive/25 bg-destructive/5' : 'border-border bg-card')}>
      <p className={cn('font-semibold', tono === 'error' ? 'text-destructive-foreground' : 'text-foreground')}>{titulo}</p>
      {children && <div className="mt-1 text-muted-foreground">{children}</div>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

export function Vacio({ titulo, children, accion }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] text-muted-foreground">{children}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

/** Selector de dos o tres opciones; los botones reflejan su estado con aria-pressed. */
export function Segmento({ label, value, onChange, options }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-xl bg-muted p-[3px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="min-h-[38px] rounded-[9px] border border-transparent px-4 text-[0.8125rem] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-border aria-pressed:bg-card aria-pressed:font-medium aria-pressed:text-foreground max-md:min-h-11"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Pestañas como enlaces: cada vista queda en la URL y el botón Atrás funciona. */
export function Pestanas({ label, items, activa }) {
  return (
    <nav aria-label={label} className="-mx-1 mt-6 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-1 px-1">
        {items.map((item) => (
          <li key={item.value}>
            <Link
              to={item.to}
              replace
              aria-current={activa === item.value ? 'page' : undefined}
              className="relative inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary"
            >
              {item.label}
              {item.count != null && <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">{item.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Línea de pendientes accionables. Una cifra en cero se lee «Sin pendientes»;
 * si la consulta falló no se muestra ninguna cifra.
 */
export function Senales({ items, nota }) {
  return (
    <div className="mt-6 flex flex-wrap items-center border-y border-border py-2">
      {items.map((item, index) => (
        <Link
          key={item.label}
          to={item.to}
          className={cn(
            'flex min-h-11 items-center gap-2 pr-5 text-[0.8125rem] text-foreground hover:text-primary-ink focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
            index > 0 && 'border-l border-border pl-5 max-sm:border-l-0 max-sm:pl-0',
          )}
        >
          {item.value > 0 ? (
            <>
              <span aria-hidden="true" className="size-[7px] rounded-full bg-warning" />
              <b className="text-[1.0625rem] font-semibold tabular-nums">{item.value}</b>
              <span>{item.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{item.vacio}</span>
          )}
        </Link>
      ))}
      {nota && <span className="ml-auto text-xs text-muted-foreground max-lg:mt-1 max-lg:w-full max-lg:ml-0">{nota}</span>}
    </div>
  )
}

export function SeccionTitulo({ titulo, descripcion, accion, id }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[1.1875rem] font-semibold tracking-[-0.015em] text-foreground">{titulo}</h2>
        {descripcion && <p className="mt-1 text-xs text-muted-foreground">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}

/** Acciones de contacto: preparan el mensaje o la llamada; la persona decide enviarlo. */
export function Contacto({ persona, compacto = false }) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const { email, telefono } = persona ?? {}
  if (!email && !telefono) return <span className="text-xs text-muted-foreground">Sin contacto registrado</span>

  const copiar = async () => {
    const texto = [persona.nombre, email, telefono].filter(Boolean).join(' · ')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopiado(false), 2000)
    } catch { /* el navegador no permitió copiar */ }
  }
  const size = compacto ? 'sm' : 'default'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {email && (
        <a href={`mailto:${email}`} className={buttonVariants({ variant: 'outline', size })}>
          <Mail aria-hidden="true" /> Preparar correo
        </a>
      )}
      {telefono && (
        <a href={`tel:${telefono.replace(/\s+/g, '')}`} className={buttonVariants({ variant: 'outline', size })}>
          <Phone aria-hidden="true" /> Llamar
        </a>
      )}
      <Button variant="ghost" size={size} onClick={copiar}>
        {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar contacto'}</span>
      </Button>
    </div>
  )
}

const NOTA_TONO = {
  REAL: 'text-foreground',
  PROVISIONAL: 'text-muted-foreground',
  SIN_CAPTURA: 'text-muted-foreground',
}

export function Cifra({ value, label, tono }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-[1.0625rem] font-semibold tabular-nums', tono ?? 'text-foreground')}>{value}</dd>
    </div>
  )
}

export { NOTA_TONO }
