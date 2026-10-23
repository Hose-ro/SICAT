import { Prisma } from '@prisma/client';

/**
 * Un grupo llega a "Mis grupos" por dos caminos: porque el docente tiene un
 * horario activo en él o porque lo agregó a mano desde el catálogo. El
 * segundo existe para el docente que todavía no tiene horario cargado y aun
 * así necesita ver a su grupo.
 */
export function gruposDelDocenteWhere(
  docenteId: number,
): Prisma.GrupoWhereInput {
  return {
    activo: true,
    OR: [
      { docentes: { some: { id: docenteId } } },
      { horarios: { some: { docenteId, activo: true } } },
    ],
  };
}
