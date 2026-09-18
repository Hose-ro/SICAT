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
      <select aria-label="Carrera"
        value={filtros.carreraId ?? ''}
        onChange={(e) => handleChange('carreraId', e.target.value ? Number(e.target.value) : undefined)}
        className="border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Todas las carreras</option>
        {carreras.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>

      <select aria-label="Semestre"
        value={filtros.semestre ?? ''}
        onChange={(e) => handleChange('semestre', e.target.value ? Number(e.target.value) : undefined)}
        className="border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Todos los semestres</option>
        {SEMESTRES.map((s) => (
          <option key={s} value={s}>Semestre {s}</option>
        ))}
      </select>

      <select aria-label="Modalidad"
        value={filtros.modalidad ?? ''}
        onChange={(e) => handleChange('modalidad', e.target.value)}
        className="border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Todas las modalidades</option>
        <option value="ESCOLARIZADO">Escolarizado</option>
        <option value="MIXTO">Mixto</option>
      </select>

      <input aria-label="Periodo escolar"
        type="text"
        placeholder="Periodo (ej: 2026-A)"
        value={filtros.periodo ?? ''}
        onChange={(e) => handleChange('periodo', e.target.value)}
        className="border border-border rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-44"
      />
    </div>
  )
}
