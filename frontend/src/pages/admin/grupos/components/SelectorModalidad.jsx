import { ETIQUETA_MODALIDAD } from '../../../../lib/periodo'

/** Escolarizado va de lunes a viernes; mixto sólo sábados, con su propio calendario. */
const OPCIONES = [
  { valor: 'ESCOLARIZADO', descripcion: 'Lunes a viernes', ejemplo: '103-A' },
  { valor: 'MIXTO', descripcion: 'Sólo sábados', ejemplo: '103-SA' },
]

/**
 * Dos tarjetas que funcionan como radios: la casilla queda sólo para lectores
 * de pantalla y se elige tocando la tarjeta. Mismo control al crear y al
 * editar un grupo.
 */
export default function SelectorModalidad({ name, value, onChange, disabled = false }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="block text-xs font-medium text-foreground mb-1">Modalidad *</legend>
      <div className="grid grid-cols-2 gap-2">
        {OPCIONES.map((opcion) => {
          const activa = value === opcion.valor
          return (
            <label
              key={opcion.valor}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors ${activa ? 'border-primary bg-primary/10 text-primary-ink' : 'border-border text-foreground hover:bg-muted/40'} ${disabled ? 'cursor-default opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={opcion.valor}
                checked={activa}
                onChange={() => onChange(opcion.valor)}
                className="sr-only"
              />
              <span className="block font-medium">{ETIQUETA_MODALIDAD[opcion.valor]}</span>
              <span className="block text-xs text-muted-foreground">{opcion.descripcion} · ej. {opcion.ejemplo}</span>
            </label>
          )
        })}
      </div>
      {value === 'MIXTO' && (
        <p className="text-xs text-muted-foreground mt-1">
          Los grupos mixtos (sábados) llevan su propio calendario de inicio y fin de semestre.
        </p>
      )}
    </fieldset>
  )
}
