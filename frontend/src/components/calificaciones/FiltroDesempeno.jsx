import { Segmentado } from '@/pages/docente/components/tareas/Controles'
import { DESEMPENO, ORDEN_DESEMPENO } from '@/lib/desempeno'

/**
 * Filtro por semáforo con su conteo. `resumen` trae { total, aprobados,
 * enRiesgo, reprobados, sinCalificar }; `value` es 'TODOS' o un estado.
 */
export default function FiltroDesempeno({ resumen, value, onChange, className }) {
  const cuentas = {
    REPROBADO: resumen?.reprobados ?? 0,
    EN_RIESGO: resumen?.enRiesgo ?? 0,
    SIN_CALIFICAR: resumen?.sinCalificar ?? 0,
    APROBADO: resumen?.aprobados ?? 0,
  }
  const options = [
    { value: 'TODOS', label: 'Todos', count: resumen?.total ?? 0 },
    ...ORDEN_DESEMPENO.map((estado) => ({
      value: estado,
      label: DESEMPENO[estado].plural,
      count: cuentas[estado],
      tono: cuentas[estado] ? DESEMPENO[estado].cifra : undefined,
      // Cada estado con color va siempre en su propio fondo, aun en cero.
      fondo: DESEMPENO[estado].fondo,
      punto: DESEMPENO[estado].punto,
    })),
  ]
  return <Segmentado apilado label="Filtrar por estado" value={value} onChange={onChange} options={options} className={className} />
}
