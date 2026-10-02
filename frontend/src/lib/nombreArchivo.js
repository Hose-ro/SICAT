/** Quita los caracteres que Windows/macOS no aceptan en un nombre de archivo. */
export function sanitizarNombreArchivo(nombre, respaldo = 'archivo') {
  return String(nombre ?? '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || respaldo
}
