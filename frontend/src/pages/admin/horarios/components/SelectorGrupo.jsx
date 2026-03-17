import { useEffect, useMemo, useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'

export default function SelectorGrupo() {
  const {
    grupos,
    cargarGrupos,
    seleccionarGrupo,
    grupoSeleccionado,
  } = useHorarioStore()

  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    cargarGrupos()
  }, [cargarGrupos])

  const filtrados = useMemo(() => {
    const query = busqueda.toLowerCase()
    return grupos.filter((g) => {
      const nombre = g.nombre?.toLowerCase() || ''
      const carrera = g.carrera?.nombre?.toLowerCase() || ''
      return nombre.includes(query) || carrera.includes(query)
    })
  }, [grupos, busqueda])

  async function handleSelect(grupo) {
    setBusqueda(grupo.nombre)
    setAbierto(false)
    await seleccionarGrupo(grupo.id)
  }

  return (
    <div className="relative">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
        Grupo
      </label>
      <input
        type="text"
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        placeholder="Buscar grupo (101A, 2026-A)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtrados.map((g) => (
            <button
              key={g.id}
              onClick={() => handleSelect(g)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
            >
              <p className="font-medium">{g.nombre}</p>
              <p className="text-xs text-slate-400">
                {g.carrera?.nombre ?? 'Sin carrera'} · Sem {g.semestre} · {g.periodo}
              </p>
            </button>
          ))}
        </div>
      )}
      {grupoSeleccionado && (
        <p className="mt-1 text-xs text-slate-500">Mostrando horario de {grupoSeleccionado.nombre}</p>
      )}
    </div>
  )}

