/**
 * Toda materia nace con sus unidades de evaluación. Una materia sin unidades no
 * puede iniciar clase ni registrar calificaciones, así que los cuatro caminos
 * que crean materias usan esta misma lista.
 */
export function unidadesIniciales(numUnidades = 3) {
  const total = Math.max(1, Math.trunc(numUnidades));
  return Array.from({ length: total }, (_, indice) => ({
    nombre: `Unidad ${indice + 1}`,
    orden: indice + 1,
  }));
}
