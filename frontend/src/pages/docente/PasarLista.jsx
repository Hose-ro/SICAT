import { useNavigate, useParams } from 'react-router-dom'
import AsistenciaSesionPanel from './components/AsistenciaSesionPanel'

export default function PasarLista() {
  const { sesionId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <AsistenciaSesionPanel
        sesionId={Number(sesionId)}
        onClose={() => navigate(-1)}
        onSaved={() => {}}
      />
    </div>
  )
}
