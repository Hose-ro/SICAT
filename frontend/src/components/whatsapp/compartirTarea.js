import api from '@/api/axios'
import { generarDocumentoTarea } from '@/lib/documentoTarea'
import { notify } from '@/lib/feedback'
import { taskError } from '@/lib/tareas'
import { mensajeRecordatorio, mensajeTareaNueva } from '@/lib/whatsapp'
import { useAuthStore } from '@/store/authStore'
import { abrirCompartirWhatsapp } from '@/store/compartirWhatsappStore'

/**
 * Abre el diálogo de WhatsApp para una tarea. Pide el detalle completo
 * (materia, grupo, unidad, archivos) porque las listas no siempre lo traen.
 */
export async function compartirTareaPorWhatsapp(tareaOId, { recordatorio = false } = {}) {
  let tarea = tareaOId
  if (typeof tareaOId !== 'object' || !tareaOId.materia || !('archivos' in tareaOId)) {
    try {
      tarea = (await api.get(`/tareas/${typeof tareaOId === 'object' ? tareaOId.id : tareaOId}`)).data
    } catch (error) {
      notify(taskError(error, 'No se pudo cargar la tarea para compartirla.'))
      return
    }
  }
  const docente = useAuthStore.getState().user?.nombre
  abrirCompartirWhatsapp({
    titulo: recordatorio ? 'Recordatorio por WhatsApp' : 'Compartir tarea por WhatsApp',
    materiaId: tarea.materiaId,
    grupoId: tarea.grupoId,
    texto: (conDocumento) => recordatorio
      ? mensajeRecordatorio(tarea, new Date(), { conDocumento })
      : mensajeTareaNueva(tarea, { conDocumento }),
    generarArchivo: (formato) => generarDocumentoTarea(tarea, formato, { docente }),
    adjuntarPorDefecto: !recordatorio,
  })
}
