import { EstadoAsistencia } from '@prisma/client';

/**
 * Criterio único de alumno en riesgo, el mismo para el panel del docente y la
 * jefatura de carrera: al menos 3 registros de asistencia en el periodo y 30 %
 * o más entre faltas y retardos.
 */
export const MIN_REGISTROS_RIESGO = 3;
export const UMBRAL_RIESGO = 0.3;

export function esAusencia(estado: EstadoAsistencia) {
  return (
    estado === EstadoAsistencia.FALTA || estado === EstadoAsistencia.RETARDO
  );
}

export function estaEnRiesgo(total: number, ausencias: number) {
  return total >= MIN_REGISTROS_RIESGO && ausencias / total >= UMBRAL_RIESGO;
}
