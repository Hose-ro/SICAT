/** Guarda un Blob como archivo en el dispositivo. */
export function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = nombre
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Safari y Firefox leen el URL después del clic; revocarlo al instante cancela la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Con responseType 'blob' el cuerpo del error también llega como Blob. */
export async function mensajeDeBlob(data) {
  if (!(data instanceof Blob)) return data?.message ?? null
  try {
    return JSON.parse(await data.text())?.message ?? null
  } catch {
    return null
  }
}
