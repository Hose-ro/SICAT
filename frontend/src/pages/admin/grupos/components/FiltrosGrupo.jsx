import { useEffect, useState } from 'react'
import api from '../../../../api/axios'
import { useGrupoStore } from '../../../../store/grupoStore'

const SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function FiltrosGrupo() {
  const { filtros, setFiltros } = useGrupoStore()
  const [carreras, setCarreras] = useState([])

  useEffect(() => {
    api.get('/carreras').then((res) => setCarreras(res.data)).catch(() => {})
  }, [])

  const handleChange = (campo, valor) => {
    setFiltros({ ...filtros, [campo]: valor || undefined })
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select
        value={filtros.carreraId ?? ''}
        onChange={(e) => handleChange('carreraId', e.target.value ? Number(e.target.value) : undefined)}
        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todas las carreras</option>
        {carreras.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>

      <select
        value={filtros.semestre ?? ''}
        onChange={(e) => handleChange('semestre', e.target.value ? Number(e.target.value) : undefined)}
        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos los semestres</option>
        {SEMESTRES.map((s) => (
          <option key={s} value={s}>Semestre {s}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Periodo (ej: 2026-A)"
        value={filtros.periodo ?? ''}
        onChange={(e) => handleChange('periodo', e.target.value)}
        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
      />
    </div>
  )
}
