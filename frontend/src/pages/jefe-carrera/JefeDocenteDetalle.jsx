import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Mail, Phone, UserRound } from 'lucide-react'
import api from '@/api/axios'
import { MetricRow, PageState, StatusBadge } from '@/components/jefe-carrera/JefeCarreraUI'

export default function JefeDocenteDetalle() {
  const { id } = useParams()
  const [docente, setDocente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/jefe-carrera/docentes/${id}`)
      .then(({ data }) => setDocente(data))
      .catch((requestError) => setError(requestError.response?.data?.message ?? 'No se pudo cargar el docente'))
      .finally(() => setLoading(false))
  }, [id])

  const state = <PageState loading={loading} error={error} empty={!docente} />
  if (loading || error || !docente) return state

  return (
    <div className="space-y-6">
      <Link to="/jefe-carrera/docentes" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a docentes</Link>
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><UserRound className="h-7 w-7" /></span>
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-semibold text-foreground">{docente.nombre}</h1><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">{docente.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{docente.email}</span>}{docente.telefono && <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" />{docente.telefono}</span>}</div></div>
      </header>

      <MetricRow items={[
        { label: 'Carga semanal', value: docente.resumen.cargaSemanal },
        { label: 'Clases registradas', value: docente.resumen.clasesRegistradas },
        { label: 'Clases finalizadas', value: docente.resumen.clasesFinalizadas },
        { label: 'Cumplimiento', value: `${docente.resumen.porcentajeFinalizacion}%` },
      ]} />

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-muted-foreground" /><h2 className="text-base font-semibold text-foreground">Horario semanal</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="pb-3 font-medium">Días</th><th className="pb-3 font-medium">Horario</th><th className="pb-3 font-medium">Materia</th><th className="pb-3 font-medium">Grupo</th><th className="pb-3 font-medium">Aula</th></tr></thead><tbody className="divide-y divide-border">{docente.horariosDocente.map((horario) => <tr key={horario.id}><td className="py-3 text-foreground">{horario.dias}</td><td className="py-3 text-muted-foreground">{horario.horaInicio}-{horario.horaFin}</td><td className="py-3 text-muted-foreground">{horario.materia.nombre}</td><td className="py-3 text-muted-foreground">{horario.grupo?.nombre ?? 'Sin grupo'}</td><td className="py-3 text-muted-foreground">{horario.aula?.nombre ?? 'Sin aula'}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold text-foreground">Historial reciente de clases</h2>
        {docente.claseSesiones.length ? <div className="divide-y divide-border">{docente.claseSesiones.map((sesion) => <div key={sesion.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-medium text-foreground">{sesion.materia.nombre}</p><p className="text-xs text-muted-foreground">{sesion.grupo?.nombre ?? 'Sin grupo'} · {new Date(sesion.fecha).toLocaleDateString('es-MX')}</p></div><span className="text-xs text-muted-foreground">{sesion._count.asistencias} registros</span><StatusBadge value={sesion.activa ? (sesion.fueFueraDeHorario ? 'FUERA_DE_HORARIO' : 'EN_CURSO') : 'FINALIZADA'} /></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Sin clases registradas.</p>}
      </section>
    </div>
  )
}
