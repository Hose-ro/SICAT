import { CALIFICACION_APROBATORIA } from './desempeno.util';

/*
 * Reglas de acreditación del cierre de curso, según el lineamiento de
 * evaluación del TecNM:
 *  - una unidad (competencia) se alcanza con 70 o más en la primera
 *    oportunidad; si no, tiene una evaluación de segunda oportunidad;
 *  - el curso se acredita sólo con todas las unidades alcanzadas, y la
 *    calificación final es el promedio de las unidades (entero);
 *  - con alguna unidad no alcanzada el curso queda NA (no acreditado);
 *  - el nivel de desempeño sale de la calificación final.
 */

export type EstadoUnidadCierre =
  | 'ALCANZADA'
  | 'ALCANZADA_SEGUNDA'
  | 'PENDIENTE_SEGUNDA'
  | 'NO_ALCANZADA'
  | 'SIN_CALIFICAR';

export type EstadoCurso = 'ACREDITADO' | 'NO_ACREDITADO' | 'PENDIENTE';

export type NivelDesempeno =
  | 'EXCELENTE'
  | 'NOTABLE'
  | 'BUENO'
  | 'SUFICIENTE'
  | 'INSUFICIENTE';

const NIVELES: Array<{ minimo: number; nivel: NivelDesempeno }> = [
  { minimo: 95, nivel: 'EXCELENTE' },
  { minimo: 85, nivel: 'NOTABLE' },
  { minimo: 75, nivel: 'BUENO' },
  { minimo: CALIFICACION_APROBATORIA, nivel: 'SUFICIENTE' },
];

export type UnidadCierre = {
  estado: EstadoUnidadCierre;
  /** La que cuenta para el curso: la de segunda oportunidad si hubo. */
  calificacion: number | null;
  oportunidad: 1 | 2 | null;
};

export function estadoUnidad({
  primera,
  segunda,
  noPresento,
}: {
  primera: number | null;
  segunda: number | null;
  noPresento: boolean;
}): UnidadCierre {
  if (primera == null) {
    return { estado: 'SIN_CALIFICAR', calificacion: null, oportunidad: null };
  }
  if (primera >= CALIFICACION_APROBATORIA) {
    return { estado: 'ALCANZADA', calificacion: primera, oportunidad: 1 };
  }
  if (segunda != null) {
    return {
      estado:
        segunda >= CALIFICACION_APROBATORIA
          ? 'ALCANZADA_SEGUNDA'
          : 'NO_ALCANZADA',
      calificacion: segunda,
      oportunidad: 2,
    };
  }
  if (noPresento) {
    return { estado: 'NO_ALCANZADA', calificacion: null, oportunidad: 2 };
  }
  return { estado: 'PENDIENTE_SEGUNDA', calificacion: primera, oportunidad: 1 };
}

export function nivelDesempeno(final: number | null): NivelDesempeno {
  if (final == null) return 'INSUFICIENTE';
  return NIVELES.find((item) => final >= item.minimo)?.nivel ?? 'INSUFICIENTE';
}

export function resultadoCurso(unidades: UnidadCierre[]): {
  estado: EstadoCurso;
  final: number | null;
  nivel: NivelDesempeno | null;
} {
  if (
    !unidades.length ||
    unidades.some(
      (unidad) =>
        unidad.estado === 'SIN_CALIFICAR' ||
        unidad.estado === 'PENDIENTE_SEGUNDA',
    )
  ) {
    return { estado: 'PENDIENTE', final: null, nivel: null };
  }
  if (unidades.some((unidad) => unidad.estado === 'NO_ALCANZADA')) {
    return {
      estado: 'NO_ACREDITADO',
      final: null,
      nivel: 'INSUFICIENTE',
    };
  }
  const suma = unidades.reduce(
    (total, unidad) => total + (unidad.calificacion ?? 0),
    0,
  );
  const final = Math.round(suma / unidades.length);
  return { estado: 'ACREDITADO', final, nivel: nivelDesempeno(final) };
}
