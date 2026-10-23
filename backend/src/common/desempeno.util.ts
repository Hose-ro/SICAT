import { estaEnRiesgo } from './riesgo.util';

/** Mínima aprobatoria de una unidad. */
export const CALIFICACION_APROBATORIA = 70;
/** Tareas vencidas mínimas para juzgar las entregas de una unidad. */
export const MIN_TAREAS_RIESGO = 2;
/** Desde esta fracción de tareas vencidas sin entregar hay riesgo. */
export const UMBRAL_ENTREGAS = 0.3;

export type EstadoDesempeno = 'APROBADO' | 'REPROBADO' | 'SIN_CALIFICAR';

export type MotivoDesempeno = 'CALIFICACION_BAJA' | 'ASISTENCIA' | 'ENTREGAS';

/** Tareas ya vencidas de la unidad y cuántas de ellas no se entregaron. */
export function faltanEntregas(entregas?: {
  vencidas: number;
  sinEntregar: number;
}) {
  return Boolean(
    entregas &&
    entregas.vencidas >= MIN_TAREAS_RIESGO &&
    entregas.sinEntregar / entregas.vencidas >= UMBRAL_ENTREGAS,
  );
}

/**
 * Semáforo de la calificación de un alumno en una unidad: aprobado desde 70,
 * reprobado por debajo y sin calificar mientras no hay calificación. No hay
 * estado intermedio. Las faltas (30 % o más) y las tareas vencidas sin
 * entregar (30 % o más, con al menos 2 vencidas) no cambian el estado: van
 * como motivos para "Alumnos en riesgo" mientras la unidad sigue abierta.
 */
export function evaluarDesempeno({
  calificacion,
  unidadFinalizada,
  asistencia,
  entregas,
}: {
  calificacion: number | null;
  unidadFinalizada: boolean;
  asistencia: { registradas: number; faltas: number; retardos: number };
  entregas?: { vencidas: number; sinEntregar: number };
}): { estado: EstadoDesempeno; motivos: MotivoDesempeno[] } {
  const reprobado =
    calificacion != null && calificacion < CALIFICACION_APROBATORIA;
  const motivos: MotivoDesempeno[] = reprobado ? ['CALIFICACION_BAJA'] : [];
  if (!unidadFinalizada) {
    if (
      estaEnRiesgo(
        asistencia.registradas,
        asistencia.faltas + asistencia.retardos,
      )
    )
      motivos.push('ASISTENCIA');
    if (faltanEntregas(entregas)) motivos.push('ENTREGAS');
  }
  const estado: EstadoDesempeno =
    calificacion == null
      ? 'SIN_CALIFICAR'
      : reprobado
        ? 'REPROBADO'
        : 'APROBADO';
  return { estado, motivos };
}

/**
 * Riesgo de una clase a partir de sus filas (alumno × unidad): alumnos con
 * datos, cuántos tienen alguna unidad con motivos y cuántos de cada motivo.
 * Un alumno puede tener varios motivos; las cifras por motivo no se suman.
 */
export function resumirRiesgoFilas(
  rows: Array<{ alumno: { id: number }; motivos: string[] }>,
) {
  const motivosPorAlumno = new Map<number, Set<string>>();
  for (const row of rows) {
    const motivos = motivosPorAlumno.get(row.alumno.id) ?? new Set<string>();
    row.motivos.forEach((motivo) => motivos.add(motivo));
    motivosPorAlumno.set(row.alumno.id, motivos);
  }
  const conMotivos = [...motivosPorAlumno.values()].filter((m) => m.size);
  const con = (...buscados: string[]) =>
    conMotivos.filter((m) => buscados.some((motivo) => m.has(motivo))).length;
  return {
    evaluados: motivosPorAlumno.size,
    enRiesgo: conMotivos.length,
    reprobando: con('CALIFICACION_BAJA'),
    motivos: {
      calificacion: con('CALIFICACION_BAJA'),
      asistencia: con('ASISTENCIA'),
      entregas: con('ENTREGAS'),
    },
  };
}
