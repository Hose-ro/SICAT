import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ClasesService } from './clases.service';

describe('ClasesService.obtenerHistorial (IDOR)', () => {
  const claseSesionFindMany = jest.fn();
  const prisma = {
    claseSesion: { findMany: claseSesionFindMany },
  } as unknown as PrismaService;
  const notificaciones = {} as unknown as NotificacionesService;
  const service = new ClasesService(prisma, notificaciones);

  const materiaId = 12;
  const docenteId = 31;

  beforeEach(() => {
    jest.clearAllMocks();
    claseSesionFindMany.mockResolvedValue([]);
  });

  it('filtra el historial por el docente autenticado, no sólo por materia', async () => {
    await service.obtenerHistorial(materiaId, docenteId);

    expect(claseSesionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { materiaId, docenteId },
      }),
    );
  });

  it('no devuelve sesiones de otro docente que imparte la misma materia', async () => {
    await service.obtenerHistorial(materiaId, docenteId);

    const llamada = (
      claseSesionFindMany.mock.calls as Array<
        [{ where: Record<string, unknown> }]
      >
    )[0][0];
    expect(llamada.where.docenteId).toBe(docenteId);
    expect(llamada.where.docenteId).not.toBe(99);
  });
});
