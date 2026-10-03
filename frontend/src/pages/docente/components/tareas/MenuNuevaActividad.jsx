import { ChevronDown, Plus, SlidersHorizontal } from 'lucide-react'
import { criteriosDeActividad, TIPOS_CRITERIO, tipoCriterio } from '@/lib/criterios'
import { MenuAcciones } from './Controles'

// Lo que un docente suele querer crear aunque su grupo todavía no lo califique.
const SUGERIDAS = ['EXAMEN', 'PRACTICAS', 'PROYECTO', 'EXPOSICION']

/**
 * "Nueva actividad": un tipo por cada criterio de actividad del grupo (examen,
 * práctica…). Lo que el grupo aún no califica abre sus criterios con esa
 * plantilla ya agregada, para darle su porcentaje. `datos` es la respuesta de
 * GET /calificaciones/criterios.
 */
export default function MenuNuevaActividad({ datos, unidadId, onElegir, onConfigurar, trigger, label = 'Nueva actividad', className, align = 'end' }) {
  const predeterminada = !datos || datos.base?.origen === 'PREDETERMINADA'
  const criterios = criteriosDeActividad(datos, unidadId)
  const tiposPresentes = new Set(criterios.map((criterio) => criterio.tipo))

  const items = [
    ...(predeterminada
      ? [{ label: 'Tarea', icon: TIPOS_CRITERIO.TAREAS.icono, onSelect: () => onElegir(null) }]
      : criterios.map((criterio) => ({
        label: `${criterio.nombre} · ${criterio.peso} %`,
        icon: tipoCriterio(criterio.tipo).icono,
        onSelect: () => onElegir(criterio),
      }))),
    { separator: true },
    ...SUGERIDAS.filter((tipo) => !tiposPresentes.has(tipo)).map((tipo) => ({
      label: `${TIPOS_CRITERIO[tipo].label}: agregar a los criterios…`,
      icon: TIPOS_CRITERIO[tipo].icono,
      onSelect: () => onConfigurar(tipo),
    })),
    { label: 'Configurar criterios…', icon: SlidersHorizontal, onSelect: () => onConfigurar(null) },
  ]

  return (
    <MenuAcciones label={label} items={items} align={align} className={className}
      trigger={trigger ?? <><Plus className="size-4" aria-hidden="true" />{label}<ChevronDown className="size-3.5" aria-hidden="true" /></>} />
  )
}
