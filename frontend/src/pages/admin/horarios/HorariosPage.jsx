import { useEffect, useState } from 'react'
import { useHorarioStore } from '../../../store/horarioStore'
import SelectorDocente from './components/SelectorDocente'
import GridHorario from './components/GridHorario'
import ListaMateriasDisponibles from './components/ListaMateriasDisponibles'
import SelectorGrupo from './components/SelectorGrupo'

export default function HorariosPage() {
  const { cargarAulas, error, clearError } = useHorarioStore()
  const [modo, setModo] = useState('docente') // 'docente' | 'grupo'

  useEffect(() => {
    cargarAulas()
  }, [cargarAulas])

  return (
    <div className="h-full flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Horarios</h1>
        <p className="text-sm text-slate-500">Asigna docentes y aulas a cada materia</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      <div className="flex gap-3 text-sm">
        <button
          className={`px-3 py-1.5 rounded-lg border ${modo === 'docente' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600'}`}
          onClick={() => setModo('docente')}
        >
          Vista por docente
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg border ${modo === 'grupo' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600'}`}
          onClick={() => setModo('grupo')}
        >
          Vista por grupo
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">
          {modo === 'docente' ? (
            <>
              <SelectorDocente />
              <div className="border-t border-slate-200 pt-4">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Materias sin docente
                </h2>
                <ListaMateriasDisponibles />
              </div>
            </>
          ) : (
            <SelectorGrupo />
          )}
        </aside>

        {/* Main grid */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-white rounded-xl border border-slate-200 p-4">
          <GridHorario modo={modo} />
        </main>
      </div>
    </div>
  )
}
