// Lectura y escritura de la guía en este navegador; sin almacenamiento
// (modo privado, bloqueado) la guía sigue funcionando, sólo no se recuerda.
export function leer(clave) {
  try { return localStorage.getItem(clave) } catch { return null }
}

export function guardar(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch { /* sin almacenamiento */ }
}
