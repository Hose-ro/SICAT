import api from '@/api/axios'
import { descargarArchivo, mensajeDeBlob } from '@/lib/descargas'

const pad = (n) => String(n).padStart(2, '0')
export const hoyClaveLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const aFecha = (clave) => { const [y, m, d] = clave.split('-').map(Number); return new Date(y, m - 1, d) }

/** "jueves 22 de octubre" */
export const fechaReunion = (clave) => aFecha(clave).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
export const diaMes = (clave) => {
  const f = aFecha(clave)
  return { dia: f.getDate(), mes: f.toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''), semana: f.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '') }
}
export const horarioReunion = (r) => (r.horaFin ? `${r.horaInicio}–${r.horaFin}` : `${r.horaInicio}`)
export const lugarReunion = (r) => (r.modalidad === 'VIRTUAL' ? 'En línea' : r.lugar || 'Lugar por confirmar')

export const ESTADO_REUNION = {
  PROGRAMADA: { label: 'Programada', clase: 'bg-muted text-foreground' },
  FINALIZADA: { label: 'Finalizada', clase: 'bg-success/10 text-success-foreground' },
  CANCELADA: { label: 'Cancelada', clase: 'bg-destructive/10 text-destructive-foreground' },
}
export const TIPO_REUNION = { ORDINARIA: 'Ordinaria', EXTRAORDINARIA: 'Extraordinaria' }

/** Próximas: programadas de hoy en adelante. El resto es historial. */
export function separarReuniones(reuniones) {
  const hoy = hoyClaveLocal()
  const proximas = reuniones
    .filter((r) => r.estado === 'PROGRAMADA' && r.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
  const pasadas = reuniones.filter((r) => !proximas.includes(r))
  return { proximas, pasadas }
}

/** Baja el .ics de la reunión; devuelve un mensaje de error o null. */
export async function descargarIcs(reunion) {
  try {
    const respuesta = await api.get(`/reuniones/${reunion.id}/ics`, { responseType: 'blob' })
    descargarArchivo(respuesta.data, `reunion-${reunion.fecha}.ics`)
    return null
  } catch (error) {
    return (await mensajeDeBlob(error.response?.data)) ?? 'No se pudo descargar el evento.'
  }
}
