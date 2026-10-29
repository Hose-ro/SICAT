import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Search, Sparkles, UserPlus, X } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { hoyClaveLocal } from '@/lib/reuniones'
import { academiaDe, generarApertura } from '@/lib/actaReunion'
import { useAuthStore } from '@/store/authStore'
import { useBorrador } from '../supervision/borrador'
import { campoClass } from '../supervision/ui'
import { mensajeError } from '../supervision/useJefatura'

const etiqueta = 'text-xs font-medium text-muted-foreground'

function inicial(reunion, academia) {
  return {
    academia: reunion?.academia ?? academia ?? '',
    apertura: reunion?.apertura ?? '',
    presidenteId: reunion?.presidente?.id ? String(reunion.presidente.id) : '',
    secretarioId: reunion?.secretario?.id ? String(reunion.secretario.id) : '',
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

/** Busca docentes de cualquier carrera para invitarlos a la reunión. */
function BuscarInvitados({ excluir, onInvitar }) {
  const id = useId()
  const [q, setQ] = useState('')
  // Resultado de la última búsqueda; mientras no corresponda al texto actual, está buscando.
  const [res, setRes] = useState({ q: '', lista: [], error: '' })
  const texto = q.trim()

  useEffect(() => {
    if (texto.length < 2) return undefined
    let vivo = true
    const t = setTimeout(() => {
      api.get('/jefe-carrera/reuniones/docentes/buscar', { params: { q: texto } })
        .then(({ data }) => { if (vivo) setRes({ q: texto, lista: data, error: '' }) })
        .catch((error) => { if (vivo) setRes({ q: texto, lista: [], error: mensajeError(error, 'No se pudo buscar') }) })
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [texto])

  const cargando = res.q !== texto
  const visibles = res.lista.filter((d) => !excluir.has(d.id))
  return (
    <div className="mt-3">
      <label htmlFor={id} className={etiqueta}>Invitar a docentes de otras carreras</label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo del docente" autoComplete="off" className={cn(campoClass, 'h-10 pl-9')} />
      </div>
      {texto.length >= 2 && (
        <div aria-live="polite" className="mt-1.5">
          {cargando ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Buscando…</p>
          ) : res.error ? (
            <p role="alert" className="text-xs text-destructive-foreground">{res.error}</p>
          ) : !visibles.length ? (
            <p className="text-xs text-muted-foreground">{res.lista.length ? 'Ya están convocados.' : 'Ningún docente coincide.'}</p>
          ) : (
            <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-[var(--radius-item)] border border-border">
              {visibles.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[0.8125rem]">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{d.nombre}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.carreras.length ? d.carreras.join(' · ') : (d.email ?? 'Sin grupos activos')}</span>
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => onInvitar(d)}><UserPlus aria-hidden="true" /> Invitar</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Convocatoria: datos de la reunión y del acta (academia, apertura, mesa),
 * orden del día y docentes convocados, de la carrera o invitados de otras.
 * Al programarla se avisa a cada convocado y sus clases que se cruzan quedan
 * sin clase; al editarla, solo se avisa si cambia la fecha, la hora o el lugar.
 */
export default function ReunionForm({ j, reunion, academia, onClose, onGuardada }) {
  const ids = useId()
  const nueva = !reunion
  const jefeId = useAuthStore((state) => state.user?.id)
  const jefeNombre = useAuthStore((state) => state.user?.nombre)
  // Lo escrito se conserva en esta pestaña si el diálogo se cierra antes de guardar.
  const [form, setForm, borrador] = useBorrador(`reunion:${reunion?.id ?? `nueva:${j.carreraId}`}`, () => inicial(reunion, academia))
  const [docentes, setDocentes] = useState({ lista: null, error: '' })
  const [convocados, setConvocados] = useState(() => new Set(reunion?.convocados.map((d) => d.id) ?? []))
  // Invitados de otras carreras: los convocados que no están en la lista de la carrera.
  const [invitados, setInvitados] = useState([])
  const [estado, setEstado] = useState({ enviando: false, error: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    let vivo = true
    api.get('/jefe-carrera/reuniones/docentes', { params: { carreraId: j.carreraId } })
      .then(({ data }) => {
        if (!vivo) return
        setDocentes({ lista: data, error: '' })
        const propios = new Set(data.map((d) => d.id))
        setInvitados((reunion?.convocados ?? []).filter((d) => !propios.has(d.id)))
        // Al programar, se convoca a toda la academia; el jefe quita a quien no aplique.
        if (nueva) setConvocados(new Set(data.map((d) => d.id)))
      })
      .catch((error) => { if (vivo) setDocentes({ lista: [], error: mensajeError(error, 'No se pudo cargar la lista de docentes') }) })
    return () => { vivo = false }
  }, [j.carreraId, nueva, reunion])

  const invitar = (d) => {
    setInvitados((lista) => (lista.some((x) => x.id === d.id) ? lista : [...lista, d]))
    setConvocados((s) => new Set(s).add(d.id))
  }
  const quitarInvitado = (id) => {
    setInvitados((lista) => lista.filter((d) => d.id !== id))
    setConvocados((s) => { const n = new Set(s); n.delete(id); return n })
  }
  // Presidente(a) y secretario(a): cualquier convocado o la propia jefatura.
  const mesa = useMemo(() => {
    const lista = [...(docentes.lista ?? []), ...invitados].filter((d) => convocados.has(d.id))
    return [...(jefeId && !lista.some((d) => d.id === jefeId) ? [{ id: jefeId, nombre: `${jefeNombre ?? 'Jefatura'} (jefatura)` }] : []), ...lista]
  }, [docentes.lista, invitados, convocados, jefeId, jefeNombre])
  const enMesa = (valor) => (valor && mesa.some((d) => String(d.id) === valor) ? Number(valor) : null)

  const moverPunto = (i, paso) => setForm((f) => {
    const puntos = [...f.puntos]
    const [p] = puntos.splice(i, 1)
    puntos.splice(i + paso, 0, p)
    return { ...f, puntos }
  })
  const setPunto = (i, valor) => setForm((f) => ({ ...f, puntos: f.puntos.map((p, k) => (k === i ? valor : p)) }))
  const alternar = (id) => setConvocados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const todos = docentes.lista?.length > 0 && docentes.lista.every((d) => convocados.has(d.id))
  const deCarrera = docentes.lista?.filter((d) => convocados.has(d.id)).length ?? 0

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
      academia: form.academia.trim() || null,
      apertura: form.apertura.trim() || null,
      presidenteId: enMesa(form.presidenteId),
      secretarioId: enMesa(form.secretarioId),
    }
    try {
      const { data } = nueva
        ? await api.post('/jefe-carrera/reuniones', { ...datos, carreraId: Number(j.carreraId) })
        : await api.patch(`/jefe-carrera/reuniones/${reunion.id}`, datos)
      borrador.limpiar()
      const sinClase = data.clasesJustificadas?.length ?? 0
      onGuardada(data, nueva
        ? `Reunión programada. Se avisó a ${data.convocados.length} ${data.convocados.length === 1 ? 'docente' : 'docentes'}${sinClase ? ` y ${sinClase === 1 ? '1 clase quedó' : `${sinClase} clases quedaron`} sin clase por la reunión` : ''}.`
        : 'Cambios guardados.')
    } catch (error) {
      setEstado({ enviando: false, error: mensajeError(error, 'No se pudo guardar la reunión') })
    }
  }

  return (
    <Modal open wide onClose={onClose} busy={estado.enviando} title={nueva ? 'Programar reunión' : 'Editar reunión'} description={nueva ? 'Los convocados la verán en su Inicio con el acta y recibirán una notificación. Sus clases a esa hora quedan sin clase.' : 'Si cambias fecha, hora o lugar, se avisa a los convocados.'}>
      <form onSubmit={guardar} className="space-y-5">
        {borrador.recuperado && (
          <p role="status" className="flex flex-wrap items-center gap-2 rounded-[var(--radius-item)] border border-border bg-muted px-3 py-2 text-xs text-foreground">
            Se recuperó un borrador sin guardar de esta convocatoria.
            <Button type="button" variant="ghost" size="sm" onClick={borrador.descartar}>Descartar borrador</Button>
          </p>
        )}
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

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Datos del acta</legend>
          <label className="block">
            <span className={etiqueta}>Academia</span>
            <input maxLength={150} value={form.academia} onChange={set('academia')} placeholder={academiaDe({ carrera: { nombre: j.carrera?.nombre } })} className={cn(campoClass, 'mt-1.5 h-11')} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {[['presidenteId', 'Presidente(a)'], ['secretarioId', 'Secretario(a)']].map(([campo, texto]) => (
              <label key={campo} className="block">
                <span className={etiqueta}>{texto} <span className="font-normal">(opcional)</span></span>
                <select value={enMesa(form[campo]) ? form[campo] : ''} onChange={set(campo)} className={cn(campoClass, 'mt-1.5 h-11')}>
                  <option value="">Sin definir</option>
                  {mesa.map((d) => <option key={d.id} value={String(d.id)}>{d.nombre}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label htmlFor={`${ids}-apertura`} className={etiqueta}>Apertura del acta <span className="font-normal">(opcional)</span></label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, apertura: generarApertura({ ...f, carrera: { nombre: j.carrera?.nombre } }) }))}>
                <Sparkles aria-hidden="true" /> Redactar con los datos
              </Button>
            </div>
            <textarea id={`${ids}-apertura`} rows={3} maxLength={3000} value={form.apertura} onChange={set('apertura')} placeholder="Si lo dejas vacío, el acta lo redacta con la fecha, la hora y el lugar." className={cn(campoClass, 'mt-1.5 py-2.5')} />
          </div>
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
          <legend className="text-sm font-semibold text-foreground">Convocados <span className="font-normal tabular-nums text-muted-foreground">{deCarrera}{docentes.lista ? ` de ${docentes.lista.length}` : ''}{invitados.length ? ` + ${invitados.length} ${invitados.length === 1 ? 'invitado' : 'invitados'}` : ''}</span></legend>
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
          {invitados.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Invitados ({invitados.length})</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {invitados.map((d) => (
                  <li key={d.id} className="inline-flex items-center gap-1 rounded-md border border-border py-0.5 pl-2 pr-0.5 text-xs text-foreground">
                    {d.nombre}{d.carreras?.length ? <span className="text-muted-foreground"> · {d.carreras[0]}</span> : null}
                    <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Quitar a ${d.nombre}`} onClick={() => quitarInvitado(d.id)}><X aria-hidden="true" /></Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <BuscarInvitados excluir={new Set([...convocados, ...(docentes.lista ?? []).map((d) => d.id)])} onInvitar={invitar} />
        </fieldset>

        {estado.error && <p role="alert" className="text-[0.8125rem] text-destructive-foreground">{estado.error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={estado.enviando}>{borrador.modificado ? 'Cerrar y conservar borrador' : 'Cancelar'}</Button>
          <Button type="submit" disabled={estado.enviando || docentes.lista === null}>
            {estado.enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {nueva ? 'Programar y avisar' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
