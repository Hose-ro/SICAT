const ETIQUETA = { HOMBRE: 'H', MUJER: 'M' }

/** Insignia compacta de sexo para listas de alumnos; no imprime nada si falta el dato. */
export default function SexoBadge({ sexo }) {
  const etiqueta = ETIQUETA[sexo]
  if (!etiqueta) return null

  return (
    <span
      title={sexo === 'HOMBRE' ? 'Hombre' : 'Mujer'}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground"
    >
      {etiqueta}
    </span>
  )
}
