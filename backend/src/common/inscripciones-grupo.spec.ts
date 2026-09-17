import { PrismaService } from '../prisma.service';
import { getCurrentAcademicPeriod } from './periodo.util';
import {
  inscribirAlumnosDelGrupo,
  quitarInscripcionesDelGrupo,
} from './inscripciones-grupo';

describe('inscripciones por grupo', () => {
  const grupoFindUnique = jest.fn();
  const horarioFindMany = jest.fn();
  const usuarioFindMany = jest.fn();
  const inscripcionFindMany = jest.fn();
  const inscripcionCreateMany = jest.fn();
  const inscripcionUpdateMany = jest.fn();
  const inscripcionDeleteMany = jest.fn();
  const prisma = {
    grupo: { findUnique: grupoFindUnique },
    horarioMateria: { findMany: horarioFindMany },
    usuario: { findMany: usuarioFindMany },
    inscripcion: {
      findMany: inscripcionFindMany,
      createMany: inscripcionCreateMany,
      updateMany: inscripcionUpdateMany,
      deleteMany: inscripcionDeleteMany,
    },
  } as unknown as PrismaService;
  const periodo = getCurrentAcademicPeriod();

  beforeEach(() => {
    jest.clearAllMocks();
    // Materia 10 ligada al grupo, materia 11 sólo en el horario: cuentan las dos.
    grupoFindUnique.mockResolvedValue({ materias: [{ id: 10 }] });
    horarioFindMany.mockResolvedValue([{ materiaId: 10 }, { materiaId: 11 }]);
    usuarioFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    inscripcionFindMany.mockResolvedValue([]);
    inscripcionCreateMany.mockImplementation(({ data }: { data: unknown[] }) =>
      Promise.resolve({ count: data.length }),
    );
    inscripcionUpdateMany.mockResolvedValue({ count: 0 });
    inscripcionDeleteMany.mockResolvedValue({ count: 0 });
  });

  it('inscribe a todo el grupo en cada materia que se le imparte', async () => {
    await expect(inscribirAlumnosDelGrupo(prisma, 4)).resolves.toEqual({
      creadas: 4,
      reactivadas: 0,
    });
    expect(usuarioFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { grupoId: 4, rol: 'ALUMNO', activo: true },
      }),
    );
    expect(inscripcionCreateMany).toHaveBeenCalledWith({
      data: [
        { alumnoId: 1, materiaId: 10, grupoId: 4, periodo, estado: 'ACEPTADA' },
        { alumnoId: 1, materiaId: 11, grupoId: 4, periodo, estado: 'ACEPTADA' },
        { alumnoId: 2, materiaId: 10, grupoId: 4, periodo, estado: 'ACEPTADA' },
        { alumnoId: 2, materiaId: 11, grupoId: 4, periodo, estado: 'ACEPTADA' },
      ],
      skipDuplicates: true,
    });
    expect(inscripcionUpdateMany).not.toHaveBeenCalled();
  });

  it('respeta las aceptadas, reactiva las rechazadas y crea sólo las que faltan', async () => {
    inscripcionFindMany.mockResolvedValue([
      { id: 100, alumnoId: 1, materiaId: 10, estado: 'ACEPTADA' },
      { id: 101, alumnoId: 1, materiaId: 11, estado: 'RECHAZADA' },
    ]);
    inscripcionUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      inscribirAlumnosDelGrupo(prisma, 4, { alumnoIds: [1] }),
    ).resolves.toEqual({ creadas: 0, reactivadas: 1 });
    expect(usuarioFindMany).not.toHaveBeenCalled();
    expect(inscripcionCreateMany).not.toHaveBeenCalled();
    expect(inscripcionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [101] } },
      data: { estado: 'ACEPTADA', grupoId: 4 },
    });
  });

  it('no consulta nada más cuando el grupo no tiene materias o alumnos', async () => {
    grupoFindUnique.mockResolvedValue({ materias: [] });
    horarioFindMany.mockResolvedValue([]);

    await expect(inscribirAlumnosDelGrupo(prisma, 4)).resolves.toEqual({
      creadas: 0,
      reactivadas: 0,
    });
    expect(inscripcionFindMany).not.toHaveBeenCalled();

    await inscribirAlumnosDelGrupo(prisma, 4, {
      materiaIds: [10],
      alumnoIds: [],
    });
    expect(inscripcionFindMany).not.toHaveBeenCalled();
  });

  it('al salir del grupo borra sólo las inscripciones de ese grupo en el periodo', async () => {
    inscripcionDeleteMany.mockResolvedValue({ count: 2 });

    await expect(quitarInscripcionesDelGrupo(prisma, 4, [1])).resolves.toBe(2);
    expect(inscripcionDeleteMany).toHaveBeenCalledWith({
      where: { grupoId: 4, alumnoId: { in: [1] }, periodo },
    });

    await quitarInscripcionesDelGrupo(prisma, 4, []);
    expect(inscripcionDeleteMany).toHaveBeenCalledTimes(1);
  });
});
