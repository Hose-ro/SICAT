import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CalificacionesService } from './calificaciones.service';

describe('CalificacionesService: política docente–materia–grupo', () => {
  const materiaFindUnique = jest.fn();
  const materiaCount = jest.fn();
  const materiaUpdate = jest.fn();
  const horarioMateriaCount = jest.fn();
  const prisma = {
    materia: {
      findUnique: materiaFindUnique,
      count: materiaCount,
      update: materiaUpdate,
    },
    horarioMateria: { count: horarioMateriaCount },
  } as unknown as PrismaService;
  const service = new CalificacionesService(prisma);

  const docente = { id: 31, rol: 'DOCENTE' };
  const materia = {
    id: 12,
    docenteId: 99,
    grupos: [{ id: 3, nombre: '8A' }],
    unidades: [{ id: 5, orden: 1, nombre: 'Unidad 1' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindUnique.mockResolvedValue(materia);
    // asegurarAccesoMateria: existe (where sin docenteId) / asignación directa (con docenteId)
    materiaCount.mockImplementation(
      ({ where }: { where: { docenteId?: number } }) =>
        Promise.resolve('docenteId' in where ? 0 : 1),
    );
    horarioMateriaCount.mockResolvedValue(0);
    materiaUpdate.mockResolvedValue({ id: 12 });
  });

  it('el reporte se niega a un docente que no imparte la materia en el grupo pedido', async () => {
    await expect(
      service.obtenerReporteDocente(docente, { materiaId: 12, grupoId: 3 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(horarioMateriaCount).toHaveBeenCalledWith({
      where: { materiaId: 12, docenteId: docente.id, activo: true, grupoId: 3 },
    });
  });

  it('la captura manual se niega con la misma política', async () => {
    await expect(
      service.guardarManual(docente, {
        materiaId: 12,
        grupoId: 3,
        unidadId: 5,
        alumnoId: 500,
        calificacionManual: 90,
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un docente con horario activo en ese grupo pasa la verificación de acceso', async () => {
    horarioMateriaCount.mockResolvedValue(1);
    // Sin más mocks el reporte falla después del control de acceso; sólo nos
    // interesa que ya no sea un 403.
    await expect(
      service.obtenerReporteDocente(docente, { materiaId: 12, grupoId: 3 }),
    ).rejects.not.toBeInstanceOf(ForbiddenException);
  });

  describe('ponderación persistida por materia', () => {
    it('la guarda sólo quien imparte la materia y exige que sume 100', async () => {
      await expect(
        service.guardarPonderacion(docente, {
          materiaId: 12,
          pesoTareas: 70,
          pesoAsistencia: 30,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(materiaUpdate).not.toHaveBeenCalled();

      horarioMateriaCount.mockResolvedValue(1);
      await expect(
        service.guardarPonderacion(docente, {
          materiaId: 12,
          pesoTareas: 70,
          pesoAsistencia: 40,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.guardarPonderacion(docente, {
          materiaId: 12,
          pesoTareas: 70,
          pesoAsistencia: 30,
        }),
      ).resolves.toEqual({ tareas: 70, asistencia: 30 });
      expect(materiaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 12 },
          data: { pesoTareas: 70, pesoAsistencia: 30 },
        }),
      );
    });
  });
});
