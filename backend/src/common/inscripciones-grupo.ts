import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { getCurrentAcademicPeriod } from './periodo.util';

type PrismaLike = PrismaService | Prisma.TransactionClient;

/**
 * Materias que se imparten al grupo: las ligadas directamente y las de
 * cualquier bloque activo de su horario, que es de donde salen las clases.
 */
async function materiasDelGrupo(prisma: PrismaLike, grupoId: number) {
  const [grupo, horarios] = await Promise.all([
    prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { materias: { select: { id: true } } },
    }),
    prisma.horarioMateria.findMany({
      where: { grupoId, activo: true },
      select: { materiaId: true },
    }),
  ]);
  return Array.from(
    new Set([
      ...(grupo?.materias ?? []).map((materia) => materia.id),
      ...horarios.map((horario) => horario.materiaId),
    ]),
  );
}

/**
 * Inscribe a los alumnos de un grupo en las materias que se le imparten. La
 * lista de asistencia, las calificaciones y las tareas se arman con las
 * inscripciones, así que estar en el grupo no basta: sin este alta el alumno
 * no aparece en ninguna clase. Es idempotente: crea las que faltan en el
 * periodo en curso y reactiva las pendientes o rechazadas, sin tocar las que
 * ya estaban aceptadas.
 *
 * Sin `alumnoIds` abarca a todos los alumnos activos del grupo; sin
 * `materiaIds`, todas las materias del grupo.
 */
export async function inscribirAlumnosDelGrupo(
  prisma: PrismaLike,
  grupoId: number,
  opciones: { alumnoIds?: number[]; materiaIds?: number[] } = {},
) {
  const resultado = { creadas: 0, reactivadas: 0 };

  const materiaIds =
    opciones.materiaIds ?? (await materiasDelGrupo(prisma, grupoId));
  if (materiaIds.length === 0) return resultado;

  const alumnoIds =
    opciones.alumnoIds ??
    (
      await prisma.usuario.findMany({
        where: { grupoId, rol: 'ALUMNO', activo: true },
        select: { id: true },
      })
    ).map((alumno) => alumno.id);
  if (alumnoIds.length === 0) return resultado;

  const periodo = getCurrentAcademicPeriod();
  const existentes = await prisma.inscripcion.findMany({
    where: {
      periodo,
      alumnoId: { in: alumnoIds },
      materiaId: { in: materiaIds },
    },
    select: { id: true, alumnoId: true, materiaId: true, estado: true },
  });

  const clave = (alumnoId: number, materiaId: number) =>
    `${alumnoId}:${materiaId}`;
  const yaExisten = new Set(
    existentes.map((item) => clave(item.alumnoId, item.materiaId)),
  );

  const faltantes = alumnoIds.flatMap((alumnoId) =>
    materiaIds
      .filter((materiaId) => !yaExisten.has(clave(alumnoId, materiaId)))
      .map((materiaId) => ({
        alumnoId,
        materiaId,
        grupoId,
        periodo,
        estado: 'ACEPTADA' as const,
      })),
  );
  if (faltantes.length > 0) {
    const creadas = await prisma.inscripcion.createMany({
      data: faltantes,
      skipDuplicates: true,
    });
    resultado.creadas = creadas.count;
  }

  const reactivar = existentes
    .filter((item) => item.estado !== 'ACEPTADA')
    .map((item) => item.id);
  if (reactivar.length > 0) {
    const reactivadas = await prisma.inscripcion.updateMany({
      where: { id: { in: reactivar } },
      data: { estado: 'ACEPTADA', grupoId },
    });
    resultado.reactivadas = reactivadas.count;
  }

  return resultado;
}

/**
 * Al salir del grupo, el alumno deja las clases de ese grupo: se borran las
 * inscripciones del periodo en curso ligadas a él. Las que no tienen grupo
 * (solicitadas por el alumno o dadas de alta sin grupo) se conservan, y el
 * historial de asistencias, tareas y calificaciones no se toca.
 */
export async function quitarInscripcionesDelGrupo(
  prisma: PrismaLike,
  grupoId: number,
  alumnoIds: number[],
) {
  if (alumnoIds.length === 0) return 0;
  const { count } = await prisma.inscripcion.deleteMany({
    where: {
      grupoId,
      alumnoId: { in: alumnoIds },
      periodo: getCurrentAcademicPeriod(),
    },
  });
  return count;
}
