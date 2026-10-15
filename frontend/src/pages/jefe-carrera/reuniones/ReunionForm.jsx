import { useEffect, useId, useState } from 'react'
import { ArrowDown, ArrowUp, LoaderCircle, Plus, X } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { hoyClaveLocal } from '@/lib/reuniones'
import { campoClass } from '../supervision/ui'
import { mensajeError } from '../supervision/useJefatura'

const etiqueta = 'text-xs font-medium text-muted-foreground'

function inicial(reunion) {
  return {
    titulo: reunion?.titulo ?? '',
    tipo: reunion?.tipo ?? 'ORDINARIA',
    numeroActa: reunion?.numeroActa ?? '',
    fecha: reunion?.fecha ?? '',
    horaInicio: reunion?.horaInicio ?? '',
    horaFin: reunion?.horaFin ?? '',
    modalidad: reunion?.modalidad ?? 'PRESENCIAL',
    lugar: reunion?.lugar ?? '',
    enlace: reunion?.enlace ?? '',
    asunto: reunion?.asunto ?? '',
    puntos: reunion?.puntos?.map((p) => p.descripcion) ?? [''],
  }
}

/**
 * Convocatoria: datos de la reunión, orden del día y docentes convocados. Al
 * programarla se avisa a cada convocado; al editarla, solo si cambia la
 * fecha, la hora o el lugar.
 */
