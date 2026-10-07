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
