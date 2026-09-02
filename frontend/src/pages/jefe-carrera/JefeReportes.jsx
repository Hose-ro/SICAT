import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import api from '@/api/axios'
import PageHeader from '@/components/PageHeader'
import { CarreraSelector, MetricRow, PageState } from '@/components/jefe-carrera/JefeCarreraUI'
import { useJefeCarreraStore } from '@/store/jefeCarreraStore'

export default function JefeReportes() {
  const carreraId = useJefeCarreraStore((state) => state.carreraId)
  const [reporte, setReporte] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    api.get('/jefe-carrera/reportes', { params: carreraId ? { carreraId } : {} })
      .then(({ data }) => { if (active) { setReporte(data); setError('') } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'No se pudo generar el reporte') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [carreraId])

  const descargar = async (formato) => {
    setDownloading(formato)
    try {
      const response = await api.get('/jefe-carrera/reportes/exportar', { params: { carreraId: carreraId || undefined, formato }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url; link.download = `reporte-jefatura-carrera.${formato === 'pdf' ? 'pdf' : 'xlsx'}`; link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) { setError(requestError.response?.data?.message ?? 'No se pudo descargar el reporte') }
    finally { setDownloading('') }
  }

  const state = <PageState loading={loading} error={error} empty={!reporte} />
  if (loading || error || !reporte) return <><PageHeader title="Reportes" action={<CarreraSelector />} />{state}</>

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" subtitle="Resumen institucional dentro de tus carreras asignadas" action={<CarreraSelector />} />
      <div className="flex flex-wrap gap-2"><button type="button" disabled={downloading} onClick={() => descargar('excel')} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"><FileSpreadsheet className="h-4 w-4" /> Descargar Excel</button><button type="button" disabled={downloading} onClick={() => descargar('pdf')} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"><FileText className="h-4 w-4" /> Descargar PDF</button></div>
      <MetricRow items={[
        { label: 'Docentes', value: reporte.resumen.docentes },
        { label: 'Clases de hoy', value: reporte.resumen.clasesHoy },
        { label: 'Asistencia promedio', value: `${reporte.resumen.asistenciaPromedio}%` },
        { label: 'Alumnos en riesgo', value: reporte.resumen.alumnosRiesgo, tone: reporte.resumen.alumnosRiesgo ? 'text-destructive' : 'text-success' },
      ]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportTable title="Carga docente" columns={['Docente', 'Horarios', 'Materias']} rows={reporte.cargaDocente.map((item) => [item.docente, item.horarios, item.materias])} />
        <ReportTable title="Alumnos en riesgo" columns={['Alumno', 'Registros', 'Riesgo']} rows={reporte.alumnosRiesgo.map((item) => [item.nombre, item.total, `${item.porcentajeRiesgo}%`])} empty="No hay alumnos que superen el criterio de riesgo." />
        <ReportTable title="Avance por materia" columns={['Materia', 'Docente', 'Unidad']} rows={reporte.materias.map((item) => [`${item.clave} ${item.nombre}`, item.docente, item.unidadActiva])} />
        <ReportTable title="Uso de aulas" columns={['Aula', 'Edificio', 'Horarios']} rows={reporte.usoAulas.map((item) => [item.nombre, item.edificio ?? 'Sin edificio', item.horarios])} empty="No hay aulas asignadas." />
      </div>
    </div>
  )
}

function ReportTable({ title, columns, rows, empty = 'Sin datos para mostrar.' }) {
  return <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-foreground">{title}</h2></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="bg-muted/70"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{column}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((value, cellIndex) => <td key={cellIndex} className={`px-4 py-3 ${cellIndex === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{value}</td>)}</tr>)}</tbody></table></div> : <p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>}</section>
}
