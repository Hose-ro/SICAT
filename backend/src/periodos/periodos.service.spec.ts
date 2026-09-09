import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from './periodos.service';

describe('PeriodosService', () => {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const prisma = {
    periodoAcademico: { findUnique, upsert },
  } as unknown as PrismaService;
  const service = new PeriodosService(prisma);
  const REFERENCIA = new Date(2026, 8, 9);

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
  });

  it('estima el periodo por calendario mientras nadie lo captura', async () => {
    const periodo = await service.obtenerActual(REFERENCIA);

    expect(periodo).toMatchObject({
      clave: '2026-B',
      fechaInicio: '2026-07-01',
      fechaFin: '2026-12-31',
      configurado: false,
    });
  });

  it('devuelve las fechas capturadas cuando existen', async () => {
    findUnique.mockResolvedValue({
      clave: '2026-B',
      fechaInicio: new Date(2026, 7, 29),
      fechaFin: new Date(2026, 11, 18),
      updatedAt: new Date(2026, 8, 9),
    });

    const periodo = await service.obtenerActual(REFERENCIA);

    expect(periodo).toMatchObject({
      fechaInicio: '2026-08-29',
      fechaFin: '2026-12-18',
      configurado: true,
    });
  });

  it('guarda las fechas del periodo en curso', async () => {
    await service.actualizarActual(
      7,
      { fechaInicio: '2026-08-29', fechaFin: '2026-12-18' },
      REFERENCIA,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clave: '2026-B' },
        create: expect.objectContaining({
          clave: '2026-B',
          // Medianoche local, sin el corrimiento de interpretar la clave como UTC.
          fechaInicio: new Date(2026, 7, 29),
          fechaFin: new Date(2026, 11, 18),
          actualizadoPorId: 7,
        }),
      }),
    );
  });

  it('rechaza un fin anterior o igual al inicio', async () => {
    await expect(
      service.actualizarActual(
        7,
        { fechaInicio: '2026-12-18', fechaFin: '2026-08-29' },
        REFERENCIA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rechaza un periodo demasiado corto o demasiado largo', async () => {
    await expect(
      service.actualizarActual(
        7,
        { fechaInicio: '2026-08-29', fechaFin: '2026-09-05' },
        REFERENCIA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.actualizarActual(
        7,
        { fechaInicio: '2026-01-01', fechaFin: '2027-06-30' },
        REFERENCIA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('expone el rango como fechas locales para acotar consultas', async () => {
    findUnique.mockResolvedValue({
      clave: '2026-B',
      fechaInicio: new Date(2026, 7, 29),
      fechaFin: new Date(2026, 11, 18),
      updatedAt: new Date(),
    });

    const rango = await service.obtenerRangoActual(REFERENCIA);

    expect(rango.inicio).toEqual(new Date(2026, 7, 29, 0, 0, 0, 0));
    expect(rango.fin).toEqual(new Date(2026, 11, 18, 23, 59, 59, 999));
  });
});
