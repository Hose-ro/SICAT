import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JefesCarreraService } from './jefes-carrera.service';

describe('JefesCarreraService', () => {
  const findManyAsignaciones = jest.fn();
  const prisma = {
    jefeCarreraAsignacion: { findMany: findManyAsignaciones },
  } as unknown as PrismaService;
  const service = new JefesCarreraService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rechaza la consulta cuando el jefe no tiene carreras asignadas', async () => {
    findManyAsignaciones.mockResolvedValue([]);

    await expect(service.obtenerPanel(12)).rejects.toThrow(ForbiddenException);
    await expect(service.obtenerPanel(12)).rejects.toThrow(
      'No tienes carreras asignadas',
    );
  });

  it('rechaza una carrera fuera del alcance asignado', async () => {
    findManyAsignaciones.mockResolvedValue([{ carreraId: 3 }]);

    await expect(service.obtenerPanel(12, 8)).rejects.toThrow(
      'Carrera fuera de tu alcance',
    );
  });
});
