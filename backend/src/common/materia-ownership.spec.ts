import { PrismaService } from '../prisma.service';
import {
  clasesDelDocenteWhere,
  docenteResponsableDeMateria,
} from './materia-ownership';

describe('materia-ownership: helpers de listado y responsable', () => {
  const materiaFindMany = jest.fn();
  const materiaFindUnique = jest.fn();
  const horarioFindMany = jest.fn();
  const horarioFindFirst = jest.fn();
  const prisma = {
    materia: { findMany: materiaFindMany, findUnique: materiaFindUnique },
    horarioMateria: { findMany: horarioFindMany, findFirst: horarioFindFirst },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindMany.mockResolvedValue([]);
    materiaFindUnique.mockResolvedValue(null);
    horarioFindMany.mockResolvedValue([]);
    horarioFindFirst.mockResolvedValue(null);
  });

  it('clasesDelDocenteWhere: la asignación directa cubre todos los grupos y el horario sólo el suyo', async () => {
    materiaFindMany.mockResolvedValue([{ id: 40 }]);
    horarioFindMany.mockResolvedValue([
      { materiaId: 12, grupoId: 3 },
      { materiaId: 13, grupoId: null },
    ]);
    await expect(clasesDelDocenteWhere(prisma, 31)).resolves.toEqual([
      { materiaId: 40 },
      { materiaId: 12, grupoId: 3 },
      { materiaId: 13, grupoId: null },
    ]);
    expect(horarioFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { docenteId: 31, activo: true } }),
    );
  });

  it('docenteResponsableDeMateria: prefiere la asignación directa', async () => {
    materiaFindUnique.mockResolvedValue({ docenteId: 31 });
    await expect(docenteResponsableDeMateria(prisma, 12, 3)).resolves.toBe(31);
    expect(horarioFindFirst).not.toHaveBeenCalled();
  });

  it('docenteResponsableDeMateria: cae al horario activo del grupo y a null si no hay', async () => {
    materiaFindUnique.mockResolvedValue({ docenteId: null });
    horarioFindFirst.mockResolvedValue({ docenteId: 32 });
    await expect(docenteResponsableDeMateria(prisma, 12, 3)).resolves.toBe(32);
    expect(horarioFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { materiaId: 12, activo: true, grupoId: 3 },
      }),
    );
    horarioFindFirst.mockResolvedValue(null);
    await expect(
      docenteResponsableDeMateria(prisma, 12, 3),
    ).resolves.toBeNull();
  });
});
