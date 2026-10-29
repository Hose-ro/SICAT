import { useId, useState } from 'react'
import { ChevronDown, Clock, ExternalLink, FileCheck2, MapPin, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ESTADO_REUNION, TIPO_REUNION, diaMes, horarioReunion, lugarReunion } from '@/lib/reuniones'

const fechaCorta = (clave) => {
  const [y, m, d] = clave.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/**
 * Una reunión en lista: fecha, título, hora y lugar a la vista; orden del día,
 * acuerdos y (para la jefatura) convocados al desplegar. `acciones` va a la
 * derecha del encabezado, `aviso` siempre visible bajo él, `barra` junto a
 * "Ver detalle" (p. ej. "Ver acta") y `pie` debajo del detalle.
 */
export default function ReunionTarjeta({ reunion: r, acciones, aviso, barra, pie, abiertaInicial = false, mostrarConvocados = false, extra }) {
  const id = useId()
  const [abierta, setAbierta] = useState(abiertaInicial)
  const { dia, mes, semana } = diaMes(r.fecha)
  const estado = ESTADO_REUNION[r.estado] ?? ESTADO_REUNION.PROGRAMADA
  const cancelada = r.estado === 'CANCELADA'

  return (
    <li className="rounded-[var(--radius-item)] border border-border bg-card">
      <div className="flex gap-4 p-4">
        <div aria-hidden="true" className={cn('flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted py-2 text-center leading-none', cancelada && 'opacity-60')}>
          <span className="text-[0.6875rem] uppercase text-muted-foreground">{semana}</span>
          <span className="mt-1 text-xl font-semibold tabular-nums text-foreground">{dia}</span>
          <span className="mt-1 text-[0.6875rem] uppercase text-muted-foreground">{mes}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className={cn('text-[0.9375rem] font-semibold text-foreground', cancelada && 'line-through decoration-muted-foreground')}>{r.titulo}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', estado.clase)}>{estado.label}</span>
            {r.tipo === 'EXTRAORDINARIA' && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{TIPO_REUNION[r.tipo]}</span>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden="true" /><span className="sr-only">Hora: </span>{horarioReunion(r)}</span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {r.modalidad === 'VIRTUAL' ? <Video className="size-3.5 shrink-0" aria-hidden="true" /> : <MapPin className="size-3.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{lugarReunion(r)}</span>
            </span>
            {extra}
            {r.documentos?.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-success-foreground">
                <FileCheck2 className="size-3.5" aria-hidden="true" />
                Acta firmada: {r.documentos.map((d) => (d.formato === 'DOCX' ? 'Word' : 'PDF')).join(' · ')}
              </span>
            )}
          </p>
          {r.asunto && <p className="mt-1.5 line-clamp-2 text-[0.8125rem] text-foreground">{r.asunto}</p>}
        </div>
        {acciones && <div className="hidden shrink-0 items-start gap-2 sm:flex">{acciones}</div>}
      </div>
      {aviso}

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
        <Button variant="ghost" size="sm" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((v) => !v)}>
          {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          <ChevronDown aria-hidden="true" className={cn('transition-transform duration-150 ease-out', abierta && 'rotate-180')} />
        </Button>
        {barra}
        {acciones && <div className="ml-auto flex flex-wrap gap-2 sm:hidden">{acciones}</div>}
      </div>

      {abierta && (
        <div id={id} className="grid gap-5 border-t border-border px-4 py-4 text-[0.8125rem] md:grid-cols-2">
          <section>
            <h4 className="text-xs font-medium text-muted-foreground">Orden del día</h4>
            {r.puntos.length ? (
              <ol className="mt-1.5 space-y-1">
                {r.puntos.map((p) => (
                  <li key={p.id} className="flex gap-2"><span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{p.orden}.</span><span className="text-foreground">{p.descripcion}</span></li>
                ))}
              </ol>
            ) : <p className="mt-1.5 text-muted-foreground">Sin puntos registrados.</p>}
            {r.modalidad === 'VIRTUAL' && r.enlace && !cancelada && (
              <a href={r.enlace} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-medium text-primary-ink underline-offset-4 hover:underline">
                Abrir videollamada <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </section>

          <section>
            <h4 className="text-xs font-medium text-muted-foreground">Acuerdos</h4>
            {r.acuerdos.length ? (
              <ol className="mt-1.5 space-y-2">
                {r.acuerdos.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{a.orden}.</span>
                    <span className="min-w-0">
                      <span className="text-foreground">{a.descripcion}</span>
                      {(a.responsable || a.fechaLimite) && (
                        <span className="block text-xs text-muted-foreground">
                          {[a.responsable && `Responsable: ${a.responsable}`, a.fechaLimite && `Fecha límite: ${fechaCorta(a.fechaLimite)}`].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-1.5 text-muted-foreground">{r.estado === 'FINALIZADA' ? 'No se registraron acuerdos.' : 'Se registran al capturar el acta.'}</p>}
            {r.observaciones && (
              <>
                <h4 className="mt-4 text-xs font-medium text-muted-foreground">Observaciones</h4>
                <p className="mt-1.5 whitespace-pre-line text-foreground">{r.observaciones}</p>
              </>
            )}
          </section>

          {mostrarConvocados && (
            <section className="md:col-span-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Convocados ({r.convocados.length}){r.asistencia?.registrada && ` · asistieron ${r.asistencia.asistieron}`}
              </h4>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {r.convocados.map((d) => (
                  <li key={d.id} className={cn('rounded-md border border-border px-2 py-0.5 text-xs', d.asistio === false ? 'border-dashed text-muted-foreground line-through' : 'text-foreground')}>
                    {d.nombre}
                  </li>
                ))}
              </ul>
              {r.clasesJustificadas?.length > 0 && (
                <>
                  <h4 className="mt-4 text-xs font-medium text-muted-foreground">Clases sin clase por esta reunión</h4>
                  <ul className="mt-1.5 space-y-1">
                    {r.clasesJustificadas.map((j) => (
                      <li key={j.horarioId} className="text-foreground">
                        {j.docente ?? 'Docente'} · {j.materia}{j.grupo && ` · ${j.grupo}`} <span className="tabular-nums text-muted-foreground">{j.horaInicio}–{j.horaFin}</span>
                        {j.avisarAlumnos === false && <span className="text-xs text-muted-foreground"> · sin aviso a alumnos</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {pie && <div className="md:col-span-2">{pie}</div>}
        </div>
      )}
    </li>
  )
}
