import { estaEnRiesgo } from './riesgo.util';

/** Mínima aprobatoria de una unidad. */
export const CALIFICACION_APROBATORIA = 70;
/** Desde aquí la calificación ya no se considera en riesgo. */
export const CALIFICACION_SIN_RIESGO = 80;
/** Tareas vencidas mínimas para juzgar las entregas de una unidad. */
export const MIN_TAREAS_RIESGO = 2;
/** Desde esta fracción de tareas vencidas sin entregar hay riesgo. */
export const UMBRAL_ENTREGAS = 0.3;

export type EstadoDesempeno =
  | 'APROBADO'
  | 'EN_RIESGO'
  | 'REPROBADO'
  | 'SIN_CALIFICAR';

export type MotivoDesempeno =
  | 'CALIFICACION_BAJA'
  | 'CALIFICACION_LIMITE'
  | 'ASISTENCIA'
  | 'ENTREGAS';

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
 * Semáforo de un alumno en una unidad. Mientras la unidad sigue abierta:
 * rojo por debajo de 70; amarillo de 70 a 79 o con 30 % o más de faltas y
 * retardos (el mismo criterio de "alumnos en riesgo"), o con 30 % o más de
 * las tareas vencidas sin entregar (al menos 2 vencidas); verde de 80 en
 * adelante. Una unidad finalizada sólo queda aprobada o reprobada.
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
  if (unidadFinalizada) {
    if (calificacion == null) return { estado: 'SIN_CALIFICAR', motivos: [] };
    return calificacion >= CALIFICACION_APROBATORIA
      ? { estado: 'APROBADO', motivos: [] }
      : { estado: 'REPROBADO', motivos: ['CALIFICACION_BAJA'] };
  }

  const faltas = estaEnRiesgo(
    asistencia.registradas,
    asistencia.faltas + asistencia.retardos,
  );
  const sinEntregar = faltanEntregas(entregas);
  const motivos: MotivoDesempeno[] = [];
  if (calificacion != null && calificacion < CALIFICACION_APROBATORIA) {
    motivos.push('CALIFICACION_BAJA');
    if (faltas) motivos.push('ASISTENCIA');
    if (sinEntregar) motivos.push('ENTREGAS');
    return { estado: 'REPROBADO', motivos };
  }
  if (calificacion != null && calificacion < CALIFICACION_SIN_RIESGO) {
    motivos.push('CALIFICACION_LIMITE');
  }
  if (faltas) motivos.push('ASISTENCIA');
  if (sinEntregar) motivos.push('ENTREGAS');
  if (motivos.length) return { estado: 'EN_RIESGO', motivos };
  if (calificacion == null) return { estado: 'SIN_CALIFICAR', motivos };
  return { estado: 'APROBADO', motivos };
}
