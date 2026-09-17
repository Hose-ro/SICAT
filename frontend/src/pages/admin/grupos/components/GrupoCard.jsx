import { Link } from 'react-router-dom'

export default function GrupoCard({ grupo }) {

  return (
    <Link
      to={`/admin/grupos/${grupo.id}`}
      className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-border transition-[color,background-color,border-color,opacity,transform]"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-3xl font-bold text-primary-ink">{grupo.nombre}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{grupo.carrera?.nombre}</p>
        </div>
        <span className="text-xs font-semibold bg-accent text-primary-ink px-2.5 py-1 rounded-full">
          Sem. {grupo.semestre}
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{grupo.periodo}</p>

      <div className="flex gap-2">
        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
          {grupo._count?.alumnos ?? 0} alumnos
        </span>
        <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
          {grupo._count?.materias ?? 0} materias
        </span>
      </div>
    </Link>
  )
}
