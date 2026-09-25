/**
 * Letra con la que los reportes imprimen el sexo del alumno, igual que la
 * insignia de las listas en pantalla. Vacío si todavía no se registró.
 */
export function letraSexo(sexo?: string | null): string {
  if (sexo === 'HOMBRE') return 'H';
  if (sexo === 'MUJER') return 'M';
  return '';
}
