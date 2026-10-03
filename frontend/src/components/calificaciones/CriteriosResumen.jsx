import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resumenCriterios } from '@/lib/criterios'

/**
 * Una línea con los criterios de evaluación del grupo y el botón para
 * editarlos. `lista` es la lista base que manda el reporte ({ origen, criterios }).
 */
export default function CriteriosResumen({ lista, grupo, unidadesPropias = [], onEditar, className }) {
  let texto
  if (!grupo) {
    texto = 'Cada grupo tiene sus criterios. Elige un grupo para verlos o editarlos.'
  } else if (!lista) {
    texto = 'Cargando criterios…'
  } else if (lista.origen === 'PREDETERMINADA') {
    texto = `Predeterminada: ${resumenCriterios(lista.criterios.filter((item) => item.peso > 0))}. Agrega examen, prácticas o participación en «Editar criterios».`
  } else {
    texto = resumenCriterios(lista.criterios)
  }

  return (
    <section aria-labelledby="criterios-resumen" className={className ?? 'rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="criterios-resumen" className="text-sm font-semibold text-foreground">Criterios de evaluación</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {texto}
            {unidadesPropias.length === 1 && ` La Unidad ${unidadesPropias[0]} tiene porcentajes propios.`}
            {unidadesPropias.length > 1 && ` Las unidades ${unidadesPropias.slice(0, -1).join(', ')} y ${unidadesPropias.at(-1)} tienen porcentajes propios.`}
          </p>
        </div>
        {grupo && (
          <Button variant="outline" onClick={onEditar}>
            <SlidersHorizontal aria-hidden="true" />
            Editar criterios
          </Button>
        )}
      </div>
    </section>
  )
}
