import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type PrismaLike = PrismaService | Prisma.TransactionClient;

/**
 * Alumnos activos de una clase (materia + grupo): sólo los que tienen la
 * inscripción ACEPTADA, sean del grupo o los haya inscrito el docente en esa
 * clase. Es la misma regla con la que se arman las listas y las tareas.
 */
export async function alumnosDeClase(
  prisma: PrismaLike,
  materiaId: number,
  grupoId: number,
) {
  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      materiaId,
      estado: 'ACEPTADA',
      alumno: { rol: 'ALUMNO', activo: true },
      OR: [{ alumno: { grupoId } }, { grupoId }],
    },
    select: { alumno: { select: { id: true, nombre: true } } },
    orderBy: { alumno: { nombre: 'asc' } },
  });
  return Array.from(
    new Map(
      inscripciones.map((item) => [item.alumno.id, item.alumno]),
    ).values(),
  );
}
