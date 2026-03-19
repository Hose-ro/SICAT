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

export default function TarjetaMateria({ horario, colorIndex, onClick }) {
  const color = colorParaMateria(colorIndex)

  return (
    <div
      onClick={() => onClick?.(horario)}
      className={`${color} text-white rounded-md p-1.5 cursor-pointer h-full overflow-hidden hover:brightness-110 transition-all`}
      title={`${horario.materia.nombre} | ${horario.horaInicio}–${horario.horaFin}${horario.aula ? ` | ${horario.aula.nombre}` : ''}`}
    >
      <p className="text-xs font-semibold leading-tight truncate">{horario.materia.nombre}</p>
      {horario.grupo && (
        <p className="text-xs opacity-85 truncate">{horario.grupo.nombre}</p>
      )}
      {horario.aula && (
        <p className="text-xs opacity-80 truncate">{horario.aula.nombre}</p>
      )}
    </div>
  )
}
