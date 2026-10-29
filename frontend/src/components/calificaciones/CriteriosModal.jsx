import { useState } from 'react'
import Modal from '@/components/Modal'
import TaskNotice from '@/components/TaskNotice'
import { Skeleton } from '@/components/ui/skeleton'
import useCriterios from '@/hooks/useCriterios'
import { confirmAction } from '@/lib/feedback'
import CriteriosEvaluacion from './CriteriosEvaluacion'

/**
 * Editor de criterios en un diálogo, para abrirlo desde Calificaciones, Inicio
 * o Tareas. Carga los criterios del grupo al abrirse.
 */
export default function CriteriosModal({ open, onClose, materiaId, grupo, materiaNombre, alcanceInicial = 'base', plantillaInicial, onGuardado }) {
  const { datos, error, recargar, setDatos } = useCriterios(materiaId, grupo?.id, { activo: open })
  const [conCambios, setConCambios] = useState(false)

  const cerrar = async () => {
    if (conCambios && !(await confirmAction({
      title: 'Descartar cambios',
      description: 'Tienes cambios sin guardar en los criterios. ¿Los descartas?',
      confirmLabel: 'Descartar',
    }))) return
    setConCambios(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={cerrar} wide title="Criterios de evaluación"
      description={[materiaNombre, grupo?.nombre].filter(Boolean).join(' · ')}>
      {error ? (
        <TaskNotice error={error} onRetry={recargar} />
      ) : !datos ? (
        <div role="status" aria-label="Cargando criterios" className="space-y-3">
          <Skeleton className="h-9 w-2/3 rounded-[10px]" />
          <Skeleton className="h-40 rounded-[14px]" />
        </div>
      ) : (
        <CriteriosEvaluacion
          datos={datos}
          materiaId={materiaId}
          grupo={grupo}
          // Abre en la unidad sólo si tiene porcentajes propios; si no, en la
          // lista de todas, que es la que se edita casi siempre.
          alcanceInicial={datos.unidades.some((item) => item.unidad.id === alcanceInicial && item.personalizada) ? alcanceInicial : 'base'}
          plantillaInicial={plantillaInicial}
          onCambios={setConCambios}
          onGuardado={(nuevos) => {
            setDatos(nuevos)
            onGuardado?.(nuevos)
          }}
        />
      )}
    </Modal>
  )
}
