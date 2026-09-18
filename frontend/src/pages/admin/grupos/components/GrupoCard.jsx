
import { Link } from 'react-router-dom'

const cardClassName =
  'relative block bg-card border border-border rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-border transition-[color,background-color,border-color,opacity,transform]'

export default function GrupoCard({ grupo, seleccionable = false, seleccionado = false, onToggleSeleccion }) {
  const contenido = (
    <>
      {seleccionable && (
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={() => onToggleSeleccion?.(grupo.id)}
          aria-label={`Seleccionar ${grupo.nombre}`}
          className="absolute right-4 top-4 h-4 w-4"
        />
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-3xl font-bold text-primary-ink">{grupo.nombre}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{grupo.carrera?.nombre}</p>
        </div>
        {!seleccionable && (
          <span className="text-xs font-semibold bg-accent text-primary-ink px-2.5 py-1 rounded-full">
            Sem. {grupo.semestre}
          </span>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        {grupo.periodo}
        {grupo.modalidad === 'MIXTO' && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary-ink">Mixto</span>
        )}
      </p>

      <div className="flex gap-2">
        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
          {grupo._count?.alumnos ?? 0} alumnos
        </span>
        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
          {grupo._count?.materias ?? 0} materias
        </span>
      </div>
    </>
  )

  // En modo selección toda la tarjeta es la etiqueta de su casilla; fuera de
  // él sigue siendo un enlace real al detalle, navegable con teclado.
  if (seleccionable) {
    return <label className={cardClassName}>{contenido}</label>
  }

  return (
    <Link to={`/admin/grupos/${grupo.id}`} className={cardClassName}>
      {contenido}
    </Link>
  )
}
