import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import AsistenciaSesionModal from '../components/AsistenciaSesionModal'
import { fechaHoraCorta, fechaLarga, minutos, modalidadTexto } from './formato'
import { estadoClase } from './estados'
import { linkClass } from './ui'

const CONFLICTO = {
  Docente: 'El docente tiene otra clase a la misma hora.',
  Grupo: 'El grupo tiene otra clase a la misma hora.',
  Aula: 'El aula está asignada a otra clase a la misma hora.',
}

function cruza(a, b) {
  return a.id !== b.id && a.fecha === b.fecha && minutos(a.horaInicio) < minutos(b.horaFin) && minutos(b.horaInicio) < minutos(a.horaFin)
}

/** Panel lateral de una clase. Escape lo cierra y el foco vuelve al bloque que lo abrió. */
export default function ClaseDetalle({ clase, clases = [], j, onClose }) {
  const [sesionAbierta, setSesionAbierta] = useState(null)
  const estado = clase ? estadoClase(clase.estado) : null
  const cruces = clase?.conflictos?.length ? clases.filter((otra) => cruza(clase, otra) && (
    (otra.docente.id === clase.docente.id) || (otra.grupo.id === clase.grupo.id) || (otra.aula?.id && otra.aula.id === clase.aula?.id)
  )) : []

  return (
    <>
      <Dialog.Root open={Boolean(clase)} onOpenChange={(open) => { if (!open) onClose() }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="sheet-backdrop" />
          <Dialog.Popup className="sheet-panel" aria-describedby={undefined}>
            {clase && (
              <div className="p-5 sm:p-[26px]">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <Dialog.Title className="text-[1.0625rem] font-semibold text-foreground">Detalle de clase</Dialog.Title>
                  <Dialog.Close render={<Button variant="ghost" size="icon-lg" aria-label="Cerrar detalle" />}><X aria-hidden="true" /></Dialog.Close>
                </div>
                <p className="text-sm text-muted-foreground">{clase.materia.clave}</p>
                <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground">{clase.materia.nombre}</h3>
                <p className={`mt-2.5 text-sm font-medium ${estado.texto}`}>{estado.label}</p>

                <dl className="my-6 text-[0.8125rem]">
                  <Fila label="Fecha" value={<span className="first-letter:uppercase">{fechaLarga(clase.fecha)}</span>} />
                  <Fila label="Horario programado" value={<span className="tabular-nums">{clase.horaInicio}–{clase.horaFin}</span>} />
                  <Fila label="Grupo" value={<Link className={linkClass} to={j.to(`/jefe-carrera/grupos/${clase.grupo.id}`)}>{clase.grupo.nombre} · {modalidadTexto(clase.grupo.modalidad)}</Link>} />
                  <Fila label="Docente" value={<Link className={linkClass} to={j.to(`/jefe-carrera/docentes/${clase.docente.id}`)}>{clase.docente.nombre}</Link>} />
                  <Fila label="Aula" value={clase.aula?.nombre ?? 'Sin aula asignada'} />
                  <Fila label="Unidad" value={clase.unidad?.nombre ?? (clase.sesionId ? 'Sin unidad registrada' : '—')} />
                  <Fila label="Alumnos inscritos" value={<span className="tabular-nums">{clase.alumnos}</span>} />
                  <Fila
                    label="Cobertura de captura"
                    value={clase.alumnos ? <span className="tabular-nums">{clase.registros} de {clase.alumnos}</span> : 'No aplica'}
                  />
                  {clase.capturadaEn && <Fila label="Sesión abierta" value={fechaHoraCorta(clase.capturadaEn)} />}
                </dl>

                <div className="rounded-[var(--radius-item)] bg-muted p-4 text-[0.8125rem] leading-relaxed text-foreground">
                  {clase.estado === 'SUSPENDIDA' && clase.suspensionMotivo ? `Suspendida: ${clase.suspensionMotivo}. No cuenta como pendiente.` : estado.explicacion}
                  {!clase.calendarioConfigurado && <p className="mt-2 text-muted-foreground">El calendario de {modalidadTexto(clase.grupo.modalidad)} no está configurado para este periodo; la clase no se cuenta en los pendientes.</p>}
                </div>

                {clase.conflictos?.length > 0 && (
                  <section className="mt-5" aria-labelledby="conflictos-clase">
                    <h4 id="conflictos-clase" className="text-sm font-semibold text-destructive-foreground">Conflicto de horario</h4>
                    <ul className="mt-2 space-y-1 text-[0.8125rem] text-foreground">
                      {[...new Set(clase.conflictos)].map((tipo) => <li key={tipo}>{CONFLICTO[tipo] ?? tipo}</li>)}
                    </ul>
                    {cruces.length > 0 && (
                      <ul className="mt-3 divide-y divide-border rounded-[var(--radius-item)] border border-border text-[0.8125rem]">
                        {cruces.map((otra) => (
                          <li key={otra.id} className="px-3 py-2.5">
                            <span className="tabular-nums">{otra.horaInicio}–{otra.horaFin}</span> · {otra.materia.nombre}
                            <span className="block text-xs text-muted-foreground">{otra.grupo.nombre} · {otra.docente.nombre}{otra.aula ? ` · ${otra.aula.nombre}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                <div className="mt-6 grid gap-2">
                  {clase.sesionId && (
                    <Button variant="outline" className="min-h-11 w-full" onClick={() => setSesionAbierta(clase.sesionId)}>Ver lista capturada</Button>
                  )}
                  <Link className={buttonVariants({ variant: 'outline', className: 'min-h-11 w-full' })} to={j.to(`/jefe-carrera/materias/${clase.materia.id}`)}>
                    Consultar la materia
                  </Link>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {sesionAbierta && <AsistenciaSesionModal sesionId={sesionAbierta} onClose={() => setSesionAbierta(null)} />}
    </>
  )
}

function Fila({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  )
}
