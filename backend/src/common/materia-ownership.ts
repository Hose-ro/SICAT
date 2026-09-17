import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type PrismaLike = PrismaService | Prisma.TransactionClient;

export interface ActorMateria {
  id: number;
  rol: string;
}

/**
 * Un docente imparte la materia si la tiene asignada directamente o si tiene un
 * horario activo en ella. La asignación directa (`Materia.docenteId`) sólo
 * guarda un docente, así que en cuanto la misma materia se da en varios grupos
 * deja de ser suficiente por sí sola.
 */
export async function esDocenteDeMateria(
  prisma: PrismaLike,
  materiaId: number,
  docenteId: number,
  grupoId?: number | null,
): Promise<boolean> {
  const asignacionDirecta = await prisma.materia.count({
    where: { id: materiaId, docenteId },
  });
  if (asignacionDirecta > 0) return true;

  const horarios = await prisma.horarioMateria.count({
    where: {
      materiaId,
      docenteId,
      activo: true,
      ...(grupoId ? { grupoId } : {}),
    },
  });
  return horarios > 0;
}

/** Filtro reutilizable para listar las materias que imparte un docente. */
export function materiasDelDocenteWhere(
  docenteId: number,
): Prisma.MateriaWhereInput {
  return {
    OR: [{ docenteId }, { horarios: { some: { docenteId, activo: true } } }],
  };
}

export async function asegurarAccesoMateria(
  prisma: PrismaLike,
  actor: ActorMateria | undefined,
  materiaId: number,
  grupoId?: number | null,
): Promise<void> {
  if (!actor || actor.rol === 'ADMIN') return;
  if (actor.rol !== 'DOCENTE') {
    throw new ForbiddenException('No tienes acceso a esta materia');
  }
  const materia = await prisma.materia.count({ where: { id: materiaId } });
  if (!materia) throw new NotFoundException('Materia no encontrada');

  const imparte = await esDocenteDeMateria(
    prisma,
    materiaId,
    actor.id,
    grupoId,
  );
  if (!imparte) {
    throw new ForbiddenException('No impartes esta materia');
  }
}

/**
 * Fragmentos `{ materiaId, grupoId? }` para filtrar filas con materia y grupo
 * (tareas, calificaciones) con la misma regla que `esDocenteDeMateria`: la
 * asignación directa cubre todos los grupos y cada horario activo sólo el
 * suyo. Evita repetir la consulta por cada fila.
 */
export async function clasesDelDocenteWhere(
  prisma: PrismaLike,
  docenteId: number,
): Promise<Array<{ materiaId: number; grupoId?: number | null }>> {
  const [directas, horarios] = await Promise.all([
    prisma.materia.findMany({ where: { docenteId }, select: { id: true } }),
    prisma.horarioMateria.findMany({
      where: { docenteId, activo: true },
      select: { materiaId: true, grupoId: true },
      distinct: ['materiaId', 'grupoId'],
    }),
  ]);
  return [
    ...directas.map((materia) => ({ materiaId: materia.id })),
    ...horarios,
  ];
}

/**
 * Docente responsable de una materia en un grupo: la asignación directa y, si
 * no la hay, el docente del horario activo de ese grupo. Se usa cuando un ADMIN
 * crea recursos "a nombre" del docente que imparte la clase.
 */
export async function docenteResponsableDeMateria(
  prisma: PrismaLike,
  materiaId: number,
  grupoId?: number | null,
): Promise<number | null> {
  const materia = await prisma.materia.findUnique({
    where: { id: materiaId },
    select: { docenteId: true },
  });
  if (materia?.docenteId) return materia.docenteId;
  const horario = await prisma.horarioMateria.findFirst({
    where: { materiaId, activo: true, ...(grupoId ? { grupoId } : {}) },
    select: { docenteId: true },
    orderBy: { id: 'asc' },
  });
  return horario?.docenteId ?? null;
}
