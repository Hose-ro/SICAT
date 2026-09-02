import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Save } from 'lucide-react'
import api from '@/api/axios'
import PageHeader from '@/components/PageHeader'
import { CarreraSelector, PageState, StatusBadge } from '@/components/jefe-carrera/JefeCarreraUI'
import { useJefeCarreraStore } from '@/store/jefeCarreraStore'

export default function JefeAlertas() {
  const carreraId = useJefeCarreraStore((state) => state.carreraId)
  const [alertas, setAlertas] = useState([])
  const [docentes, setDocentes] = useState([])
  const [estado, setEstado] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [alertsResponse, docentesResponse] = await Promise.all([
        api.get('/jefe-carrera/alertas', { params: { carreraId: carreraId || undefined, estado: estado || undefined } }),
        api.get('/jefe-carrera/docentes', { params: carreraId ? { carreraId } : {} }),
      ])
      setAlertas(alertsResponse.data); setDocentes(docentesResponse.data); setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'No se pudieron cargar las alertas')
    } finally { setLoading(false) }
  }, [carreraId, estado])

  useEffect(() => { cargar() }, [cargar])

  const editar = (alerta) => {
    setEditingId(alerta.id)
    setDraft({ estado: alerta.estado, observacion: alerta.observacion ?? '', responsableId: alerta.responsableId ?? '', fechaSeguimiento: alerta.fechaSeguimiento?.slice(0, 10) ?? '' })
  }

  const guardar = async (id) => {
    setSaving(true)
    try {
      await api.patch(`/jefe-carrera/alertas/${id}`, {
        ...draft,
        responsableId: draft.responsableId ? Number(draft.responsableId) : null,
        fechaSeguimiento: draft.fechaSeguimiento || null,
      })
      setEditingId(null); await cargar()
    } catch (requestError) { setError(requestError.response?.data?.message ?? 'No se pudo actualizar la alerta') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Alertas académicas" subtitle="Incidencias derivadas de clases, horarios, unidades y asistencia" action={<CarreraSelector />} />
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">{['', 'NUEVA', 'REVISADA', 'EN_SEGUIMIENTO', 'CERRADA'].map((value) => <button key={value} type="button" onClick={() => setEstado(value)} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${estado === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>{value ? <StatusLabel value={value} /> : 'Todas'}</button>)}</div>
      <PageState loading={loading} error={error} empty={!alertas.length} emptyText="No hay alertas para el filtro seleccionado." />
      {!loading && !error && alertas.length > 0 && <div className="space-y-3">{alertas.map((alerta) => {
        const editing = editingId === alerta.id
        return <article key={alerta.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground"><AlertTriangle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-foreground">{alerta.titulo}</h2><StatusBadge value={alerta.estado} /></div><p className="mt-1 text-sm text-muted-foreground">{alerta.mensaje}</p><p className="mt-2 text-xs text-muted-foreground">{alerta.carrera.codigo} · {new Date(alerta.createdAt).toLocaleString('es-MX')}</p></div>{!editing && <button type="button" onClick={() => editar(alerta)} className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">Dar seguimiento</button>}</div>
          {editing && <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2"><label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Estado</span><select value={draft.estado} onChange={(event) => setDraft({ ...draft, estado: event.target.value })} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="NUEVA">Nueva</option><option value="REVISADA">Revisada</option><option value="EN_SEGUIMIENTO">En seguimiento</option><option value="CERRADA">Cerrada</option></select></label><label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Responsable</span><select value={draft.responsableId} onChange={(event) => setDraft({ ...draft, responsableId: event.target.value })} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Sin responsable</option>{docentes.map((docente) => <option key={docente.id} value={docente.id}>{docente.nombre}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Fecha de seguimiento</span><input type="date" value={draft.fechaSeguimiento} onChange={(event) => setDraft({ ...draft, fechaSeguimiento: event.target.value })} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" /></label><label className="space-y-1 md:row-span-2"><span className="text-xs font-medium text-muted-foreground">Observación</span><textarea rows={4} value={draft.observacion} onChange={(event) => setDraft({ ...draft, observacion: event.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Acuerdo o acción de seguimiento" /></label><div className="flex gap-2"><button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button><button type="button" disabled={saving} onClick={() => guardar(alerta.id)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Guardando' : 'Guardar'}</button></div></div>}
          {!editing && alerta.observacion && <div className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm text-foreground"><span className="font-medium">Seguimiento:</span> {alerta.observacion}</div>}
        </article>
      })}</div>}
    </div>
  )
}

function StatusLabel({ value }) { return value === 'EN_SEGUIMIENTO' ? 'En seguimiento' : value.charAt(0) + value.slice(1).toLowerCase() }
