const COLORES = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-indigo-500',
]

export function colorParaMateria(index) {
  return COLORES[index % COLORES.length]
}

export default function TarjetaMateria({
  horario,
  colorIndex,
  onClick,
  modoEdicion = false,
  activa = false,
}) {
  const color = colorParaMateria(colorIndex)

  return (
    <div
      onClick={() => onClick?.(horario)}
      className={`${color} group relative h-full cursor-pointer overflow-hidden rounded-md p-1.5 text-white transition-all hover:brightness-110 ${
        activa ? 'ring-2 ring-slate-900 ring-offset-1' : ''
      }`}
      title={`${horario.materia.nombre} | ${horario.horaInicio}–${horario.horaFin}${horario.aula ? ` | ${horario.aula.nombre}` : ''}${modoEdicion ? ' | Clic para editar' : ''}`}
    >
      <p className="truncate text-xs font-semibold leading-tight">{horario.materia.nombre}</p>
      {horario.grupo && <p className="truncate text-xs opacity-85">{horario.grupo.nombre}</p>}
      {horario.aula && <p className="truncate text-xs opacity-80">{horario.aula.nombre}</p>}
      {modoEdicion && (
        <span className="absolute right-1 top-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          ✏️
        </span>
      )}
    </div>
  )
}
