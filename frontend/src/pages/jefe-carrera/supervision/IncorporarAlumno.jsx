import { useEffect, useId, useRef, useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { modalidadTexto, semestreTexto, diasTexto } from './formato'
import { mensajeError, useJefaturaStore } from './useJefatura'
import { invalidarReportes } from './useReportes'

const SOLICITUD = { PENDIENTE: 'Solicitud pendiente', RECHAZADA: 'Solicitud rechazada', ACEPTADA: 'Ya inscrito' }

/**
 * Incorporación de un alumno de la carrera (de cualquier semestre) a una
 * oferta del periodo actual. El servidor valida alcance, calendario,
 * duplicados y choques; aquí solo se prepara y se confirma con un motivo.
 */
export default function IncorporarAlumno({ j, oferta, onClose }) {
  const ids = useId()
  const [q, setQ] = useState('')
  const [busqueda, setBusqueda] = useState({ items: [], cargando: false, error: '' })
  const [alumno, setAlumno] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [resolver, setResolver] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const buscarRef = useRef(null)
  const recargar = useJefaturaStore((s) => s.cargarResumen)

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) { setBusqueda({ items: [], cargando: false, error: '' }); return undefined }
    let vivo = true
    setBusqueda((b) => ({ ...b, cargando: true }))
    const timer = setTimeout(() => {
      api.get('/jefe-carrera/alumnos/buscar', { params: { carreraId: j.carreraId, periodo: j.periodo, q: texto, materiaId: oferta.materia.id } })
        .then(({ data }) => { if (vivo) setBusqueda({ items: data, cargando: false, error: '' }) })
        .catch((e) => { if (vivo) setBusqueda({ items: [], cargando: false, error: mensajeError(e, 'No se pudo buscar') }) })
    }, 250)
    return () => { vivo = false; clearTimeout(timer) }
  }, [q, j.carreraId, j.periodo, oferta.materia.id])

  const existente = alumno?.inscripcionMateria?.estado
  const requiereResolver = existente === 'PENDIENTE' || existente === 'RECHAZADA'
  const listo = alumno && existente !== 'ACEPTADA' && motivo.trim().length >= 5 && (!requiereResolver || resolver)

  const confirmar = async () => {
    if (!listo) return
    setEnviando(true)
    setError('')
    try {
      const { data } = await api.post('/jefe-carrera/incorporaciones', {
        alumnoId: alumno.id, materiaId: oferta.materia.id, grupoId: oferta.grupo.id,
        motivo: motivo.trim(), ...(requiereResolver ? { resolverSolicitud: true } : {}),
      }, { params: { carreraId: j.carreraId, periodo: j.periodo } })
      setResultado({ alumno, mensaje: data?.mensaje })
      invalidarReportes()
      recargar(j.carreraId, j.periodo)
    } catch (e) {
      setError(mensajeError(e, 'No se pudo incorporar al alumno'))
    } finally {
      setEnviando(false)
    }
  }

  const otro = () => {
    setResultado(null); setAlumno(null); setMotivo(''); setResolver(false); setQ('')
    requestAnimationFrame(() => buscarRef.current?.focus())
  }

  const horario = oferta.horarios.map((h) => `${diasTexto(h.dias)} ${h.horaInicio}–${h.horaFin}`).join(' · ')

  return (
    <Modal open onClose={onClose} busy={enviando} wide title="Incorporar alumno" description="El alumno conserva su grupo base y queda inscrito en esta materia y grupo." initialFocus={buscarRef}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius-item)] bg-muted p-4 text-[0.8125rem] sm:grid-cols-3">
        <Dato label="Materia" value={oferta.materia.nombre} />
        <Dato label="Grupo destino" value={`${oferta.grupo.nombre} · ${modalidadTexto(oferta.grupo.modalidad)}`} />
        <Dato label="Docente" value={oferta.docentes.map((d) => d.nombre).join(', ') || 'Sin docente asignado'} />
        <Dato label="Horario" value={horario || 'Sin horario'} />
        <Dato label="Inscritos" value={oferta.resumen.alumnos} />
      </dl>

      {resultado ? (
        <div role="status" className="rounded-[var(--radius-item)] border border-success/25 bg-success/10 p-4 text-sm">
          <p className="font-semibold text-success-foreground">{resultado.alumno.nombre} quedó inscrito en {oferta.materia.nombre}, grupo {oferta.grupo.nombre}.</p>
          <p className="mt-1 text-foreground">{resultado.mensaje ?? 'Su grupo base se conserva.'} La incorporación quedó registrada con tu nombre, la fecha y el motivo.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onClose}>Listo</Button>
            <Button variant="outline" onClick={otro}>Incorporar a otro alumno</Button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor={`${ids}-q`} className="text-xs font-medium text-muted-foreground">Alumno de la carrera, de cualquier semestre</label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id={`${ids}-q`} ref={buscarRef} type="search" value={q} autoComplete="off"
                onChange={(e) => { setQ(e.target.value); setAlumno(null); setResolver(false); setError('') }}
                placeholder="Nombre o número de control"
                className="h-11 w-full rounded-[0.7rem] border border-border bg-background pl-9 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              {busqueda.cargando && <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Buscando" />}
            </div>
            {busqueda.error && <p role="alert" className="mt-2 text-xs text-destructive-foreground">{busqueda.error}</p>}
            {q.trim().length >= 2 && !busqueda.cargando && !busqueda.items.length && !busqueda.error && (
              <p className="mt-2 text-xs text-muted-foreground">Ningún alumno activo de la carrera coincide.</p>
            )}
            {busqueda.items.length > 0 && (
              <ul aria-label="Alumnos encontrados" className="mt-2 max-h-60 divide-y divide-border overflow-y-auto rounded-[var(--radius-item)] border border-border">
                {busqueda.items.map((a) => {
                  const estado = a.inscripcionMateria?.estado
                  const elegido = alumno?.id === a.id
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={estado === 'ACEPTADA'}
                        aria-pressed={elegido}
                        onClick={() => { setAlumno(a); setResolver(false); setError('') }}
                        className={cn('flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[0.8125rem] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60', elegido ? 'bg-accent' : 'hover:bg-muted')}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{a.nombre}</span>
                          <span className="block text-xs text-muted-foreground">{[a.numeroControl, semestreTexto(a.semestre), a.grupo ? `Grupo ${a.grupo.nombre}` : 'Sin grupo base'].filter(Boolean).join(' · ')}</span>
                        </span>
                        {estado && <span className={cn('shrink-0 text-xs', estado === 'ACEPTADA' ? 'text-muted-foreground' : 'text-warning-foreground')}>{SOLICITUD[estado]}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {alumno && (
            <section aria-labelledby={`${ids}-resumen`} className="space-y-4 border-t border-border pt-4">
              <h3 id={`${ids}-resumen`} className="text-sm font-semibold text-foreground">Resumen</h3>
              <dl className="grid gap-x-6 gap-y-3 text-[0.8125rem] sm:grid-cols-2">
                <Dato label="Alumno" value={`${alumno.nombre}${alumno.numeroControl ? ` · ${alumno.numeroControl}` : ''}`} />
                <Dato label="Origen" value={`${semestreTexto(alumno.semestre)} · ${alumno.grupo ? `grupo ${alumno.grupo.nombre}` : 'sin grupo base'}`} />
                <Dato label="Destino" value={`${oferta.materia.nombre} · grupo ${oferta.grupo.nombre}`} />
                <Dato label="Grupo base" value="Se conserva" />
              </dl>
              {requiereResolver && (
                <label className="flex items-start gap-2.5 rounded-[var(--radius-item)] border border-warning/35 bg-warning/10 p-3 text-[0.8125rem] text-foreground">
                  <input type="checkbox" checked={resolver} onChange={(e) => setResolver(e.target.checked)} className="mt-0.5 size-[17px] shrink-0 accent-primary" />
                  <span>El alumno tiene una {existente === 'PENDIENTE' ? 'solicitud pendiente' : 'solicitud rechazada'} para esta materia. Al confirmar, esa misma inscripción pasa a aceptada en este grupo; no se crea otra.</span>
                </label>
              )}
              <div>
                <label htmlFor={`${ids}-motivo`} className="text-xs font-medium text-muted-foreground">Motivo de la incorporación</label>
                <textarea
                  id={`${ids}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3}
                  aria-describedby={`${ids}-motivo-ayuda`}
                  className="mt-1.5 w-full rounded-[0.7rem] border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="Por ejemplo: recursamiento autorizado por la academia"
                />
                <p id={`${ids}-motivo-ayuda`} className="mt-1 text-xs text-muted-foreground">Queda en el historial junto con tu nombre y la fecha. Mínimo 5 caracteres.</p>
              </div>
              {error && <p role="alert" className="rounded-[var(--radius-item)] border border-destructive/25 bg-destructive/5 p-3 text-[0.8125rem] text-destructive-foreground">{error}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
                <Button onClick={confirmar} disabled={!listo || enviando}>
                  {enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  Incorporar alumno
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </Modal>
  )
}

function Dato({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  )
}
