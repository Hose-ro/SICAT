import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UnidadesService } from './unidades.service';

describe('UnidadesService (IDOR)', () => {
  const unidadFindUnique = jest.fn();
  const unidadFindFirst = jest.fn();
  const unidadUpdate = jest.fn();
  const unidadFindMany = jest.fn();
  const materiaCount = jest.fn();
  const horarioMateriaCount = jest.fn();
  const prisma = {
    unidad: {
      findUnique: unidadFindUnique,
      findFirst: unidadFindFirst,
      update: unidadUpdate,
      findMany: unidadFindMany,
    },
    materia: { count: materiaCount },
    horarioMateria: { count: horarioMateriaCount },
  } as unknown as PrismaService;
  const service = new UnidadesService(prisma);

  const unidadId = 7;
  const materiaId = 12;
  const docenteId = 31;
  const otroDocenteId = 99;

  // `asegurarAccesoMateria` primero pregunta si la materia existe
  // (where: { id }) y luego, dentro de `esDocenteDeMateria`, si el docente
  // la imparte (where: { id, docenteId }). Ambas llamadas comparten el mismo
  // mock de `materia.count`, así que hay que distinguirlas por el `where`.
  function mockMateriaCount(existe: boolean, imparte: boolean) {
    materiaCount.mockImplementation(
      ({ where }: { where: { docenteId?: number } }) =>
        Promise.resolve(
          'docenteId' in where ? (imparte ? 1 : 0) : existe ? 1 : 0,
        ),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    unidadFindFirst.mockResolvedValue(null);
    unidadUpdate.mockResolvedValue({ id: unidadId, status: 'ACTIVA' });
    unidadFindMany.mockResolvedValue([]);
    horarioMateriaCount.mockResolvedValue(0);
  });

  describe('iniciar', () => {
    beforeEach(() => {
      unidadFindUnique.mockResolvedValue({
        id: unidadId,
        materiaId,
        status: 'PENDIENTE',
      });
    });

    it('rechaza a un DOCENTE que no imparte la materia de la unidad', async () => {
      mockMateriaCount(true, false);

      await expect(
        service.iniciar(unidadId, { id: otroDocenteId, rol: 'DOCENTE' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });

    it('permite a un DOCENTE que sí imparte la materia', async () => {
      mockMateriaCount(true, true);

      await expect(
        service.iniciar(unidadId, { id: docenteId, rol: 'DOCENTE' }),
      ).resolves.toBeDefined();

      expect(unidadUpdate).toHaveBeenCalled();
    });

    it('no restringe a un ADMIN', async () => {
      await expect(
        service.iniciar(unidadId, { id: 1, rol: 'ADMIN' }),
      ).resolves.toBeDefined();

      expect(materiaCount).not.toHaveBeenCalled();
      expect(unidadUpdate).toHaveBeenCalled();
    });
  });

  describe('finalizar', () => {
    beforeEach(() => {
      unidadFindUnique.mockResolvedValue({
        id: unidadId,
        materiaId,
        status: 'ACTIVA',
      });
    });

    it('rechaza a un DOCENTE que no imparte la materia de la unidad', async () => {
      mockMateriaCount(true, false);

      await expect(
        service.finalizar(unidadId, { id: otroDocenteId, rol: 'DOCENTE' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });

    it('permite a un DOCENTE que sí imparte la materia', async () => {
      mockMateriaCount(true, true);

      await expect(
        service.finalizar(unidadId, { id: docenteId, rol: 'DOCENTE' }),
      ).resolves.toBeDefined();

      expect(unidadUpdate).toHaveBeenCalled();
    });
  });

  describe('findByMateria', () => {
    it('rechaza a un DOCENTE que no imparte la materia', async () => {
      mockMateriaCount(true, false);

      await expect(
        service.findByMateria(materiaId, {
          id: otroDocenteId,
          rol: 'DOCENTE',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(unidadFindMany).not.toHaveBeenCalled();
    });

    it('rechaza a un ALUMNO (endpoint reservado a docente/admin)', async () => {
      await expect(
        service.findByMateria(materiaId, { id: 50, rol: 'ALUMNO' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(unidadFindMany).not.toHaveBeenCalled();
    });

    it('permite a un DOCENTE que sí imparte la materia', async () => {
      mockMateriaCount(true, true);

      await expect(
        service.findByMateria(materiaId, { id: docenteId, rol: 'DOCENTE' }),
      ).resolves.toEqual([]);

      expect(unidadFindMany).toHaveBeenCalled();
    });
  });
});
