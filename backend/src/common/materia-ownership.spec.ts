import { PrismaService } from '../prisma.service';
import {
  clasesDelDocenteWhere,
  docenteResponsableDeMateria,
  gruposPropios,
} from './materia-ownership';

describe('materia-ownership: helpers de listado y responsable', () => {
  const materiaFindMany = jest.fn();
  const materiaFindFirst = jest.fn();
  const horarioFindMany = jest.fn();
  const horarioFindFirst = jest.fn();
  const prisma = {
    materia: { findMany: materiaFindMany, findFirst: materiaFindFirst },
    horarioMateria: { findMany: horarioFindMany, findFirst: horarioFindFirst },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindMany.mockResolvedValue([]);
    materiaFindFirst.mockResolvedValue(null);
    horarioFindMany.mockResolvedValue([]);
    horarioFindFirst.mockResolvedValue(null);
  });

  it('clasesDelDocenteWhere: la asignación directa (sin horarios) cubre todos los grupos y el horario sólo el suyo', async () => {
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
    expect(materiaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { docenteId: 31, horarios: { none: { activo: true } } },
      }),
    );
  });

  it('docenteResponsableDeMateria: prefiere el horario activo del grupo', async () => {
    horarioFindFirst.mockResolvedValue({ docenteId: 32 });
    await expect(docenteResponsableDeMateria(prisma, 12, 3)).resolves.toBe(32);
    expect(horarioFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { materiaId: 12, activo: true, grupoId: 3 },
      }),
    );
    expect(materiaFindFirst).not.toHaveBeenCalled();
  });

  it('docenteResponsableDeMateria: sin horario en el grupo sólo cuenta el titular de una materia sin horarios', async () => {
    materiaFindFirst.mockResolvedValue({ docenteId: 31 });
    await expect(docenteResponsableDeMateria(prisma, 12, 3)).resolves.toBe(31);
    expect(materiaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12, horarios: { none: { activo: true } } },
      }),
    );
    materiaFindFirst.mockResolvedValue(null);
    await expect(
      docenteResponsableDeMateria(prisma, 12, 3),
    ).resolves.toBeNull();
  });

  describe('gruposPropios', () => {
    const grupos = [{ id: 1 }, { id: 2 }];

    it('con horarios, sólo los grupos de los bloques del docente aunque sea titular', () => {
      expect(
        gruposPropios(
          { docenteId: 31, grupos, horarios: [{ docenteId: 31, grupoId: 1 }] },
          31,
        ),
      ).toEqual([{ id: 1 }]);
    });

    it('sin horarios, el titular ve todos los grupos y nadie más', () => {
      const materia = { docenteId: 31, grupos, horarios: [] };
      expect(gruposPropios(materia, 31)).toEqual(grupos);
      expect(gruposPropios(materia, 32)).toEqual([]);
    });

    it('un bloque heredado sin grupo cubre todos', () => {
      expect(
        gruposPropios(
          {
            docenteId: null,
            grupos,
            horarios: [{ docenteId: 32, grupoId: null }],
          },
          32,
        ),
      ).toEqual(grupos);
    });
  });
});
