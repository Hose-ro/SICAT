import { useState } from 'react'
import GuiaPasos from '@/components/onboarding/GuiaPasos'
import { guardar, leer } from '@/components/onboarding/almacen'
import { pasosDeJefatura } from '../primerosPasosJefatura'

const TEXTOS = {
  principal: 'Empieza por aquí',
  pendiente: 'Termina de preparar tu carrera',
  listo: 'Tu carrera está lista',
  subtituloListo: 'Desde aquí revisas lo que requiere atención, la evidencia de cada clase y registras tus observaciones.',
}

function leerRevision(clave) {
  try { return JSON.parse(leer(clave) ?? '{}') ?? {} } catch { return {} }
}

/** Primeros pasos del jefe de carrera, por usuario y por carrera. */
export default function PrimerosPasosJefatura({ j, resumen, reuniones, userId, onComoFunciona, principal = false }) {
  const base = `${userId}.${j.carreraId}`
  const claveRevision = `sicat.jefatura.revision.${base}`
  const [revision, setRevision] = useState(() => leerRevision(claveRevision))
  const marcar = (clave) => () => {
    const nueva = { ...revision, [clave]: true }
    setRevision(nueva)
    guardar(claveRevision, JSON.stringify(nueva))
  }
  // Revisar la oferta y conocer a los docentes no dejan rastro en los datos:
  // cuentan como hechos al abrirlos.
  const pasos = pasosDeJefatura({ resumen, reuniones, revision, j })
    .map((paso) => ({ ...paso, alAbrir: paso.clave === 'oferta' || paso.clave === 'docentes' ? marcar(paso.clave) : undefined }))
  const atajos = [
    { to: j.to('/jefe-carrera/horarios'), label: 'Ver horarios' },
    { to: j.to('/jefe-carrera/seguimientos'), label: 'Observaciones' },
    { to: j.to('/jefe-carrera/reportes'), label: 'Informe del periodo' },
  ]

  return (
    <GuiaPasos
      key={base}
      pasos={pasos}
      claveGuia={`sicat.jefatura.guia.${base}`}
      textos={TEXTOS}
      atajos={atajos}
      onComoFunciona={onComoFunciona}
      principal={principal}
    />
  )
}
