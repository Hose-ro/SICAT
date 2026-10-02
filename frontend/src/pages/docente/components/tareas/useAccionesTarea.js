import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, FileDown, FileSpreadsheet, FolderDown, Lock, LockOpen, PenLine, Send } from 'lucide-react'
import { notify } from '@/lib/feedback'
import { taskError } from '@/lib/tareas'
import { useTareaStore } from '@/store/tareaStore'

/**
 * Acciones secundarias de una tarea para el menú «⋯». `onCambio` recibe la
 * tarea que devuelve el API después de publicar, cerrar o reabrir.
 * Solo cerrar y reabrir ofrecen deshacer: son lo único con operación inversa.
 */
export default function useAccionesTarea({ onCambio } = {}) {
  const navigate = useNavigate()

  return useCallback((tarea, extra = []) => {
    const store = useTareaStore.getState()

    const ejecutar = async (accion, exito, deshacer) => {
      try {
        const actualizada = await accion()
        onCambio?.(actualizada)
        notify(exito, 'success', deshacer ? { action: deshacer } : undefined)
      } catch (error) {
        notify(taskError(error))
      }
    }

    const descargar = (accion, exito) => async () => {
      try {
        await accion()
        notify(exito, 'success')
      } catch (error) {
        notify(taskError(error, 'No se pudo descargar el archivo. Intenta de nuevo.'))
      }
    }

    const cerrar = () => ejecutar(() => store.cerrar(tarea.id), 'La tarea ya no recibe entregas.',
      { label: 'Deshacer', onClick: () => ejecutar(() => store.reabrir(tarea.id), 'La tarea vuelve a recibir entregas.') })
    const reabrir = () => ejecutar(() => store.reabrir(tarea.id), 'La tarea vuelve a recibir entregas.',
      { label: 'Deshacer', onClick: () => ejecutar(() => store.cerrar(tarea.id), 'La tarea ya no recibe entregas.') })

    const duplicar = async () => {
      try {
        const copia = await store.duplicar(tarea.id)
        onCambio?.(copia)
        notify(`Creaste «${copia.titulo}» como borrador.`, 'success', {
          action: { label: 'Editar', onClick: () => navigate(`/docente/tareas/crear?editarId=${copia.id}`) },
        })
      } catch (error) {
        notify(taskError(error))
      }
    }

    const publicada = tarea.estado !== 'BORRADOR'
    return [
      ...extra,
      { label: 'Editar tarea', icon: PenLine, onSelect: () => navigate(`/docente/tareas/crear?editarId=${tarea.id}`) },
      { label: 'Duplicar', icon: Copy, onSelect: duplicar },
      tarea.estado === 'BORRADOR' && {
        label: 'Publicar', icon: Send,
        onSelect: () => ejecutar(() => store.publicar(tarea.id), `Publicaste «${tarea.titulo}». El grupo ya puede verla.`),
      },
      (tarea.estado === 'PUBLICADA' || tarea.estado === 'VENCIDA') && { label: 'Cerrar tarea', icon: Lock, onSelect: cerrar },
      tarea.estado === 'CERRADA' && { label: 'Reabrir', icon: LockOpen, onSelect: reabrir },
      { separator: true },
      publicada && tarea.tipoEntrega !== 'PRESENCIAL' && {
        label: 'Descargar evidencias (.zip)', icon: FolderDown,
        onSelect: descargar(() => store.descargarEntregas(tarea.id, []), 'Se descargaron las evidencias.'),
      },
      publicada && { label: 'Exportar a Excel', icon: FileSpreadsheet, onSelect: descargar(() => store.exportarTarea(tarea.id, 'excel'), 'Se descargó el Excel de la tarea.') },
      publicada && { label: 'Exportar a PDF', icon: FileDown, onSelect: descargar(() => store.exportarTarea(tarea.id, 'pdf'), 'Se descargó el PDF de la tarea.') },
    ]
  }, [navigate, onCambio])
}
