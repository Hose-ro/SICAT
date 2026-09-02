import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, UserRound } from 'lucide-react'
import api from '@/api/axios'
import PageHeader from '@/components/PageHeader'
import { CarreraSelector, PageState, StatusBadge } from '@/components/jefe-carrera/JefeCarreraUI'
import { useJefeCarreraStore } from '@/store/jefeCarreraStore'

export default function JefeDocentes() {
  const carreraId = useJefeCarreraStore((state) => state.carreraId)
  const [docentes, setDocentes] = useState([])
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/jefe-carrera/docentes', {
        params: { carreraId: carreraId || undefined, estado: estado || undefined },
      })
      setDocentes(data)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'No se pudo cargar el directorio')
    } finally {
      setLoading(false)
    }
  }, [carreraId, estado])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('es-MX')
    if (!term) return docentes
    return docentes.filter((docente) =>
      [docente.nombre, docente.email, ...docente.docenteMaterias.map((materia) => materia.nombre)]
        .filter(Boolean).some((value) => value.toLocaleLowerCase('es-MX').includes(term)),
    )
  }, [docentes, q])

  return (
    <div className="space-y-5">
      <PageHeader title="Docentes" subtitle="Directorio, carga académica y estado actual" action={<CarreraSelector />} />
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Buscar docente o materia</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(event) => setQ(event.target.value)} className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40" placeholder="Nombre, correo o materia" />
          </span>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Estado</span>
          <select value={estado} onChange={(event) => setEstado(event.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-48">
            <option value="">Todos</option><option value="EN_CURSO">En curso</option><option value="FUERA_DE_HORARIO">Fuera de horario</option><option value="SIN_CLASE">Sin clase</option>
          </select>
        </label>
      </div>

      <PageState loading={loading} error={error} empty={!filtrados.length} emptyText="No hay docentes que coincidan con los filtros." />
      {!loading && !error && filtrados.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/70"><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Docente</th><th className="px-4 py-3 font-medium">Materias</th><th className="px-4 py-3 font-medium">Carga</th><th className="px-4 py-3 font-medium">Estado</th><th className="px-4 py-3 text-right font-medium">Detalle</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filtrados.map((docente) => (
                  <tr key={docente.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="h-4 w-4" /></span><div><p className="font-medium text-foreground">{docente.nombre}</p><p className="text-xs text-muted-foreground">{docente.email ?? 'Sin correo registrado'}</p></div></div></td>
                    <td className="px-4 py-3 text-muted-foreground">{docente.docenteMaterias.length}</td>
                    <td className="px-4 py-3 text-muted-foreground">{docente.cargaSemanal} horario(s)</td>
                    <td className="px-4 py-3"><StatusBadge value={docente.estado} /></td>
                    <td className="px-4 py-3 text-right"><Link to={`/jefe-carrera/docentes/${docente.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Consultar <ArrowRight className="h-4 w-4" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
