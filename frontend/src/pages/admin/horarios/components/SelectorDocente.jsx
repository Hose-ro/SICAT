import { useEffect, useMemo, useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'

export default function SelectorDocente() {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const { seleccionarDocente, docenteSeleccionado, docentesCatalogo } = useHorarioStore()

  const filtrados = useMemo(() => (
    docentesCatalogo.filter((docente) =>
      docente.nombre.toLowerCase().includes(busqueda.toLowerCase()),
    )
  ), [docentesCatalogo, busqueda])

  async function handleSelect(docente) {
    setBusqueda(docente.nombre)
    setAbierto(false)
    await seleccionarDocente(docente.id)
  }

  useEffect(() => {
    if (docenteSeleccionado?.nombre) {
      setBusqueda(docenteSeleccionado.nombre)
    }
  }, [docenteSeleccionado?.nombre])

  return (
    <div className="relative">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
        Docente
      </label>
      <input
        type="text"
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        placeholder="Buscar docente..."
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtrados.map((d) => (
            <button
              key={d.id}
              onClick={() => handleSelect(d)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
            >
              <p className="font-medium">{d.nombre}</p>
              {d.academias?.length > 0 && (
                <p className="text-xs text-slate-400">
                  {d.academias.map((a) => a.nombre).join(', ')}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
      {docenteSeleccionado && (
        <div className="mt-1.5 space-y-1">
          {docenteSeleccionado.academias?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {docenteSeleccionado.academias.map((a) => (
                <span
                  key={a.id}
                  className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"
                >
                  {a.nombre}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-500">Sin academia asignada</p>
          )}
        </div>
      )}
    </div>
  )
}
