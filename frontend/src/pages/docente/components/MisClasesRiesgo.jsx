import { useId } from 'react'
import { Link } from 'react-router-dom'
import BarrasRiesgo from '@/components/graficas/BarrasRiesgo'

/**
 * Riesgo por clase del docente: en qué materia y grupo poner atención
 * primero. Elegir una clase la abre en «Desempeño por unidad». Si ninguna
 * clase tiene alumnos en riesgo, no ocupa espacio.
 */
export default function MisClasesRiesgo({ materias = [], onElegir }) {
  const idTitulo = useId()
  const filas = materias
    .filter((m) => m.grupo?.id && m.riesgo?.evaluados > 0)
    .map((m) => {
      const clave = `${m.id}:${m.grupo.id}`
      return {
        id: clave,
        nombre: m.nombre,
        detalle: m.grupo.nombre,
        alumnosRiesgo: m.riesgo.enRiesgo,
        evaluados: m.riesgo.evaluados,
        reprobando: m.riesgo.reprobando,
        motivos: m.riesgo.motivos,
        onClick: () => onElegir(clave),
      }
    })
  if (!filas.some((f) => f.alumnosRiesgo > 0)) return null

  return (
    <section aria-labelledby={idTitulo} className="rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={idTitulo} className="text-xl font-semibold tracking-tight text-foreground">Riesgo por clase</h2>
          <p className="mt-1 text-sm text-muted-foreground">Porcentaje de alumnos con señales de riesgo en cada clase. Elige una para ver su desempeño por unidad.</p>
        </div>
        <Link to="/docente/riesgo" className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium text-primary-ink underline-offset-4 hover:underline">
          Ver alumnos en riesgo
        </Link>
      </div>
      <BarrasRiesgo filas={filas} accion="Ver su desempeño por unidad" sinRiesgoTexto="Clases sin alumnos en riesgo" />
    </section>
  )
}
