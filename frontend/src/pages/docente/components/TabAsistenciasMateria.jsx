import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useAsistenciaStore } from '../../../store/asistenciaStore'


export default function TabAsistenciasMateria({ materiaId }) {
  const { resumen, obtenerResumen, exportar, loading } = useAsistenciaStore()
  const [unidad, setUnidad] = useState('')

  useEffect(() => { obtenerResumen(materiaId, unidad || undefined) }, [materiaId, unidad, obtenerResumen])

  const handleExportar = (formato) => exportar(materiaId, formato, unidad || undefined)

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <select aria-label="Unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="">Todas las unidades</option>
          {[1,2,3,4,5].map((u) => <option key={u} value={u}>Unidad {u}</option>)}
        </select>
        <Button variant="ghost" onClick={() => handleExportar('excel')}
          className="px-3 py-2 bg-success text-success-on-fill  text-sm hover:bg-success">
          Exportar Excel
        </Button>
        <Button variant="destructive" onClick={() => handleExportar('pdf')}
          className="px-3 py-2 text-sm">
          Exportar PDF
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : resumen.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sin datos de asistencia</p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de asistencias">
          <table className="min-w-full text-sm border">
            <thead className="bg-background">
              <tr>
                <th className="border px-3 py-2 text-left">Alumno</th>
                <th className="border px-3 py-2">Asistencias</th>
                <th className="border px-3 py-2">Faltas</th>
                <th className="border px-3 py-2">Retardos</th>
                <th className="border px-3 py-2">Justificadas</th>
                <th className="border px-3 py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.alumnoId} className="hover:bg-background">
                  <td className="border px-3 py-2">
                    <p className="font-medium">{r.nombre}</p>
                    <p className="text-xs text-muted-foreground">{r.numControl}</p>
                  </td>
                  <td className="border px-3 py-2 text-center text-success-foreground">{r.asistencias}</td>
                  <td className="border px-3 py-2 text-center text-destructive-foreground">{r.faltas}</td>
                  <td className="border px-3 py-2 text-center text-warning-foreground">{r.retardos}</td>
                  <td className="border px-3 py-2 text-center text-primary-ink">{r.justificadas}</td>
                  <td className="border px-3 py-2 text-center">
                    <span className={`font-semibold ${r.porcentaje >= 70 ? "text-success-foreground" : "text-destructive-foreground"}`}>
                      {r.porcentaje}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
