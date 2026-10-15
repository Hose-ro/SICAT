/*
 * Avance programático: qué temas del temario se han visto en las clases de un
 * grupo, contra la semana del curso en que se planearon.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export type EstadoTema = 'VISTO' | 'ATRASADO' | 'PENDIENTE';

/**
 * Semana del curso (1, 2, 3…) de una fecha dentro del periodo. Antes del
 * inicio es 0; después del fin, la última. En Mixto también sirve: hay un
 * sábado por semana.
 */
export function semanaDelCurso(inicio: Date, fin: Date, hoy: Date) {
  const total = semanasDelCurso(inicio, fin);
  if (hoy < inicio) return 0;
  const semana =
    Math.floor((hoy.getTime() - inicio.getTime()) / (7 * DIA_MS)) + 1;
  return Math.min(semana, total);
}

export function semanasDelCurso(inicio: Date, fin: Date) {
  return Math.max(
    1,
    Math.ceil((fin.getTime() - inicio.getTime() + DIA_MS) / (7 * DIA_MS)),
  );
}

/** Un tema planeado para una semana que ya pasó y sin ver está atrasado. */
export function estadoTema(
  tema: { semana: number | null },
  vistoEn: Date | null,
  semanaActual: number,
): EstadoTema {
  if (vistoEn) return 'VISTO';
  if (tema.semana != null && tema.semana < semanaActual) return 'ATRASADO';
  return 'PENDIENTE';
}

/** Totales del avance: vistos, planeados hasta esta semana y atrasados. */
export function resumirAvance(
  temas: Array<{ semana: number | null; estado: EstadoTema }>,
  semanaActual: number,
) {
  const vistos = temas.filter((tema) => tema.estado === 'VISTO').length;
  return {
    total: temas.length,
    vistos,
    porcentaje: temas.length ? Math.round((vistos / temas.length) * 100) : 0,
    planeadosALaFecha: temas.filter(
      (tema) => tema.semana != null && tema.semana <= semanaActual,
    ).length,
    atrasados: temas.filter((tema) => tema.estado === 'ATRASADO').length,
  };
}
