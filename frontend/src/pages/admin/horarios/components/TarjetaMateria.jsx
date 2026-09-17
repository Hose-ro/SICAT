import { colorParaMateria } from '@/lib/horarioColors'
export default function TarjetaMateria({
  horario,
  colorIndex,
  onClick,
  modoEdicion = false,
  activa = false,
}) {
  const color = colorParaMateria(colorIndex)

  return (
    <button type="button"
      onClick={() => onClick?.(horario)}
      className={`${color} group relative h-full cursor-pointer overflow-hidden rounded-md p-1.5 w-full border-0 text-left text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring ${
        activa ? 'ring-2 ring-ring ring-offset-1' : ''
      }`}
      title={`${horario.materia.nombre} | ${horario.horaInicio}–${horario.horaFin}${horario.aula ? ` | ${horario.aula.nombre}` : ''}${modoEdicion ? ' | Clic para editar' : ''}`}
    >
      <p className="truncate text-xs font-semibold leading-tight">{horario.materia.nombre}</p>
      {horario.grupo && <p className="truncate text-xs">{horario.grupo.nombre}</p>}
      {horario.aula && <p className="truncate text-xs">{horario.aula.nombre}</p>}
      {modoEdicion && (
        <span className="absolute right-1 top-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          ✏️
        </span>
      )}
    </button>
  )
}
