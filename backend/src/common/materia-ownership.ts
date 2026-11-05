import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type PrismaLike = PrismaService | Prisma.TransactionClient;

export interface ActorMateria {
  id: number;
  rol: string;
}

/**
 * La asignación directa (`Materia.docenteId`) sólo guarda un docente y, en
 * cuanto hay horarios, se sincroniza con el del primer bloque de cualquier
 * grupo. Por eso sólo cuenta si la materia no tiene horarios activos: con
 * horarios, cada docente imparte únicamente en los grupos de sus bloques.
 */
function asignacionDirectaWhere(docenteId: number): Prisma.MateriaWhereInput {
  return { docenteId, horarios: { none: { activo: true } } };
}

/**
 * Un docente imparte la materia si tiene un horario activo en ella o, cuando
 * la materia aún no tiene horarios, si la tiene asignada directamente.
 */
export async function esDocenteDeMateria(
  prisma: PrismaLike,
  materiaId: number,
  docenteId: number,
  grupoId?: number | null,
): Promise<boolean> {
  const asignacionDirecta = await prisma.materia.count({
    where: { id: materiaId, ...asignacionDirectaWhere(docenteId) },
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
    OR: [
      asignacionDirectaWhere(docenteId),
      { horarios: { some: { docenteId, activo: true } } },
    ],
  };
}

/**
 * Grupos de la materia en los que el docente da clase: los de sus horarios
 * activos (un bloque sin grupo, heredado, cubre todos) o todos si la tiene
 * asignada directamente y aún no hay horarios.
 */
export function gruposPropios<G extends { id: number }>(
  materia: {
    docenteId: number | null;
    grupos: G[];
    horarios: Array<{ docenteId: number; grupoId: number | null }>;
  },
  docenteId: number,
): G[] {
  if (!materia.horarios.length) {
    return materia.docenteId === docenteId ? materia.grupos : [];
  }
  const propios = materia.horarios.filter((h) => h.docenteId === docenteId);
  if (propios.some((h) => h.grupoId === null)) return materia.grupos;
  const ids = new Set(propios.map((h) => h.grupoId));
  return materia.grupos.filter((grupo) => ids.has(grupo.id));
}

/**
 * Igual que `materiasDelDocenteWhere`, sin las materias que el docente pausó.
 * Sirve para su trabajo diario (inicio, pasar lista, tareas, calificaciones);
 * el acceso a la materia no cambia, así puede abrirla y reanudarla.
 */
export function materiasActivasDelDocenteWhere(
  docenteId: number,
): Prisma.MateriaWhereInput {
  return {
    AND: [
      materiasDelDocenteWhere(docenteId),
      { pausas: { none: { docenteId } } },
    ],
  };
}

/**
 * La jefatura sólo gestiona materias de las carreras que tiene asignadas y
 * activas. Una materia sin carrera queda fuera de su alcance.
 */
export async function asegurarCarreraDeJefe(
  prisma: PrismaLike,
  usuarioId: number,
  carreraId: number | null | undefined,
): Promise<void> {
  const asignada = carreraId
    ? await prisma.jefeCarreraAsignacion.count({
        where: { usuarioId, carreraId, activa: true },
      })
    : 0;
  if (!asignada) {
    throw new ForbiddenException('Carrera fuera de tu alcance');
  }
}

export async function asegurarAccesoMateria(
  prisma: PrismaLike,
  actor: ActorMateria | undefined,
  materiaId: number,
  grupoId?: number | null,
): Promise<void> {
  if (!actor || actor.rol === 'ADMIN') return;
  if (actor.rol === 'JEFE_CARRERA') {
    const materia = await prisma.materia.findUnique({
      where: { id: materiaId },
      select: { carreraId: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    await asegurarCarreraDeJefe(prisma, actor.id, materia.carreraId);
    return;
  }
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
 * asignación directa (materia sin horarios) cubre todos los grupos y cada
 * horario activo sólo el suyo. Evita repetir la consulta por cada fila.
 */
export async function clasesDelDocenteWhere(
  prisma: PrismaLike,
  docenteId: number,
): Promise<Array<{ materiaId: number; grupoId?: number | null }>> {
  const [directas, horarios] = await Promise.all([
    prisma.materia.findMany({
      where: asignacionDirectaWhere(docenteId),
      select: { id: true },
    }),
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
 * Docente responsable de una materia en un grupo: el del horario activo de ese
 * grupo y, si la materia no tiene horarios, la asignación directa. Se usa
 * cuando un ADMIN crea recursos "a nombre" del docente que imparte la clase.
 */
export async function docenteResponsableDeMateria(
  prisma: PrismaLike,
  materiaId: number,
  grupoId?: number | null,
): Promise<number | null> {
  const horario = await prisma.horarioMateria.findFirst({
    where: { materiaId, activo: true, ...(grupoId ? { grupoId } : {}) },
    select: { docenteId: true },
    orderBy: { id: 'asc' },
  });
  if (horario) return horario.docenteId;
  const materia = await prisma.materia.findFirst({
    where: { id: materiaId, horarios: { none: { activo: true } } },
    select: { docenteId: true },
  });
  return materia?.docenteId ?? null;
}

/**
 * Grupos de la materia en los que el actor da clase, para ofrecerle copiar
 * algo (p. ej. sus criterios de evaluación) a sus otros grupos: todos si es
 * ADMIN; si no, los de `gruposPropios`.
 */
export async function gruposDelDocenteEnMateria(
  prisma: PrismaLike,
  materiaId: number,
  actor: ActorMateria | undefined,
): Promise<Array<{ id: number; nombre: string }>> {
  const materia = await prisma.materia.findUnique({
    where: { id: materiaId },
    select: {
      docenteId: true,
      grupos: {
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      },
      horarios: {
        where: { activo: true },
        select: { docenteId: true, grupoId: true },
      },
    },
  });
  if (!materia) return [];
  if (!actor || actor.rol === 'ADMIN') return materia.grupos;
  return gruposPropios(materia, actor.id);
}
