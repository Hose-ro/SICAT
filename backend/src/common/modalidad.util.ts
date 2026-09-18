import { ModalidadGrupo } from '@prisma/client';
import { normalizarTexto } from '../clases/clases.utils';

export const MODALIDADES: ModalidadGrupo[] = ['ESCOLARIZADO', 'MIXTO'];

/**
 * Modalidad de un bloque de horario: la de su grupo. Un bloque sin grupo se
 * clasifica por el día, porque sólo los mixtos tienen clase en sábado.
 */
export function modalidadDeHorario(horario: {
  dias: string;
  grupo?: { modalidad: ModalidadGrupo } | null;
}): ModalidadGrupo {
  if (horario.grupo?.modalidad) return horario.grupo.modalidad;
  const dias = horario.dias.split(',').map((dia) => normalizarTexto(dia));
  return dias.includes('sabado') ? 'MIXTO' : 'ESCOLARIZADO';
}
