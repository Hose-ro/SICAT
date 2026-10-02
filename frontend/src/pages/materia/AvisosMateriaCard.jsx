import { useCallback, useEffect, useState } from 'react'
import { Megaphone, MessageCircle, Pin, PinOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { confirmAction, notify } from '@/lib/feedback'
import { fechaAviso, mensajeError } from '@/lib/avisos'
import { mensajeAviso } from '@/lib/whatsapp'
import { abrirCompartirWhatsapp } from '@/store/compartirWhatsappStore'
import api from '../../api/axios'

const FIELD = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40'
const VACIO = { titulo: '', cuerpo: '', fijado: false }

/**
 * Tablero de avisos de la materia por grupo: "mañana no hay clase",
 * "traigan calculadora". Publicar notifica a los alumnos inscritos.
 */
export default function AvisosMateriaCard({ materia }) {
  const grupos = materia.grupos ?? []
  const [grupoId, setGrupoId] = useState(() => grupos[0]?.id ?? null)
  const [avisos, setAvisos] = useState({ grupoId: null, items: [], error: '' })
  const [form, setForm] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback((id) => api.get('/avisos', { params: { materiaId: materia.id, grupoId: id } })
    .then((res) => setAvisos({ grupoId: id, items: res.data ?? [], error: '' }))
    .catch((error) => setAvisos({ grupoId: id, items: [], error: mensajeError(error, 'No se pudieron cargar los avisos.') })), [materia.id])

  useEffect(() => {
    if (grupoId) cargar(grupoId)
  }, [grupoId, cargar])

  if (!grupos.length) return null
  const lista = avisos.grupoId === grupoId ? avisos : { items: [], error: '' }
  const grupo = grupos.find((g) => g.id === grupoId)

  const compartir = (aviso) => abrirCompartirWhatsapp({
    titulo: 'Compartir aviso por WhatsApp',
    materiaId: materia.id,
    grupoId,
    texto: mensajeAviso(aviso, materia.nombre, grupo?.nombre),
  })

  const publicar = async (event) => {
    event.preventDefault()
    if (enviando || !form.titulo.trim() || !form.cuerpo.trim()) return
    setEnviando(true)
    try {
      const { data } = await api.post('/avisos', { materiaId: materia.id, grupoId, ...form })
      setForm(VACIO)
      await cargar(grupoId)
      notify(data.destinatarios
        ? `Se avisó a ${data.destinatarios} ${data.destinatarios === 1 ? 'alumno' : 'alumnos'} de ${grupo.nombre}.`
        : `Aviso publicado en ${grupo.nombre}. Todavía no hay alumnos inscritos que lo reciban.`, 'success',
      { action: { label: 'Mandar por WhatsApp', onClick: () => compartir(data) }, duration: 9000 })
    } catch (error) {
      notify(mensajeError(error, 'No se pudo publicar el aviso.'))
    } finally {
      setEnviando(false)
    }
  }

  const alternarFijado = async (aviso) => {
    try {
      await api.patch(`/avisos/${aviso.id}`, { fijado: !aviso.fijado })
      await cargar(grupoId)
    } catch (error) {
      notify(mensajeError(error, 'No se pudo actualizar el aviso.'))
    }
  }

  const eliminar = async (aviso) => {
    const ok = await confirmAction({
      title: 'Eliminar aviso',
      description: `«${aviso.titulo}» dejará de verse en la materia. Las notificaciones que ya llegaron no se retiran.`,
      confirmLabel: 'Eliminar',
    })
    if (!ok) return
    try {
      await api.delete(`/avisos/${aviso.id}`)
      await cargar(grupoId)
    } catch (error) {
      notify(mensajeError(error, 'No se pudo eliminar el aviso.'))
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="avisos-materia">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="avisos-materia" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Megaphone className="size-5" aria-hidden="true" />Avisos
        </h2>
        {grupos.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Grupo
            <select className={`${FIELD} w-auto`} value={grupoId ?? ''} onChange={(event) => setGrupoId(Number(event.target.value))}>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      <form onSubmit={publicar} className="mt-4 space-y-3">
        <label className="block">
          <span className="sr-only">Título del aviso</span>
          <input className={FIELD} maxLength={120} placeholder="Título: Traigan calculadora, cambio de aula…" value={form.titulo}
            onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))} />
        </label>
        <label className="block">
          <span className="sr-only">Mensaje del aviso</span>
          <textarea className={FIELD} rows={3} maxLength={2000} placeholder="Escribe el aviso para el grupo" value={form.cuerpo}
            onChange={(event) => setForm((prev) => ({ ...prev, cuerpo: event.target.value }))} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="size-4" checked={form.fijado}
              onChange={(event) => setForm((prev) => ({ ...prev, fijado: event.target.checked }))} />
            Fijar arriba
          </label>
          <Button type="submit" disabled={enviando || !form.titulo.trim() || !form.cuerpo.trim()}>
            {enviando ? 'Publicando…' : `Publicar en ${grupo?.nombre ?? 'el grupo'}`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Les llega como notificación a los alumnos inscritos; con el botón de WhatsApp lo mandas también al grupo. Para un día sin clase, márcalo en el calendario: el aviso se manda solo.
        </p>
      </form>

      {lista.error && <p role="alert" className="mt-4 text-sm text-destructive-foreground">{lista.error}</p>}
      <ul className="mt-4 space-y-2">
        {lista.items.map((aviso) => (
          <li key={aviso.id} className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  {aviso.fijado && <Pin className="size-3.5 shrink-0 text-primary-ink" aria-label="Fijado" />}
                  {aviso.titulo}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{aviso.cuerpo}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fechaAviso(aviso.createdAt)}{aviso.suspensionFecha && ' · desde el calendario'}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" aria-label={`Compartir ${aviso.titulo} por WhatsApp`} onClick={() => compartir(aviso)}>
                  <MessageCircle aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={aviso.fijado ? `Desfijar ${aviso.titulo}` : `Fijar ${aviso.titulo}`} onClick={() => alternarFijado(aviso)}>
                  {aviso.fijado ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Eliminar ${aviso.titulo}`} onClick={() => eliminar(aviso)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>
          </li>
        ))}
        {!lista.error && avisos.grupoId === grupoId && !lista.items.length && (
          <li className="text-sm text-muted-foreground">Aún no hay avisos para {grupo?.nombre}.</li>
        )}
      </ul>
    </section>
  )
}