export default function ReunionForm({ j, reunion, onClose, onGuardada }) {
  const ids = useId()
  const nueva = !reunion
  const [form, setForm] = useState(() => inicial(reunion))
  const [docentes, setDocentes] = useState({ lista: null, error: '' })
  const [convocados, setConvocados] = useState(() => new Set(reunion?.convocados.map((d) => d.id) ?? []))
  const [estado, setEstado] = useState({ enviando: false, error: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    let vivo = true
    api.get('/jefe-carrera/reuniones/docentes', { params: { carreraId: j.carreraId } })
      .then(({ data }) => {
        if (!vivo) return
        setDocentes({ lista: data, error: '' })
        // Al programar, se convoca a toda la academia; el jefe quita a quien no aplique.
        if (nueva) setConvocados(new Set(data.map((d) => d.id)))
      })
      .catch((error) => { if (vivo) setDocentes({ lista: [], error: mensajeError(error, 'No se pudo cargar la lista de docentes') }) })
    return () => { vivo = false }
  }, [j.carreraId, nueva])

  const moverPunto = (i, paso) => setForm((f) => {
    const puntos = [...f.puntos]
    const [p] = puntos.splice(i, 1)
    puntos.splice(i + paso, 0, p)
    return { ...f, puntos }
  })
  const setPunto = (i, valor) => setForm((f) => ({ ...f, puntos: f.puntos.map((p, k) => (k === i ? valor : p)) }))
  const alternar = (id) => setConvocados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const todos = docentes.lista?.length > 0 && docentes.lista.every((d) => convocados.has(d.id))

  const guardar = async (e) => {
    e.preventDefault()
    if (!convocados.size) {
      setEstado({ enviando: false, error: 'Convoca al menos a un docente.' })
      return
    }
    setEstado({ enviando: true, error: '' })
    const datos = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      numeroActa: form.numeroActa.trim() || null,
      fecha: form.fecha,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin || null,
      modalidad: form.modalidad,
      lugar: form.modalidad === 'PRESENCIAL' ? form.lugar.trim() || null : null,
      enlace: form.modalidad === 'VIRTUAL' ? form.enlace.trim() || null : null,
      asunto: form.asunto.trim() || null,
      puntos: form.puntos.map((p) => p.trim()).filter(Boolean),
      convocados: [...convocados],
    }
    try {
      const { data } = nueva
        ? await api.post('/jefe-carrera/reuniones', { ...datos, carreraId: Number(j.carreraId) })
        : await api.patch(`/jefe-carrera/reuniones/${reunion.id}`, datos)
      onGuardada(data, nueva ? `Reunión programada. Se avisó a ${data.convocados.length} ${data.convocados.length === 1 ? 'docente' : 'docentes'}.` : 'Cambios guardados.')
    } catch (error) {
      setEstado({ enviando: false, error: mensajeError(error, 'No se pudo guardar la reunión') })
    }
  }

  return (
    <Modal open wide onClose={onClose} busy={estado.enviando} title={nueva ? 'Programar reunión' : 'Editar reunión'} description={nueva ? 'Los docentes convocados la verán en su Inicio y recibirán una notificación.' : 'Si cambias fecha, hora o lugar, se avisa a los convocados.'}>
      <form onSubmit={guardar} className="space-y-5">
        <fieldset className="space-y-4">
          <legend className="sr-only">Datos de la reunión</legend>
          <label className="block">
            <span className={etiqueta}>Título</span>
            <input required maxLength={200} value={form.titulo} onChange={set('titulo')} placeholder="Reunión ordinaria de academia" className={cn(campoClass, 'mt-1.5 h-11')} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={etiqueta}>Tipo</span>
              <select value={form.tipo} onChange={set('tipo')} className={cn(campoClass, 'mt-1.5 h-11')}>
                <option value="ORDINARIA">Ordinaria</option>
                <option value="EXTRAORDINARIA">Extraordinaria</option>
              </select>
            </label>
            <label className="block">
              <span className={etiqueta}>Número de acta <span className="font-normal">(opcional)</span></span>
              <input maxLength={50} value={form.numeroActa} onChange={set('numeroActa')} className={cn(campoClass, 'mt-1.5 h-11')} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={etiqueta}>Fecha</span>
              <input type="date" required min={hoyClaveLocal()} value={form.fecha} onChange={set('fecha')} className={cn(campoClass, 'mt-1.5 h-11')} />
            </label>
            <label className="block">
              <span className={etiqueta}>Hora de inicio</span>
              <input type="time" required value={form.horaInicio} onChange={set('horaInicio')} className={cn(campoClass, 'mt-1.5 h-11')} />
            </label>
            <label className="block">
              <span className={etiqueta}>Hora de término <span className="font-normal">(opcional)</span></span>
              <input type="time" min={form.horaInicio || undefined} value={form.horaFin} onChange={set('horaFin')} className={cn(campoClass, 'mt-1.5 h-11')} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <label className="block">
              <span className={etiqueta}>Modalidad</span>
              <select value={form.modalidad} onChange={set('modalidad')} className={cn(campoClass, 'mt-1.5 h-11')}>
                <option value="PRESENCIAL">Presencial</option>
                <option value="VIRTUAL">En línea</option>
              </select>
            </label>
            {form.modalidad === 'PRESENCIAL' ? (
              <label className="block">
                <span className={etiqueta}>Lugar</span>
                <input required maxLength={255} value={form.lugar} onChange={set('lugar')} placeholder="Sala de juntas del edificio K" className={cn(campoClass, 'mt-1.5 h-11')} />
              </label>
            ) : (
              <label className="block">
                <span className={etiqueta}>Enlace de la videollamada</span>
                <input type="url" required maxLength={255} value={form.enlace} onChange={set('enlace')} placeholder="https://meet.google.com/…" className={cn(campoClass, 'mt-1.5 h-11')} />
              </label>
            )}
          </div>
          <label className="block">
            <span className={etiqueta}>Asunto <span className="font-normal">(opcional)</span></span>
            <textarea rows={2} maxLength={2000} value={form.asunto} onChange={set('asunto')} className={cn(campoClass, 'mt-1.5 py-2.5')} />
          </label>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground">Orden del día</legend>
          <ol className="mt-2 space-y-2">
            {form.puntos.map((punto, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <label htmlFor={`${ids}-punto-${i}`} className="sr-only">Punto {i + 1}</label>
                <input id={`${ids}-punto-${i}`} maxLength={1000} value={punto} onChange={(e) => setPunto(i, e.target.value)} placeholder={i === 0 ? 'Pase de lista y verificación de quórum' : 'Siguiente punto'} className={cn(campoClass, 'h-10 min-w-0 flex-1')} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Subir punto ${i + 1}`} disabled={i === 0} onClick={() => moverPunto(i, -1)}><ArrowUp aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Bajar punto ${i + 1}`} disabled={i === form.puntos.length - 1} onClick={() => moverPunto(i, 1)}><ArrowDown aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar punto ${i + 1}`} onClick={() => setForm((f) => ({ ...f, puntos: f.puntos.length > 1 ? f.puntos.filter((_, k) => k !== i) : [''] }))}><X aria-hidden="true" /></Button>
              </li>
            ))}
          </ol>
          {form.puntos.length < 30 && (
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setForm((f) => ({ ...f, puntos: [...f.puntos, ''] }))}>
              <Plus aria-hidden="true" /> Agregar punto
            </Button>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground">Convocados <span className="font-normal tabular-nums text-muted-foreground">{convocados.size}{docentes.lista ? ` de ${docentes.lista.length}` : ''}</span></legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Docentes que imparten materias en grupos activos de la carrera.</p>
            {docentes.lista?.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConvocados(todos ? new Set() : new Set(docentes.lista.map((d) => d.id)))}>
                {todos ? 'Quitar a todos' : 'Convocar a todos'}
              </Button>
            )}
          </div>
          {docentes.lista === null ? (
            <p className="mt-2 flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Cargando docentes…</p>
          ) : docentes.error ? (
            <p role="alert" className="mt-2 text-[0.8125rem] text-destructive-foreground">{docentes.error}</p>
          ) : !docentes.lista.length ? (
            <p className="mt-2 text-[0.8125rem] text-muted-foreground">La carrera todavía no tiene docentes con grupos activos.</p>
          ) : (
            <ul className="mt-2 grid max-h-56 gap-x-4 overflow-y-auto rounded-[var(--radius-item)] border border-border p-2 sm:grid-cols-2">
              {docentes.lista.map((d) => (
                <li key={d.id}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[0.8125rem] hover:bg-muted">
                    <input type="checkbox" checked={convocados.has(d.id)} onChange={() => alternar(d.id)} className="size-[17px] accent-primary" />
                    <span className="min-w-0 truncate text-foreground">{d.nombre}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {estado.error && <p role="alert" className="text-[0.8125rem] text-destructive-foreground">{estado.error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={estado.enviando}>Cancelar</Button>
          <Button type="submit" disabled={estado.enviando || docentes.lista === null}>
            {estado.enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {nueva ? 'Programar y avisar' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
