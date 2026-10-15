import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { notify } from '@/lib/feedback'
import { useAsistenciaStore } from '@/store/asistenciaStore'
import { useClaseStore } from '@/store/claseStore'
import AsistenciaSesionPanel from './components/AsistenciaSesionPanel'
import { BitacoraDialog, BitacoraResumen } from './components/BitacoraClase'

export default function PasarLista() {
  const { sesionId } = useParams()
  const navigate = useNavigate()
  const finalizar = useClaseStore((state) => state.finalizar)
  const exportar = useAsistenciaStore((state) => state.exportar)
  // La sesión que se va a finalizar: primero se registra qué se vio.
  const [porFinalizar, setPorFinalizar] = useState(null)

  // Si se entró directo por enlace no hay a dónde regresar dentro de la app.
  const regresar = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/dashboard'))

  const finalizarClase = async () => {
    const sesion = porFinalizar
    try {
      await finalizar(sesion.id)
    } catch (error) {
      notify(error.response?.data?.message || 'No se pudo finalizar la clase. Inténtalo de nuevo.')
      return
    }
    setPorFinalizar(null)
    notify(`Finalizaste ${sesion.materia?.nombre ?? 'la clase'}.`, 'success', {
      duration: 10000,
      action: {
        label: 'Descargar reporte',
        onClick: () => exportar(sesion.materia.id, { formato: 'pdf', sesionId: sesion.id })
          .catch(() => notify('No se pudo descargar el reporte de la clase.')),
      },
    })
    regresar()
  }

  // <main> ya pone el margen lateral: aquí no se suma otro.
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">Pasar lista</h1>
      <AsistenciaSesionPanel
        sesionId={Number(sesionId)}
        onClose={regresar}
        onFinalizar={setPorFinalizar}
      />
      <BitacoraResumen key={sesionId} sesionId={Number(sesionId)} />
      <BitacoraDialog sesionId={Number(sesionId)} open={Boolean(porFinalizar)} modo="finalizar"
        onClose={() => setPorFinalizar(null)} onListo={finalizarClase} />
    </div>
  )
}
