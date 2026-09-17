import { Button } from '@/components/ui/button'
import { useId, useMemo, useState } from 'react'
import { useHorarioStore } from '../../../../store/horarioStore'

export default function SelectorDocente() {
  const fieldId = useId()
  const [busquedaEditada, setBusqueda] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const { seleccionarDocente, docenteSeleccionado, docentesCatalogo } = useHorarioStore()

  const busqueda = busquedaEditada ?? docenteSeleccionado?.nombre ?? ''

  const filtrados = useMemo(() => (
    docentesCatalogo.filter((docente) =>
      docente.nombre.toLowerCase().includes(busqueda.toLowerCase()),
    )
  ), [docentesCatalogo, busqueda])

  async function handleSelect(docente) {
    setBusqueda(null)
    setAbierto(false)
    await seleccionarDocente(docente.id)
  }


  return (
    <div className="relative">
      <label htmlFor={fieldId + '-control-32'} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
        Docente
      </label>
      <input id={fieldId + '-control-32'}
        type="text"
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        placeholder="Buscar docente..."
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtrados.map((d) => (
            <Button variant="ghost" size="row"
              key={d.id}
              onClick={() => handleSelect(d)}
              className="px-3 py-2 text-sm hover:bg-background"
            >
              <p className="font-medium">{d.nombre}</p>
              {d.academias?.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {d.academias.map((a) => a.nombre).join(', ')}
                </p>
              )}
            </Button>
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
                  className="text-xs px-2 py-0.5 rounded-full bg-accent text-primary-ink"
                >
                  {a.nombre}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-warning-foreground">Sin academia asignada</p>
          )}
        </div>
      )}
    </div>
  )
}
