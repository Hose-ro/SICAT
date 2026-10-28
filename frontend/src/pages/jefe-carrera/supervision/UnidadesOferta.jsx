import { Chip } from '@/components/Chip'
import { Button } from '@/components/ui/button'
import { ESTADO_UNIDAD } from './estados'
import { Nota, Promedio } from './notas'
import { reintentarReportes, resumenAlumno } from './useReportes'
import { Aviso, Vacio } from './ui'

/**
 * Unidades y calificaciones de una materia en un grupo (consulta). Se usa en
 * el detalle de la materia y en el del grupo con el mismo reporte en caché:
 * una sola tabla, un solo cálculo.
 */
export default function UnidadesOferta({ oferta, estado = { cargando: true } }) {
  const reporte = estado.data
  if (estado.error) return <Aviso tono="error" titulo="No se pudo consultar la materia" accion={<Button variant="outline" onClick={reintentarReportes}>Reintentar</Button>}>{estado.error}</Aviso>
  if (!reporte) return <div className="mt-5 h-64 animate-pulse rounded-[var(--radius-item)] bg-muted motion-reduce:animate-none" aria-busy="true" />

  const unidades = reporte.unidades ?? []
  const fechas = new Map(oferta.unidades.map((u) => [u.id, u]))
  const alumnos = new Map()
  ;(reporte.rows ?? []).forEach((row) => {
    if (!alumnos.has(row.alumno.id)) alumnos.set(row.alumno.id, { alumno: row.alumno, celdas: {} })
    alumnos.get(row.alumno.id).celdas[row.unidad?.id ?? row.unidad?.orden] = row
  })

  return (
    <>
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Avance de unidades">
        {unidades.map((u) => {
          const info = ESTADO_UNIDAD[u.status] ?? ESTADO_UNIDAD.PENDIENTE
          const fin = fechas.get(u.id)?.fechaFin
          return (
            <li key={u.id ?? u.orden}>
              <Chip tone={info.tono}>{u.nombre} · {info.label}{u.status === 'FINALIZADA' ? '' : fin ? ` · cierre ${new Date(fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ' · sin plazo definido'}</Chip>
            </li>
          )
        })}
      </ul>
      {alumnos.size ? (
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-item)] border border-border bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40" role="region" aria-label={`Calificaciones de ${oferta.materia.nombre}, grupo ${oferta.grupo.nombre}, por unidad`} tabIndex={0}>
          <table className="w-full min-w-[720px] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border bg-background text-left text-xs text-muted-foreground">
                <th scope="col" className="sticky left-0 bg-background px-4 py-2.5 font-medium">Alumno</th>
                {unidades.map((u) => <th key={u.id ?? u.orden} scope="col" className="px-3 py-2.5 text-right font-medium">{u.nombre}</th>)}
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Promedio</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Observaciones del docente</th>
              </tr>
            </thead>
            <tbody>
              {[...alumnos.values()].map(({ alumno, celdas }) => {
                const r = resumenAlumno(Object.values(celdas))
                return (
                  <tr key={alumno.id} className="border-b border-border last:border-b-0">
                    <th scope="row" className="sticky left-0 bg-card px-4 py-3 text-left font-medium text-foreground">{alumno.nombre}</th>
                    {unidades.map((u) => <td key={u.id ?? u.orden} className="px-3 py-3 text-right"><Nota row={celdas[u.id ?? u.orden]} /></td>)}
                    <td className="px-3 py-3 text-right"><Promedio r={r} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.observaciones.length ? r.observaciones.map((o) => <p key={o.unidad}><b className="font-medium text-foreground">{o.unidad}:</b> {o.texto}</p>) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Vacio titulo="Sin alumnos inscritos">La materia no tiene inscripciones aceptadas en este grupo.</Vacio>}
      <p className="mt-2.5 text-xs text-muted-foreground">Las calificaciones son de consulta. Una celda sin captura no cuenta como cero.</p>
    </>
  )
}
