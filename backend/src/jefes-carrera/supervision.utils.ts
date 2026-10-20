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

/**
 * Traduce las etiquetas libres que admite Grupo.periodo a la clave que usa la
 * supervisión. El texto original se conserva en la base; esto sólo evita que
 * "Agosto-Diciembre 2026" y "2026-B" partan el mismo ciclo en dos.
 *
 * Cuando la institución omite el año se usa el año en que se creó el grupo,
 * que es una referencia más estable que la fecha en que se hace la consulta.
 */
export function periodoCanonicoDeGrupo(value: string, referencia = new Date()) {
  const directo = value.trim().toUpperCase();
  if (/^\d{4}-[AB]$/.test(directo)) return directo;

  const texto = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const anios = texto.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  // Un intervalo como "2026-2027" no identifica por sí solo un semestre.
  const anio = anios.length === 1 ? Number(anios[0]) : referencia.getFullYear();
  const tokens = new Set(texto.split(/\s+/).filter(Boolean));
  const primero = ['ene', 'enero', 'jun', 'junio'].some((t) => tokens.has(t));
  const segundo = ['jul', 'julio', 'ago', 'agosto', 'dic', 'diciembre'].some(
    (t) => tokens.has(t),
  );

  if (primero === segundo) return null;
  return `${anio}-${primero ? 'A' : 'B'}`;
}

/**
 * Grupos que cuentan en un periodo. En el actual, solo los activos; al
 * consultar un ciclo anterior también los dados de baja después, porque
 * siguen siendo parte de la historia de ese periodo.
 */
export function filtroGrupoVigente(periodo: string): { activo?: true } {
  return periodo === getCurrentAcademicPeriod() ? { activo: true } : {};
}

export function grupoPerteneceAPeriodo(
  grupo: { periodo: string; createdAt?: Date },
  periodo: string,
) {
  return periodoCanonicoDeGrupo(grupo.periodo, grupo.createdAt) === periodo;
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

type FotoCierreMinima = {
  docente?: string | null;
  alumnos?: Array<{
    alumno: { id: number };
    estado: 'ACREDITADO' | 'NO_ACREDITADO' | 'PENDIENTE';
    final: number | null;
  }>;
};

/**
 * Lo que la jefatura necesita del concentrado congelado al cerrar un curso:
 * quién y cuándo, cuántos acreditaron y el resultado de cada alumno. Con una
 * unidad no alcanzada el curso es NA aunque las demás tengan número.
 */
export function resumenCierre(
  cierre: { cerradoEn: Date; concentrado: unknown } | null | undefined,
) {
  if (!cierre) return null;
  const foto = (cierre.concentrado ?? {}) as FotoCierreMinima;
  const alumnos = (foto.alumnos ?? []).map((a) => ({
    id: a.alumno.id,
    estado: a.estado,
    final: a.final,
  }));
  const finales = alumnos
    .map((a) => a.final)
    .filter((f): f is number => typeof f === 'number');
  return {
    cerradoEn: cierre.cerradoEn.toISOString(),
    docente: foto.docente ?? null,
    total: alumnos.length,
    acreditados: alumnos.filter((a) => a.estado === 'ACREDITADO').length,
    noAcreditados: alumnos.filter((a) => a.estado === 'NO_ACREDITADO').length,
    pendientes: alumnos.filter((a) => a.estado === 'PENDIENTE').length,
    promedio: finales.length
      ? Math.round((finales.reduce((s, f) => s + f, 0) / finales.length) * 10) /
        10
      : null,
    alumnos,
  };
}
