import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from './periodos.service';

describe('PeriodosService', () => {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const horarioFindMany = jest.fn();
  const claseFindMany = jest.fn();
  const suspensionUpsert = jest.fn();
  const suspensionFindMany = jest.fn();
  const suspensionFindUnique = jest.fn();
  const institucionalUpsert = jest.fn();
  const institucionalFindMany = jest.fn();
  const institucionalFindUnique = jest.fn();
  const prisma = {
    periodoAcademico: { findUnique, upsert },
    horarioMateria: { findMany: horarioFindMany },
    claseSesion: { findMany: claseFindMany },
    suspensionClase: {
      upsert: suspensionUpsert,
      findMany: suspensionFindMany,
      findUnique: suspensionFindUnique,
    },
    suspensionInstitucional: {
      upsert: institucionalUpsert,
      findMany: institucionalFindMany,
      findUnique: institucionalFindUnique,
    },
    $transaction: jest.fn((operations) => Promise.all(operations)),
  } as unknown as PrismaService;
  const service = new PeriodosService(prisma);
  const REFERENCIA = new Date(2026, 8, 9);

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
    horarioFindMany.mockResolvedValue([
      { dias: 'Jueves,Viernes', grupo: { periodo: '2026-A' } },
    ]);
    claseFindMany.mockResolvedValue([]);
    suspensionUpsert.mockResolvedValue({});
    suspensionFindMany.mockResolvedValue([]);
    suspensionFindUnique.mockResolvedValue(null);
    institucionalUpsert.mockResolvedValue({});
    institucionalFindMany.mockResolvedValue([]);
    institucionalFindUnique.mockResolvedValue(null);
  });

  const periodoGuardado = () =>
    findUnique.mockResolvedValue({
      fechaInicio: new Date(2026, 7, 31),
      fechaFin: new Date(2026, 11, 18),
      updatedAt: new Date(),
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

  it('registra varios días programados con un motivo, sin crear listas', async () => {
    findUnique.mockResolvedValue({
      fechaInicio: new Date(2026, 7, 31),
      fechaFin: new Date(2026, 11, 18),
      updatedAt: new Date(),
    });
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17));
    try {
      await service.guardarSuspensiones(9, {
        fechas: ['2026-09-17', '2026-09-18'],
        motivo: ' Día festivo ',
      });
      expect(suspensionUpsert).toHaveBeenCalledTimes(2);
      expect(suspensionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            docenteId: 9,
            periodoClave: '2026-B',
            fecha: '2026-09-17',
            motivo: 'Día festivo',
          }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('rechaza suspender una fecha con asistencias capturadas', async () => {
    findUnique.mockResolvedValue({
      fechaInicio: new Date(2026, 7, 31),
      fechaFin: new Date(2026, 11, 18),
      updatedAt: new Date(),
    });
    claseFindMany.mockResolvedValue([
      {
        fecha: new Date(2026, 8, 17, 8),
        activa: false,
        _count: { asistencias: 1 },
      },
    ]);
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17));
    try {
      await expect(
        service.guardarSuspensiones(9, {
          fechas: ['2026-09-17'],
          motivo: 'Suspensión institucional',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(suspensionUpsert).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('no deja al docente marcar un día que la institución ya suspendió', async () => {
    periodoGuardado();
    institucionalFindMany.mockResolvedValue([{ fecha: '2026-09-16' }]);
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    try {
      await expect(
        service.guardarSuspensiones(9, {
          fechas: ['2026-09-16'],
          motivo: 'Independencia',
        }),
      ).rejects.toThrow('toda la institución');
      expect(suspensionUpsert).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('el admin marca un festivo para todos sin necesitar horario propio', async () => {
    periodoGuardado();
    horarioFindMany.mockResolvedValue([]);
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    try {
      await service.guardarSuspensionesInstitucionales(1, {
        fechas: ['2026-09-16'],
        motivo: 'Independencia',
      });
      expect(institucionalUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fecha: '2026-09-16' },
          create: expect.objectContaining({
            periodoClave: '2026-B',
            fecha: '2026-09-16',
            motivo: 'Independencia',
            creadoPorId: 1,
          }),
        }),
      );
      // La revisión de listas capturadas abarca a todos los docentes.
      expect(claseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ docenteId: expect.anything() }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('el festivo institucional bloquea aunque otro docente ya haya pasado lista', async () => {
    periodoGuardado();
    claseFindMany.mockResolvedValue([
      {
        fecha: new Date(2026, 8, 16, 8),
        activa: false,
        _count: { asistencias: 3 },
      },
    ]);
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    try {
      await expect(
        service.guardarSuspensionesInstitucionales(1, {
          fechas: ['2026-09-16'],
          motivo: 'Independencia',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(institucionalUpsert).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('en el calendario del docente el institucional manda sobre el propio', async () => {
    periodoGuardado();
    suspensionFindMany.mockResolvedValue([
      { id: 4, fecha: '2026-09-16', motivo: 'Mi motivo' },
      { id: 5, fecha: '2026-10-02', motivo: 'Congreso' },
    ]);
    institucionalFindMany.mockResolvedValue([
      { id: 1, fecha: '2026-09-16', motivo: 'Independencia' },
    ]);

    const lista = await service.listarSuspensiones(9, new Date(2026, 8, 15));
    expect(lista).toEqual([
      {
        id: 1,
        fecha: '2026-09-16',
        motivo: 'Independencia',
        institucional: true,
      },
      { id: 5, fecha: '2026-10-02', motivo: 'Congreso', institucional: false },
    ]);
  });

  it('un festivo institucional deja sin clases a todos los docentes del día', async () => {
    institucionalFindUnique.mockResolvedValue({
      id: 1,
      fecha: '2026-09-16',
      motivo: 'Independencia',
    });

    const mapa = await service.suspensionesDelDia(
      new Date(2026, 8, 16),
      [9, 12],
    );
    expect([...mapa.keys()]).toEqual([9, 12]);
    expect(mapa.get(12)).toEqual(
      expect.objectContaining({ institucional: true }),
    );
    expect(suspensionFindMany).not.toHaveBeenCalled();
  });

  it('sin festivo institucional sólo quedan sin clases quienes lo marcaron', async () => {
    suspensionFindMany.mockResolvedValue([
      { id: 4, docenteId: 9, fecha: '2026-09-16', motivo: 'Congreso' },
    ]);

    const mapa = await service.suspensionesDelDia(
      new Date(2026, 8, 16),
      [9, 12],
    );
    expect([...mapa.keys()]).toEqual([9]);
    expect(mapa.get(9)).toEqual(
      expect.objectContaining({ institucional: false, motivo: 'Congreso' }),
    );
  });

  it('expande la institucional a cada docente al listar por rango', async () => {
    suspensionFindMany.mockResolvedValue([
      { id: 4, docenteId: 9, fecha: '2026-09-16', motivo: 'Mi motivo' },
    ]);
    institucionalFindMany.mockResolvedValue([
      { id: 1, fecha: '2026-09-16', motivo: 'Independencia' },
    ]);

    const lista = await service.listarSuspensionesDeDocentes([9, 12], {
      gte: '2026-09-01',
      lte: '2026-09-30',
    });
    expect(lista).toHaveLength(2);
    expect(
      lista.every(
        (item) => item.institucional && item.motivo === 'Independencia',
      ),
    ).toBe(true);
    expect(lista.map((item) => item.docenteId).sort((a, b) => a - b)).toEqual([
      9, 12,
    ]);
  });
});
