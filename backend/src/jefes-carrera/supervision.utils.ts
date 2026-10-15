import { BadRequestException } from '@nestjs/common';
import {
  convertirHoraAMinutos,
  formatearFechaClave,
  normalizarTexto,
  parsearFechaClave,
} from '../clases/clases.utils';
import { getCurrentAcademicPeriod } from '../common/periodo.util';

export function periodoSupervision(value?: string) {
  const periodo = value?.trim().toUpperCase() || getCurrentAcademicPeriod();
  if (!/^\d{4}-[AB]$/.test(periodo))
    throw new BadRequestException('Periodo inválido; usa AAAA-A o AAAA-B');
  return periodo;
}

export function rangoPeriodo(periodo: string) {
  const year = Number(periodo.slice(0, 4));
  const first = periodo.endsWith('A');
  return {
    inicio: new Date(year, first ? 0 : 6, 1),
    fin: new Date(year, first ? 6 : 12, 0, 23, 59, 59, 999),
  };
}

export function fechaSupervision(value: string) {
  const fecha = parsearFechaClave(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !fecha ||
    formatearFechaClave(fecha) !== value
  ) {
    throw new BadRequestException('Fecha inválida');
  }
  return fecha;
}

export function diasHorario(dias: string) {
  return [...new Set(dias.split(',').map(normalizarTexto).filter(Boolean))];
}

export function horasSemanal(horario: {
  dias: string;
  horaInicio: string;
  horaFin: string;
}) {
  return (
    (Math.max(
      0,
      convertirHoraAMinutos(horario.horaFin) -
        convertirHoraAMinutos(horario.horaInicio),
    ) /
      60) *
    diasHorario(horario.dias).length
  );
}

export function coincidenHorarios(
  a: { dias: string; horaInicio: string; horaFin: string },
  b: { dias: string; horaInicio: string; horaFin: string },
) {
  return (
    diasHorario(a.dias).some((d) => diasHorario(b.dias).includes(d)) &&
    convertirHoraAMinutos(a.horaInicio) < convertirHoraAMinutos(b.horaFin) &&
    convertirHoraAMinutos(b.horaInicio) < convertirHoraAMinutos(a.horaFin)
  );
}

export function estadoCaptura({
  suspendida,
  futura,
  alumnos,
  registros,
  activa,
  tardia,
}: {
  suspendida: boolean;
  futura: boolean;
  alumnos: number;
  registros: number;
  activa: boolean;
  tardia: boolean;
}) {
  if (suspendida) return 'SUSPENDIDA';
  if (futura) return 'PROGRAMADA';
  if (!alumnos) return 'SIN_ALUMNOS';
  if (registros >= alumnos)
    return tardia ? 'REGISTRO_TARDIO' : 'LISTA_COMPLETA';
  if (activa) return 'REGISTRO_EN_CURSO';
  return registros ? 'CAPTURA_PARCIAL' : 'SIN_CAPTURA';
}

/** Tipos de seguimiento que la jefatura puede registrar desde la supervisión. */
export const TIPOS_SEGUIMIENTO = [
  'ASISTENCIA_SIN_CAPTURA',
  'ALUMNO_RIESGO',
  'CALIFICACIONES_PENDIENTES',
  'SEGUIMIENTO_DOCENTE',
] as const;
export type TipoSeguimiento = (typeof TIPOS_SEGUIMIENTO)[number];

/** Lo que identifica al caso: una clase en una fecha, un alumno, una materia en un grupo o un docente. */
export type ReferenciaSeguimiento =
  | { tipo: 'ASISTENCIA_SIN_CAPTURA'; horarioId: number; fecha: string }
  | { tipo: 'ALUMNO_RIESGO'; alumnoId: number }
  | { tipo: 'CALIFICACIONES_PENDIENTES'; materiaId: number; grupoId: number }
  | { tipo: 'SEGUIMIENTO_DOCENTE'; docenteId: number };

/**
 * Huella estable de un caso dentro de una carrera y un periodo: el mismo caso
 * siempre cae en el mismo seguimiento, sin importar desde qué vista se registre.
 */
export function huellaSeguimiento(
  carreraId: number,
  periodo: string,
  ref: ReferenciaSeguimiento,
) {
  const partes =
    ref.tipo === 'ASISTENCIA_SIN_CAPTURA'
      ? [ref.horarioId, ref.fecha]
      : ref.tipo === 'ALUMNO_RIESGO'
        ? [ref.alumnoId]
        : ref.tipo === 'CALIFICACIONES_PENDIENTES'
          ? [ref.materiaId, ref.grupoId]
          : [ref.docenteId];
  return ['SEG', ref.tipo, carreraId, periodo, ...partes].join(':');
}

/** Recupera la referencia de una huella creada por huellaSeguimiento; null si es una alerta anterior. */
export function leerHuella(huella: string): ReferenciaSeguimiento | null {
  const [marca, tipo, , , a, b] = huella.split(':');
  if (marca !== 'SEG') return null;
  const n = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
  if (tipo === 'ASISTENCIA_SIN_CAPTURA' && n(a) && b)
    return { tipo, horarioId: n(a)!, fecha: b };
  if (tipo === 'ALUMNO_RIESGO' && n(a)) return { tipo, alumnoId: n(a)! };
  if (tipo === 'CALIFICACIONES_PENDIENTES' && n(a) && n(b))
    return { tipo, materiaId: n(a)!, grupoId: n(b)! };
  if (tipo === 'SEGUIMIENTO_DOCENTE' && n(a)) return { tipo, docenteId: n(a)! };
  return null;
}
