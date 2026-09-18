import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { contarSabados, PeriodosService } from './periodos.service';

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
  const grupoFindMany = jest.fn();
  const usuarioFindUnique = jest.fn();
  const prisma = {
    periodoAcademico: { findUnique, upsert },
    horarioMateria: { findMany: horarioFindMany },
    grupo: { findMany: grupoFindMany },
    usuario: { findUnique: usuarioFindUnique },
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
  type PorModalidad = { where: { clave_modalidad: { modalidad: string } } };
  const REFERENCIA = new Date(2026, 8, 9);
  const ADMIN = { id: 7, rol: 'ADMIN' as const };
  const DOCENTE = { id: 9, rol: 'DOCENTE' as const };

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
    horarioFindMany.mockResolvedValue([
      {
        dias: 'Jueves,Viernes',
        grupo: { periodo: '2026-A', modalidad: 'ESCOLARIZADO' },
      },
    ]);
    grupoFindMany.mockResolvedValue([]);
    usuarioFindUnique.mockResolvedValue(null);
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
      ADMIN,
      { fechaInicio: '2026-08-29', fechaFin: '2026-12-18' },
      REFERENCIA,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clave_modalidad: { clave: '2026-B', modalidad: 'ESCOLARIZADO' },
        },
        create: expect.objectContaining({
          clave: '2026-B',
          modalidad: 'ESCOLARIZADO',
          // Medianoche local, sin el corrimiento de interpretar la clave como UTC.
          fechaInicio: new Date(2026, 7, 29),
          fechaFin: new Date(2026, 11, 18),
          actualizadoPorId: 7,
        }),
      }),
    );
  });

  it('el calendario mixto se guarda aparte del escolarizado', async () => {
    // Del sábado 5 de septiembre al sábado 19 de diciembre: 16 sábados justos.
    await service.actualizarActual(
      ADMIN,
      {
        modalidad: 'MIXTO',
        fechaInicio: '2026-09-05',
        fechaFin: '2026-12-19',
      },
      REFERENCIA,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clave_modalidad: { clave: '2026-B', modalidad: 'MIXTO' } },
        create: expect.objectContaining({
          modalidad: 'MIXTO',
          fechaInicio: new Date(2026, 8, 5),
          fechaFin: new Date(2026, 11, 19),
        }),
      }),
    );
  });

  it('el semestre mixto debe iniciar en sábado', async () => {
    await expect(
      service.actualizarActual(
        ADMIN,
        {
          modalidad: 'MIXTO',
          fechaInicio: '2026-09-07',
          fechaFin: '2026-12-19',
        },
        REFERENCIA,
      ),
    ).rejects.toThrow('inicia en sábado');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rechaza un semestre mixto con menos de 16 sábados', async () => {
    await expect(
      service.actualizarActual(
        ADMIN,
        {
          modalidad: 'MIXTO',
          fechaInicio: '2026-09-05',
          fechaFin: '2026-12-12',
        },
        REFERENCIA,
      ),
    ).rejects.toThrow('sólo tiene 15 sábados');
    expect(upsert).not.toHaveBeenCalled();

    // Con más de 16 (reposiciones por festivos) sí pasa.
    await service.actualizarActual(
      ADMIN,
      {
        modalidad: 'MIXTO',
        fechaInicio: '2026-09-05',
        fechaFin: '2026-12-26',
      },
      REFERENCIA,
    );
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('el escolarizado no está sujeto a la regla de los sábados', async () => {
    await service.actualizarActual(
      ADMIN,
      { fechaInicio: '2026-08-31', fechaFin: '2026-10-02' },
      REFERENCIA,
    );
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('un docente sin grupos mixtos no puede fijar ese calendario', async () => {
    await expect(
      service.actualizarActual(
        DOCENTE,
        {
          modalidad: 'MIXTO',
          fechaInicio: '2026-09-05',
          fechaFin: '2026-12-12',
        },
        REFERENCIA,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('un docente con grupo mixto sí fija ese calendario', async () => {
    horarioFindMany.mockResolvedValue([
      { dias: 'Sábado', grupo: { modalidad: 'MIXTO' } },
    ]);

    await service.actualizarActual(
      DOCENTE,
      {
        modalidad: 'MIXTO',
        fechaInicio: '2026-09-05',
        fechaFin: '2026-12-19',
      },
      REFERENCIA,
    );

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  describe('sábados del semestre mixto', () => {
    const mixto = { fechaInicio: '2026-09-05', fechaFin: '2026-12-19' };

    it('cuenta los 16 sábados y por cuál va', () => {
      // Sábado 3 de octubre: es el quinto sábado del semestre.
      const resumen = contarSabados(mixto, [], new Date(2026, 9, 3));
      expect(resumen).toMatchObject({
        requeridos: 16,
        total: 16,
        conClase: 16,
        transcurridos: 5,
        sinClases: [],
        finSugerido: null,
      });
    });

    it('un festivo en sábado descuenta y propone extender el fin', () => {
      const festivo = {
        fecha: '2026-11-21',
        motivo: 'Revolución',
        institucional: true,
      };
      const resumen = contarSabados(
        mixto,
        [
          festivo,
          { fecha: '2026-11-20', motivo: 'Viernes', institucional: false },
        ],
        new Date(2026, 8, 9),
      );
      expect(resumen).toMatchObject({
        total: 16,
        conClase: 15,
        transcurridos: 1,
        sinClases: [festivo],
        finSugerido: '2026-12-26',
      });
    });

    it('al sugerir el fin salta los sábados que también están suspendidos', () => {
      const resumen = contarSabados(mixto, [
        { fecha: '2026-11-21', motivo: 'Festivo', institucional: true },
        { fecha: '2026-12-26', motivo: 'Vacaciones', institucional: true },
      ]);
      expect(resumen.finSugerido).toBe('2027-01-02');
    });

    it('sólo se calcula con fechas reales y con las suspensiones de quien consulta', async () => {
      const sinFechas = await service.obtenerActualesPara(ADMIN, REFERENCIA);
      expect(sinFechas.mixto.sabados).toBeNull();

      findUnique.mockImplementation((args: PorModalidad) =>
        Promise.resolve(
          args.where.clave_modalidad.modalidad === 'MIXTO'
            ? {
                fechaInicio: new Date(2026, 8, 5),
                fechaFin: new Date(2026, 11, 19),
                updatedAt: new Date(),
              }
            : null,
        ),
      );
      institucionalFindMany.mockResolvedValue([
        { id: 1, fecha: '2026-11-21', motivo: 'Revolución' },
      ]);
      suspensionFindMany.mockResolvedValue([
        { id: 4, fecha: '2026-10-10', motivo: 'Congreso' },
      ]);

      const admin = await service.obtenerActualesPara(ADMIN, REFERENCIA);
      expect(admin.mixto.sabados?.sinClases.map((s) => s.fecha)).toEqual([
        '2026-11-21',
      ]);

      horarioFindMany.mockResolvedValue([
        { dias: 'Sábado', grupo: { modalidad: 'MIXTO' } },
      ]);
      const docente = await service.obtenerActualesPara(DOCENTE, REFERENCIA);
      expect(docente.mixto.sabados?.sinClases.map((s) => s.fecha)).toEqual([
        '2026-10-10',
        '2026-11-21',
      ]);
      expect(docente.mixto.sabados?.conClase).toBe(14);
    });
  });

  it('rechaza un fin anterior o igual al inicio', async () => {
    await expect(
      service.actualizarActual(
        ADMIN,
        { fechaInicio: '2026-12-18', fechaFin: '2026-08-29' },
        REFERENCIA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rechaza un periodo demasiado corto o demasiado largo', async () => {
    await expect(
      service.actualizarActual(
        ADMIN,
        { fechaInicio: '2026-08-29', fechaFin: '2026-09-05' },
        REFERENCIA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.actualizarActual(
        ADMIN,
        { fechaInicio: '2026-01-01', fechaFin: '2027-06-30' },
        REFERENCIA,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('al admin le aplican los dos calendarios; al docente sólo los de sus grupos', async () => {
    const admin = await service.obtenerActualesPara(ADMIN, REFERENCIA);
    expect(admin.escolarizado.aplica).toBe(true);
    expect(admin.mixto.aplica).toBe(true);

    const escolarizado = await service.obtenerActualesPara(DOCENTE, REFERENCIA);
    expect(escolarizado.escolarizado.aplica).toBe(true);
    expect(escolarizado.mixto.aplica).toBe(false);

    // Grupo agregado a mano, sin horario todavía.
    horarioFindMany.mockResolvedValue([]);
    grupoFindMany.mockResolvedValue([{ modalidad: 'MIXTO' }]);
    const mixto = await service.obtenerActualesPara(DOCENTE, REFERENCIA);
    expect(mixto.escolarizado.aplica).toBe(false);
    expect(mixto.mixto.aplica).toBe(true);
  });

  it('sin grupos el docente ve el calendario escolarizado', async () => {
    horarioFindMany.mockResolvedValue([]);
    const periodos = await service.obtenerActualesPara(DOCENTE, REFERENCIA);
    expect(periodos.escolarizado.aplica).toBe(true);
    expect(periodos.mixto.aplica).toBe(false);
  });

  it('el rango del admin abarca las modalidades capturadas y omite la estimada', async () => {
    findUnique.mockImplementation((args: PorModalidad) =>
      Promise.resolve(
        args.where.clave_modalidad.modalidad === 'ESCOLARIZADO'
          ? {
              fechaInicio: new Date(2026, 7, 31),
              fechaFin: new Date(2026, 11, 18),
              updatedAt: new Date(),
            }
          : null,
      ),
    );
    const periodos = await service.obtenerActualesPara(ADMIN, REFERENCIA);
    expect(periodos.rango).toEqual({
      fechaInicio: '2026-08-31',
      fechaFin: '2026-12-18',
    });

    findUnique.mockImplementation((args: PorModalidad) =>
      Promise.resolve(
        args.where.clave_modalidad.modalidad === 'ESCOLARIZADO'
          ? {
              fechaInicio: new Date(2026, 7, 31),
              fechaFin: new Date(2026, 11, 18),
              updatedAt: new Date(),
            }
          : {
              fechaInicio: new Date(2026, 8, 5),
              fechaFin: new Date(2027, 0, 9),
              updatedAt: new Date(),
            },
      ),
    );
    const ambos = await service.obtenerActualesPara(ADMIN, REFERENCIA);
    expect(ambos.rango).toEqual({
      fechaInicio: '2026-08-31',
      fechaFin: '2027-01-09',
    });
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

  it('el docente mixto marca un sábado que cae fuera del calendario escolarizado', async () => {
    findUnique.mockImplementation((args: PorModalidad) =>
      Promise.resolve(
        args.where.clave_modalidad.modalidad === 'ESCOLARIZADO'
          ? {
              fechaInicio: new Date(2026, 7, 31),
              fechaFin: new Date(2026, 11, 4),
              updatedAt: new Date(),
            }
          : {
              fechaInicio: new Date(2026, 8, 5),
              fechaFin: new Date(2026, 11, 19),
              updatedAt: new Date(),
            },
      ),
    );
    horarioFindMany.mockResolvedValue([
      { dias: 'Sábado', grupo: { modalidad: 'MIXTO' } },
    ]);
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17));
    try {
      await service.guardarSuspensiones(9, {
        fechas: ['2026-12-12'],
        motivo: 'Posada',
      });
      expect(suspensionUpsert).toHaveBeenCalledTimes(1);
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
