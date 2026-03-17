import { useNavigate } from 'react-router-dom'

export default function GrupoCard({ grupo }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/admin/grupos/${grupo.id}`)}
      className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-3xl font-bold text-blue-600">{grupo.nombre}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{grupo.carrera?.nombre}</p>
        </div>
        <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
          Sem. {grupo.semestre}
        </span>
      </div>

      <p className="text-xs text-gray-400 mb-3">{grupo.periodo}</p>

      <div className="flex gap-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          {grupo._count?.alumnos ?? 0} alumnos
        </span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          {grupo._count?.materias ?? 0} materias
        </span>
      </div>
    </div>
  )
}
