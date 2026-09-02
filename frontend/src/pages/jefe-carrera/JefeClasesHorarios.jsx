import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Clock3, MapPin, Radio } from 'lucide-react'
import api from '@/api/axios'
import PageHeader from '@/components/PageHeader'
import { CarreraSelector, PageState, StatusBadge } from '@/components/jefe-carrera/JefeCarreraUI'
import AsistenciaSesionModal from './components/AsistenciaSesionModal'
import { useJefeCarreraStore } from '@/store/jefeCarreraStore'

export default function JefeClasesHorarios() {
  const carreraId = useJefeCarreraStore((state) => state.carreraId)
  const [tab, setTab] = useState('clases')
  const [clases, setClases] = useState([])
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [sesionSeleccionada, setSesionSeleccionada] = useState(null)

  const cargar = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const [clasesResponse, horariosResponse] = await Promise.all([
        api.get('/jefe-carrera/clases', { params: carreraId ? { carreraId } : {} }),
        api.get('/jefe-carrera/horarios', { params: carreraId ? { carreraId } : {} }),
      ])
      setClases(clasesResponse.data)
      setHorarios(horariosResponse.data)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'No se pudo cargar la supervisión')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [carreraId])

  useEffect(() => {
    cargar()
    const interval = setInterval(() => cargar({ silent: true }), 20000)
    return () => clearInterval(interval)
  }, [cargar])

  const items = tab === 'clases' ? clases : horarios
  const filtrados = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('es-MX')
    if (!term) return items
    return items.filter((item) => [item.materia?.nombre, item.docente?.nombre, item.grupo?.nombre, item.aula?.nombre]
      .filter(Boolean).some((value) => value.toLocaleLowerCase('es-MX').includes(term)))
  }, [items, q])

  return (
    <div className="space-y-5">
      <PageHeader title="Clases y horarios" subtitle="Supervisión de la jornada y carga académica" action={<CarreraSelector />} />
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Vista de supervisión" className="inline-flex w-fit rounded-xl bg-muted p-1">
          <Tab active={tab === 'clases'} onClick={() => setTab('clases')}>Clases de hoy</Tab>
          <Tab active={tab === 'horarios'} onClick={() => setTab('horarios')}>Horario semanal</Tab>
        </div>
        <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Filtrar</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Docente, materia, grupo o aula" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-72" /></label>
      </div>
      <PageState loading={loading} error={error} empty={!filtrados.length} emptyText={tab === 'clases' ? 'No hay clases programadas para hoy.' : 'No hay horarios asignados.'} />

      {!loading && !error && filtrados.length > 0 && tab === 'clases' && (
        <div className="space-y-3">
          {filtrados.map((clase) => (
            <article key={clase.id} className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
              <div><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold text-foreground">{clase.materia.nombre}</h2></div><p className="mt-1 text-sm text-muted-foreground">{clase.docente.nombre} · {clase.grupo?.nombre ?? 'Sin grupo'}</p></div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{clase.horaInicio}-{clase.horaFin}</span><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{clase.aula?.nombre ?? 'Sin aula'}</span>{clase.sesion?.unidadRef && <span>{clase.sesion.unidadRef.nombre}</span>}</div>
              <div className="md:text-right">
                <StatusBadge value={clase.estado} />
                {clase.sesion && <p className="mt-2 text-xs text-muted-foreground">{clase.sesion._count.asistencias} asistencias</p>}
                {clase.estado === 'EN_CURSO' && clase.sesion?.id && (
                  <button
                    type="button"
                    onClick={() => setSesionSeleccionada(clase.sesion.id)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-medium text-success transition-colors hover:bg-success/20"
                  >
                    <Radio className="h-3.5 w-3.5" /> Ver en vivo
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && filtrados.length > 0 && tab === 'horarios' && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/70"><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="px-4 py-3 font-medium">Días</th><th className="px-4 py-3 font-medium">Horario</th><th className="px-4 py-3 font-medium">Materia</th><th className="px-4 py-3 font-medium">Docente</th><th className="px-4 py-3 font-medium">Grupo</th><th className="px-4 py-3 font-medium">Aula</th></tr></thead><tbody className="divide-y divide-border">{filtrados.map((horario) => <tr key={horario.id} className="hover:bg-muted/50"><td className="px-4 py-3 font-medium text-foreground">{horario.dias}</td><td className="px-4 py-3 text-muted-foreground">{horario.horaInicio}-{horario.horaFin}</td><td className="px-4 py-3 text-muted-foreground">{horario.materia.nombre}</td><td className="px-4 py-3 text-muted-foreground">{horario.docente.nombre}</td><td className="px-4 py-3 text-muted-foreground">{horario.grupo?.nombre ?? 'Sin grupo'}</td><td className="px-4 py-3 text-muted-foreground">{horario.aula?.nombre ?? 'Sin aula'}</td></tr>)}</tbody></table></div></div>
      )}

      {sesionSeleccionada && (
        <AsistenciaSesionModal sesionId={sesionSeleccionada} onClose={() => setSesionSeleccionada(null)} />
      )}
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{children}</button>
}
