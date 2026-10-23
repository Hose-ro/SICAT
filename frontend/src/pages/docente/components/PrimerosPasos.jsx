import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, X } from 'lucide-react'
import { Chip } from '../../../components/Chip'
import { pasosDelDocente } from '../primerosPasos'

function leer(clave) {
  try { return localStorage.getItem(clave) } catch { return null }
}

function guardar(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch { /* sin almacenamiento */ }
}

export default function PrimerosPasos({ configuracion, materias = [], userId, onComoFunciona, principal = false }) {
  const claveGuia = `sicat.docente.guia.${userId}`
  const claveRevisado = `sicat.docente.revision.${userId}`
  const [estadoGuia, setEstadoGuia] = useState(() => leer(claveGuia))
  const [revisadoAqui, setRevisadoAqui] = useState(() => leer(claveRevisado) === 'hecho')
  // Quien ya pasó lista en alguna clase ya conoce a sus alumnos.
  const revisado = revisadoAqui || materias.some((materia) => materia.porcentajeAsistencia !== null)

  const pasos = pasosDelDocente({ configuracion, materias, revisado })
  const hechos = pasos.filter((paso) => paso.hecho).length
  const actual = pasos.findIndex((paso) => !paso.hecho)
  const completo = actual === -1
  const oculta = estadoGuia === 'oculta'

  // "Tu curso está listo" sólo tiene sentido para quien vio la guía a medias;
  // al docente que ya trabajaba en SICAT no se le muestra nada.
  useEffect(() => {
    if (!completo && !estadoGuia) guardar(claveGuia, 'en-curso')
  }, [completo, estadoGuia, claveGuia])

  const ocultar = (valor) => {
    const nuevo = valor ? 'oculta' : 'en-curso'
    setEstadoGuia(nuevo)
    guardar(claveGuia, nuevo)
  }

  if (completo && (oculta || estadoGuia !== 'en-curso')) return null
  if (oculta) {
    return (
      <p className="text-sm text-muted-foreground">
        <button type="button" className="inline-flex min-h-11 items-center font-medium text-primary-ink underline-offset-4 hover:underline md:min-h-0" onClick={() => ocultar(false)}>
          Primeros pasos · {hechos} de {pasos.length}
        </button>
      </p>
    )
  }

  return (
    <section id="primeros-pasos" tabIndex={-1} aria-labelledby="primeros-pasos-titulo" className={cn('rounded-[var(--radius-card)] border bg-card p-5 sm:p-6', principal ? 'border-primary/30' : 'border-border')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="primeros-pasos-titulo" className="text-xl font-semibold tracking-tight text-foreground">
            {completo ? 'Tu curso está listo' : principal ? 'Empieza por aquí' : 'Termina de preparar tu curso'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {completo
              ? 'Ya puedes pasar lista, dejar tareas y capturar calificaciones.'
              : `${hechos} de ${pasos.length} pasos listos. Síguelos en orden; cada uno se marca solo.`}
          </p>
        </div>
        {(completo || !principal) && (
          <Button variant="ghost" size="icon" aria-label="Ocultar primeros pasos" onClick={() => ocultar(true)}><X aria-hidden="true" /></Button>
        )}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Avance de los primeros pasos" aria-valuemin={0} aria-valuemax={pasos.length} aria-valuenow={hechos}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>

      {completo ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: 'outline' })} to="/asistencias">Pasar lista</Link>
          <Link className={buttonVariants({ variant: 'outline' })} to="/docente/tareas/crear">Nueva tarea</Link>
          <Link className={buttonVariants({ variant: 'outline' })} to="/calificaciones">Calificaciones</Link>
        </div>
      ) : (
        <ol className="mt-2">
          {pasos.map((paso, i) => {
            const esActual = i === actual
            return (
              <li key={paso.titulo} className={cn('flex flex-col gap-3 border-border py-4 sm:flex-row sm:items-center sm:gap-5', i > 0 && 'border-t')} aria-current={esActual ? 'step' : undefined}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums',
                    paso.hecho ? 'bg-success/15 text-success-foreground' : esActual ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {paso.hecho ? <Check className="size-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className={cn('font-medium', paso.hecho ? 'text-muted-foreground' : 'text-foreground')}>{paso.titulo}</b>
                    {paso.hecho && <Chip tone="success">Listo</Chip>}
                    {esActual && <Chip tone="accent">Empieza aquí</Chip>}
                  </p>
                  {!paso.hecho && <p className="mt-1 text-sm text-muted-foreground">{paso.detalle}</p>}
                  <span className="sr-only">{paso.hecho ? 'Paso completado.' : 'Paso pendiente.'}</span>
                </div>
                {!paso.hecho && (
                  <Link
                    className={buttonVariants({ variant: esActual ? 'default' : 'outline', className: 'min-h-11 self-start sm:min-h-0 sm:self-auto' })}
                    to={paso.destino}
                    onClick={paso.alAbrir ? () => { setRevisadoAqui(true); guardar(claveRevisado, 'hecho') } : undefined}
                  >
                    {paso.accion}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <p className="mt-2 border-t border-border pt-4 text-sm text-muted-foreground">
        ¿Primera vez aquí?{' '}
        <button type="button" className="font-medium text-primary-ink underline-offset-4 hover:underline" onClick={onComoFunciona}>Ver cómo funciona SICAT</button>
      </p>
    </section>
  )
}
