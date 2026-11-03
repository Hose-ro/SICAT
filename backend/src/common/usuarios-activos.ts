import { Prisma } from '@prisma/client';

/**
 * Un usuario desactivado por el administrador cuenta como eliminado: no
 * aparece en listas, horarios, padrones ni indicadores de nadie. Sus datos se
 * conservan sólo para que el administrador pueda reactivarlo; por eso todo lo
 * que cuelga de un docente se filtra al leer en lugar de borrarse.
 */
export const usuarioActivo = { activo: true } as const;

/** Horario que cuenta: activo y de un docente activo. */
export const horarioVigente = {
  activo: true,
  docente: usuarioActivo,
} as const satisfies Prisma.HorarioMateriaWhereInput;

/**
 * El docente titular de una materia, o `null` si su cuenta está desactivada
 * (la materia queda "sin docente", igual que si se hubiera eliminado).
 */
export function docenteVigente<T extends { activo: boolean }>(
  docente: T | null | undefined,
): Omit<T, 'activo'> | null {
  if (!docente?.activo) return null;
  const { activo: _activo, ...resto } = docente;
  return resto;
}

/** Materias cuyo titular sigue activo (o no tienen titular). */
export const titularVigente = {
  OR: [{ docenteId: null }, { docente: usuarioActivo }],
} as const satisfies Prisma.MateriaWhereInput;
