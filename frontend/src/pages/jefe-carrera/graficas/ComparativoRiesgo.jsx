import BarrasRiesgo from '@/components/graficas/BarrasRiesgo'
import { comparativoGrupos } from '@/components/graficas/riesgo'
import { modalidadTexto } from '../supervision/formato'
import { SeccionTitulo } from '../supervision/ui'

/** Proporción de alumnos en riesgo por grupo; cada grupo abre su pestaña Riesgo. */
export default function ComparativoRiesgo({ j, grupos }) {
  const todos = comparativoGrupos(grupos)
  if (!todos?.length) return null
  const conRiesgo = todos.some((g) => g.alumnosRiesgo > 0)

  return (
    <section className="mt-8" aria-labelledby="comparativo-riesgo">
      <SeccionTitulo
        id="comparativo-riesgo"
        titulo="Riesgo por grupo"
        descripcion={conRiesgo
          ? 'Porcentaje de alumnos con señales de riesgo en alguna materia del grupo. Abre un grupo para ver quién y en qué materia.'
          : 'Ningún grupo tiene alumnos con señales de riesgo en este periodo.'}
      />
      <BarrasRiesgo
        accion="Ver mapa de riesgo"
        filas={todos.map((g) => ({
          id: g.id,
          nombre: g.nombre,
          detalle: modalidadTexto(g.modalidad),
          alumnosRiesgo: g.alumnosRiesgo,
          evaluados: g.alumnosEvaluados,
          reprobando: g.motivos.reprobando,
          motivos: g.motivos,
          to: g.periodoDisponible === false ? null : j.to(`/jefe-carrera/grupos/${g.id}`, { periodo: g.periodoConsulta, tab: 'riesgo' }),
        }))}
      />
    </section>
  )
}
