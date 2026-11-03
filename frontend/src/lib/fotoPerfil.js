import api from '@/api/axios'

/** Formatos que acepta el servidor; nada de SVG, GIF ni HEIC. */
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
/** Lo que se acepta del teléfono antes de achicarla. */
export const MAX_FOTO_ORIGINAL = 15 * 1024 * 1024
/** Lo que acepta el servidor. */
const MAX_FOTO_SUBIDA = 5 * 1024 * 1024
const LADO_CORTO = 1024
const LADO_LARGO = 2048

/**
 * Revisa la foto y la achica en el navegador antes de subirla: así una foto
 * de 12 MB del teléfono viaja en unos cientos de KB. Volver a dibujarla en un
 * canvas también descarta la ubicación y demás metadatos. El servidor vuelve
 * a validar y re-codificar todo; esto sólo ahorra datos y da errores claros.
 */
export async function prepararFotoPerfil(archivo) {
  if (!archivo) throw new Error('Elige una foto.')
  if (!TIPOS_FOTO.includes(archivo.type)) throw new Error('Elige una imagen JPG, PNG o WebP.')
  if (archivo.size > MAX_FOTO_ORIGINAL) throw new Error('La foto pesa más de 15 MB. Elige otra más ligera.')

  let imagen
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No pudimos abrir esa imagen. Puede estar dañada o no ser una foto.')
  }
  try {
    if (Math.min(imagen.width, imagen.height) < 64) throw new Error('La foto es muy pequeña: usa una de al menos 64×64 píxeles.')
    const escala = Math.min(1, LADO_CORTO / Math.min(imagen.width, imagen.height), LADO_LARGO / Math.max(imagen.width, imagen.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(imagen.width * escala)
    canvas.height = Math.round(imagen.height * escala)
    const ctx = canvas.getContext('2d')
    // JPEG no tiene transparencia: el fondo blanco evita que salga negro.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) throw new Error('No pudimos preparar la foto. Intenta con otra.')
    if (blob.size > MAX_FOTO_SUBIDA) throw new Error('La foto sigue pesando más de 5 MB. Elige otra.')
    return new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' })
  } finally {
    imagen.close?.()
  }
}

export function mensajeErrorFoto(err) {
  const estado = err.response?.status
  if (estado === 413) return 'La foto pesa más de 5 MB. Elige otra más ligera.'
  if (estado === 429) return 'Cambiaste tu foto varias veces seguidas. Espera unos minutos e inténtalo de nuevo.'
  const mensaje = err.response?.data?.message ?? err.message
  return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje || 'No se pudo guardar tu foto.'
}

/** URL de la foto vigente; `avatar` es su huella, así la caché nunca sirve una vieja. */
export function fotoPerfilUrl(usuario) {
  if (!usuario?.id || !usuario.avatar) return null
  return `${api.defaults.baseURL}/usuarios/${usuario.id}/foto?v=${encodeURIComponent(usuario.avatar)}`
}
