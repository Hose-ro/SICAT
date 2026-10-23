import { useState } from 'react'
import GuiaPasos from '@/components/onboarding/GuiaPasos'
import { guardar, leer } from '@/components/onboarding/almacen'
import { pasosDelDocente } from '../primerosPasos'

const TEXTOS = {
  principal: 'Empieza por aquí',
  pendiente: 'Termina de preparar tu curso',
  listo: 'Tu curso está listo',
  subtituloListo: 'Ya puedes pasar lista, dejar tareas y capturar calificaciones.',
}
const ATAJOS = [
  { to: '/asistencias', label: 'Pasar lista' },
  { to: '/docente/tareas/crear', label: 'Nueva tarea' },
  { to: '/calificaciones', label: 'Calificaciones' },
]

export default function PrimerosPasos({ configuracion, materias = [], userId, onComoFunciona, principal = false }) {
  const claveRevisado = `sicat.docente.revision.${userId}`
  const [revisadoAqui, setRevisadoAqui] = useState(() => leer(claveRevisado) === 'hecho')
  // Quien ya pasó lista en alguna clase ya conoce a sus alumnos.
  const revisado = revisadoAqui || materias.some((materia) => materia.porcentajeAsistencia !== null)
  const marcarRevisado = () => { setRevisadoAqui(true); guardar(claveRevisado, 'hecho') }
  const pasos = pasosDelDocente({ configuracion, materias, revisado })
    .map((paso) => ({ ...paso, alAbrir: paso.alAbrir ? marcarRevisado : undefined }))

  return (
    <GuiaPasos
      pasos={pasos}
      claveGuia={`sicat.docente.guia.${userId}`}
      textos={TEXTOS}
      atajos={ATAJOS}
      onComoFunciona={onComoFunciona}
      principal={principal}
    />
  )
}
