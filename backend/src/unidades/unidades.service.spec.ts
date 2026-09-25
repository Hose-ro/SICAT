import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
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

  describe('cancelar', () => {
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
        service.cancelar(unidadId, { id: otroDocenteId, rol: 'DOCENTE' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });

    it('permite a un DOCENTE que sí imparte la materia y la regresa a PENDIENTE', async () => {
      mockMateriaCount(true, true);

      await service.cancelar(unidadId, { id: docenteId, rol: 'DOCENTE' });

      expect(unidadUpdate).toHaveBeenCalledWith({
        where: { id: unidadId },
        data: { status: 'PENDIENTE', fechaInicio: null },
      });
    });

    it('rechaza cancelar una unidad que no está ACTIVA', async () => {
      unidadFindUnique.mockResolvedValue({
        id: unidadId,
        materiaId,
        status: 'PENDIENTE',
      });

      await expect(
        service.cancelar(unidadId, { id: 1, rol: 'ADMIN' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });
  });

  describe('reabrir', () => {
    beforeEach(() => {
      unidadFindUnique.mockResolvedValue({
        id: unidadId,
        materiaId,
        orden: 2,
        status: 'FINALIZADA',
      });
    });

    it('rechaza a un DOCENTE que no imparte la materia de la unidad', async () => {
      mockMateriaCount(true, false);

      await expect(
        service.reabrir(unidadId, { id: otroDocenteId, rol: 'DOCENTE' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });

    it('regresa la unidad a ACTIVA y borra su fecha de fin', async () => {
      mockMateriaCount(true, true);

      await service.reabrir(unidadId, { id: docenteId, rol: 'DOCENTE' });

      expect(unidadUpdate).toHaveBeenCalledWith({
        where: { id: unidadId },
        data: { status: 'ACTIVA', fechaFin: null },
      });
    });

    it('rechaza reabrir una unidad que no está FINALIZADA', async () => {
      unidadFindUnique.mockResolvedValue({
        id: unidadId,
        materiaId,
        orden: 2,
        status: 'ACTIVA',
      });

      await expect(
        service.reabrir(unidadId, { id: 1, rol: 'ADMIN' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });

    it('rechaza reabrir si ya hay otra unidad activa', async () => {
      unidadFindFirst.mockResolvedValueOnce({
        id: 8,
        nombre: 'Unidad 3',
        status: 'ACTIVA',
      });

      await expect(
        service.reabrir(unidadId, { id: 1, rol: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });

    it('rechaza reabrir si una unidad posterior ya se inició', async () => {
      unidadFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 8, orden: 3, status: 'FINALIZADA' });

      await expect(
        service.reabrir(unidadId, { id: 1, rol: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(unidadFindFirst).toHaveBeenLastCalledWith({
        where: {
          materiaId,
          orden: { gt: 2 },
          status: { not: 'PENDIENTE' },
        },
      });
      expect(unidadUpdate).not.toHaveBeenCalled();
    });
  });

  describe('editarFechas', () => {
    beforeEach(() => {
      unidadFindUnique.mockResolvedValue({
        id: unidadId,
        materiaId,
        status: 'FINALIZADA',
        fechaInicio: new Date('2026-08-10T00:00:00.000Z'),
        fechaFin: new Date('2026-09-10T00:00:00.000Z'),
      });
    });

    it('rechaza a un DOCENTE que no imparte la materia de la unidad', async () => {
      mockMateriaCount(true, false);

      await expect(
        service.editarFechas(
          unidadId,
          { id: otroDocenteId, rol: 'DOCENTE' },
          { fechaInicio: '2026-08-01T00:00' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(unidadUpdate).not.toHaveBeenCalled();
    });

    it('permite a un DOCENTE que sí imparte la materia actualizar solo el campo enviado', async () => {
      mockMateriaCount(true, true);

      await service.editarFechas(
        unidadId,
        { id: docenteId, rol: 'DOCENTE' },
        { fechaInicio: '2026-08-01T00:00' },
      );

      // Medianoche en Mexico_City (UTC-6 fijo) cae a las 06:00 UTC.
      expect(unidadUpdate).toHaveBeenCalledWith({
        where: { id: unidadId },
        data: { fechaInicio: new Date('2026-08-01T06:00:00.000Z') },
      });
    });

    it('rechaza si la fecha de fin queda antes que la de inicio', async () => {
      await expect(
        service.editarFechas(
          unidadId,
          { id: 1, rol: 'ADMIN' },
          { fechaFin: '2026-01-01T00:00' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(unidadUpdate).not.toHaveBeenCalled();
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
