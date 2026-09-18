import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ClasesService } from './clases.service';
import { PeriodosService } from '../periodos/periodos.service';

const periodosFalsos = (inicio: Date, fin: Date) =>
  ({
    obtenerRangoActual: jest.fn().mockResolvedValue({
      clave: '2026-B',
      configurado: true,
      inicio,
      fin,
    }),
    obtenerSuspension: jest.fn().mockResolvedValue(null),
    listarSuspensiones: jest.fn().mockResolvedValue([]),
  }) as unknown as PeriodosService;

describe('ClasesService asistencias atrasadas', () => {
  const horarioFindMany = jest.fn();
  const horarioFindUnique = jest.fn();
  const claseSesionFindMany = jest.fn();
  const claseSesionFindFirst = jest.fn();
  const claseSesionCreate = jest.fn();
  const inscripcionFindMany = jest.fn();
  const asistenciaCreateMany = jest.fn();
  const asistenciaUpdateMany = jest.fn();
  const prisma = {
    horarioMateria: {
      findMany: horarioFindMany,
      findUnique: horarioFindUnique,
    },
    claseSesion: {
      findMany: claseSesionFindMany,
      findFirst: claseSesionFindFirst,
      create: claseSesionCreate,
    },
    inscripcion: { findMany: inscripcionFindMany },
    asistencia: {
      createMany: asistenciaCreateMany,
      updateMany: asistenciaUpdateMany,
    },
  } as unknown as PrismaService;
  const crearParaAdmins = jest.fn();
  const notificaciones = {
    crearParaAdmins,
  } as unknown as NotificacionesService;
  const service = new ClasesService(
    prisma,
    notificaciones,
    periodosFalsos(new Date(2026, 7, 29), new Date(2026, 11, 18)),
  );

  // Martes 8 de septiembre de 2026, 15:00. La clase de martes 12:00-14:00 ya
  // terminó; la de martes 16:00-18:00 todavía no.
  const AHORA = new Date(2026, 8, 8, 15, 0);

  const unidadActiva = {
    id: 5,
    nombre: 'Unidad 1',
    orden: 1,
    status: 'ACTIVA',
    fechaInicio: new Date(2026, 8, 1, 9, 0),
    fechaFin: null,
  };

  const horarioBase = {
    id: 3,
    materiaId: 12,
    docenteId: 9,
    grupoId: 4,
    aulaId: 2,
    activo: true,
    dias: 'lunes,martes',
    horaInicio: '12:00',
    horaFin: '14:00',
    materia: {
      id: 12,
      nombre: 'Programación Web',
      clave: 'SCC-1010',
      unidades: [unidadActiva],
    },
    grupo: { id: 4, nombre: 'ISC-3A', periodo: '2026-B', semestre: 3 },
    aula: { id: 2, nombre: 'A-101', edificio: 'A' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(AHORA);
    horarioFindMany.mockResolvedValue([horarioBase]);
    claseSesionFindMany.mockResolvedValue([]);
    claseSesionFindFirst.mockResolvedValue(null);
    inscripcionFindMany.mockResolvedValue([
      { alumnoId: 101 },
      { alumnoId: 102 },
    ]);
    asistenciaCreateMany.mockResolvedValue({ count: 2 });
    asistenciaUpdateMany.mockResolvedValue({ count: 2 });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('lista las clases del horario del periodo que no tienen sesión', async () => {
    const pendientes = await service.obtenerClasesAtrasadas(9);
    const fechas = pendientes.map((item) => item.fecha);

    // El periodo arranca el sábado 29 de agosto, así que el pendiente más
    // antiguo es el primer lunes posterior: nada de julio ni de agosto previo.
    expect(fechas.slice(0, 3)).toEqual([
      '2026-09-08',
      '2026-09-07',
      '2026-09-01',
    ]);
    expect(fechas[fechas.length - 1]).toBe('2026-08-31');
    expect(fechas.every((fecha) => fecha >= '2026-08-29')).toBe(true);
    expect(pendientes[0]).toMatchObject({
      horarioId: 3,
      materiaId: 12,
      grupoId: 4,
      horaInicio: '12:00',
      horaFin: '14:00',
      estado: 'SIN_SESION',
      sesion: null,
      unidad: unidadActiva,
    });
  });

  it('no exige lista atrasada de los días suspendidos', async () => {
    const fakePeriodos = periodosFalsos(
      new Date(2026, 7, 29),
      new Date(2026, 11, 18),
    );
    jest
      .spyOn(fakePeriodos, 'listarSuspensiones')
      .mockResolvedValue([
        {
          id: 1,
          fecha: '2026-09-07',
          motivo: 'Día festivo',
          institucional: false,
        },
      ]);
    const conSuspension = new ClasesService(
      prisma,
      notificaciones,
      fakePeriodos,
    );
    const pendientes = await conSuspension.obtenerClasesAtrasadas(9);
    expect(pendientes.map((item) => item.fecha)).not.toContain('2026-09-07');
    expect(pendientes.map((item) => item.fecha)).toContain('2026-09-08');
  });

  it('no ofrece clases anteriores al inicio del semestre', async () => {
    // Semestre que arranca el 7 de septiembre: el 1 de septiembre queda fuera.
    const acotado = new ClasesService(
      prisma,
      notificaciones,
      periodosFalsos(new Date(2026, 8, 7), new Date(2026, 11, 18)),
    );

    const fechas = (await acotado.obtenerClasesAtrasadas(9)).map(
      (item) => item.fecha,
    );

    expect(fechas).toEqual(['2026-09-08', '2026-09-07']);
    expect(fechas).not.toContain('2026-09-01');
  });

  it('no ofrece clases posteriores al fin del semestre', async () => {
    const cerrado = new ClasesService(
      prisma,
      notificaciones,
      periodosFalsos(new Date(2026, 7, 29), new Date(2026, 8, 2)),
    );

    const fechas = (await cerrado.obtenerClasesAtrasadas(9)).map(
      (item) => item.fecha,
    );

    expect(fechas).toEqual(['2026-09-01', '2026-08-31']);
    expect(fechas).not.toContain('2026-09-07');
  });

  it('rechaza registrar una clase anterior al inicio del semestre', async () => {
    horarioFindUnique.mockResolvedValue(horarioBase);
    const acotado = new ClasesService(
      prisma,
      notificaciones,
      periodosFalsos(new Date(2026, 8, 7), new Date(2026, 11, 18)),
    );

    await expect(
      acotado.registrarClaseAtrasada(9, { horarioId: 3, fecha: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(claseSesionCreate).not.toHaveBeenCalled();
  });

  it('omite la clase de hoy mientras no termine', async () => {
    horarioFindMany.mockResolvedValue([
      { ...horarioBase, horaInicio: '16:00', horaFin: '18:00' },
    ]);

    const pendientes = await service.obtenerClasesAtrasadas(9);

    expect(pendientes.map((item) => item.fecha).slice(0, 2)).toEqual([
      '2026-09-07',
      '2026-09-01',
    ]);
    expect(pendientes.map((item) => item.fecha)).not.toContain('2026-09-08');
  });

  it('lista la clase sin unidad cuando el docente no ha iniciado ninguna', async () => {
    horarioFindMany.mockResolvedValue([
      {
        ...horarioBase,
        materia: {
          ...horarioBase.materia,
          unidades: [
            {
              ...unidadActiva,
              status: 'PENDIENTE',
              fechaInicio: null,
            },
          ],
        },
      },
    ]);

    const pendientes = await service.obtenerClasesAtrasadas(9);

    expect(pendientes[0]).toMatchObject({
      fecha: '2026-09-08',
      estado: 'SIN_SESION',
      unidad: null,
    });
  });

  it('descarta las fechas que ya tienen lista y marca las sesiones sin captura', async () => {
    claseSesionFindMany.mockResolvedValue([
      {
        id: 71,
        materiaId: 12,
        grupoId: 4,
        fecha: new Date(2026, 8, 7, 12, 0),
        activa: false,
        registroAtrasado: false,
        _count: { asistencias: 25 },
      },
      {
        id: 72,
        materiaId: 12,
        grupoId: 4,
        fecha: new Date(2026, 8, 1, 12, 0),
        activa: true,
        registroAtrasado: false,
        _count: { asistencias: 0 },
      },
    ]);

    const pendientes = await service.obtenerClasesAtrasadas(9);

    expect(
      pendientes.map((item) => [item.fecha, item.estado]).slice(0, 2),
    ).toEqual([
      ['2026-09-08', 'SIN_SESION'],
      ['2026-09-01', 'SIN_CAPTURA'],
    ]);
    // La del 7 sí tiene lista guardada, así que deja de ser pendiente.
    expect(pendientes.map((item) => item.fecha)).not.toContain('2026-09-07');
    expect(pendientes[1].sesion).toMatchObject({ id: 72 });
  });

  it('registra la clase atrasada cerrada, con el horario y la unidad de esa fecha', async () => {
    horarioFindUnique.mockResolvedValue(horarioBase);
    claseSesionCreate.mockResolvedValue({ id: 90 });

    await service.registrarClaseAtrasada(9, {
      horarioId: 3,
      fecha: '2026-09-07',
    });

    const [argumento] = claseSesionCreate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(argumento.data).toMatchObject({
      materiaId: 12,
      grupoId: 4,
      horarioMateriaId: 3,
      unidadId: 5,
      unidad: 1,
      activa: false,
      registroAtrasado: true,
      fueFueraDeHorario: false,
      notificacionEnviada: false,
      semanaClave: '2026-09-07',
      fecha: new Date(2026, 8, 7, 12, 0),
      horaInicio: new Date(2026, 8, 7, 12, 0),
      horaFin: new Date(2026, 8, 7, 14, 0),
    });
  });

  it('rechaza una fecha que no está en el horario del docente', async () => {
    horarioFindUnique.mockResolvedValue(horarioBase);

    await expect(
      service.registrarClaseAtrasada(9, { horarioId: 3, fecha: '2026-09-02' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(claseSesionCreate).not.toHaveBeenCalled();
  });

  it('rechaza una clase que todavía no ocurre', async () => {
    horarioFindUnique.mockResolvedValue(horarioBase);

    await expect(
      service.registrarClaseAtrasada(9, { horarioId: 3, fecha: '2026-09-14' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usa la unidad activa cuando la fecha es anterior a que se iniciara', async () => {
    horarioFindUnique.mockResolvedValue({
      ...horarioBase,
      materia: {
        ...horarioBase.materia,
        unidades: [
          { ...unidadActiva, fechaInicio: new Date(2026, 8, 8, 9, 0) },
        ],
      },
    });
    claseSesionCreate.mockResolvedValue({ id: 91 });

    await service.registrarClaseAtrasada(9, {
      horarioId: 3,
      fecha: '2026-09-01',
    });

    const [argumento] = claseSesionCreate.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(argumento.data).toMatchObject({ unidadId: 5, unidad: 1 });
  });

  it('rechaza la captura cuando la materia no tiene ninguna unidad iniciada', async () => {
    horarioFindUnique.mockResolvedValue({
      ...horarioBase,
      materia: {
        ...horarioBase.materia,
        unidades: [{ ...unidadActiva, status: 'PENDIENTE', fechaInicio: null }],
      },
    });

    await expect(
      service.registrarClaseAtrasada(9, { horarioId: 3, fecha: '2026-09-01' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(claseSesionCreate).not.toHaveBeenCalled();
  });

  it('rechaza una fecha anterior al periodo en curso', async () => {
    horarioFindUnique.mockResolvedValue(horarioBase);

    await expect(
      service.registrarClaseAtrasada(9, { horarioId: 3, fecha: '2026-06-29' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(claseSesionCreate).not.toHaveBeenCalled();
  });
});

describe('ClasesService marcado masivo de clases atrasadas', () => {
  const horarioFindUnique = jest.fn();
  const claseSesionFindFirst = jest.fn();
  const claseSesionCreate = jest.fn();
  const inscripcionFindMany = jest.fn();
  const asistenciaCreateMany = jest.fn();
  const asistenciaUpdateMany = jest.fn();
  const crearParaAdmins = jest.fn();
  const prisma = {
    horarioMateria: { findUnique: horarioFindUnique },
    claseSesion: {
      findFirst: claseSesionFindFirst,
      create: claseSesionCreate,
    },
    inscripcion: { findMany: inscripcionFindMany },
    asistencia: {
      createMany: asistenciaCreateMany,
      updateMany: asistenciaUpdateMany,
    },
  } as unknown as PrismaService;
  const service = new ClasesService(
    prisma,
    { crearParaAdmins } as unknown as NotificacionesService,
    periodosFalsos(new Date(2026, 7, 29), new Date(2026, 11, 18)),
  );

  const AHORA = new Date(2026, 8, 8, 15, 0);
  const horario = {
    id: 3,
    materiaId: 12,
    docenteId: 9,
    grupoId: 4,
    activo: true,
    dias: 'lunes,martes',
    horaInicio: '12:00',
    horaFin: '14:00',
    materia: {
      id: 12,
      nombre: 'Programación Web',
      unidades: [
        {
          id: 5,
          nombre: 'Unidad 1',
          orden: 1,
          status: 'ACTIVA',
          fechaInicio: new Date(2026, 8, 1),
          fechaFin: null,
        },
      ],
    },
    grupo: { id: 4, nombre: 'ISC-3A' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(AHORA);
    horarioFindUnique.mockResolvedValue(horario);
    claseSesionFindFirst.mockResolvedValue(null);
    claseSesionCreate.mockImplementation(() =>
      Promise.resolve({ id: 90 + claseSesionCreate.mock.calls.length }),
    );
    inscripcionFindMany.mockResolvedValue([
      { alumnoId: 101 },
      { alumnoId: 102 },
      { alumnoId: 103 },
    ]);
    asistenciaCreateMany.mockResolvedValue({ count: 3 });
    asistenciaUpdateMany.mockResolvedValue({ count: 3 });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('abre la sesión y marca asistencia a todo el grupo en cada clase', async () => {
    const resultado = await service.marcarAsistenciaClasesAtrasadas(9, {
      clases: [
        { horarioId: 3, fecha: '2026-09-01' },
        { horarioId: 3, fecha: '2026-09-07' },
      ],
    });

    expect(resultado.procesadas).toHaveLength(2);
    expect(resultado.omitidas).toHaveLength(0);
    expect(resultado.alumnosMarcados).toBe(6);
    expect(resultado.estado).toBe('ASISTENCIA');
    expect(claseSesionCreate).toHaveBeenCalledTimes(2);
    expect(asistenciaCreateMany.mock.calls[0][0].data).toEqual([
      {
        claseSesionId: 91,
        alumnoId: 101,
        estado: 'ASISTENCIA',
        editadaPorId: 9,
      },
      {
        claseSesionId: 91,
        alumnoId: 102,
        estado: 'ASISTENCIA',
        editadaPorId: 9,
      },
      {
        claseSesionId: 91,
        alumnoId: 103,
        estado: 'ASISTENCIA',
        editadaPorId: 9,
      },
    ]);
    // Un solo aviso por lote, no uno por clase.
    expect(crearParaAdmins).toHaveBeenCalledTimes(1);
  });

  it('reutiliza la sesión que ya existe en vez de duplicarla', async () => {
    claseSesionFindFirst.mockResolvedValue({ id: 71 });

    const resultado = await service.marcarAsistenciaClasesAtrasadas(9, {
      clases: [{ horarioId: 3, fecha: '2026-09-01' }],
    });

    expect(claseSesionCreate).not.toHaveBeenCalled();
    expect(resultado.procesadas[0]).toMatchObject({
      sesionId: 71,
      sesionNueva: false,
      alumnos: 3,
    });
  });

  it('omite la clase inválida y procesa el resto del lote', async () => {
    const resultado = await service.marcarAsistenciaClasesAtrasadas(9, {
      clases: [
        { horarioId: 3, fecha: '2026-09-02' }, // miércoles: no está en el horario
        { horarioId: 3, fecha: '2026-09-01' },
      ],
    });

    expect(resultado.procesadas).toHaveLength(1);
    expect(resultado.omitidas).toHaveLength(1);
    expect(resultado.omitidas[0]).toMatchObject({ fecha: '2026-09-02' });
    expect(resultado.omitidas[0].motivo).toContain('horario');
  });

  it('omite el grupo sin alumnos inscritos sin abrir sesión', async () => {
    inscripcionFindMany.mockResolvedValue([]);

    const resultado = await service.marcarAsistenciaClasesAtrasadas(9, {
      clases: [{ horarioId: 3, fecha: '2026-09-01' }],
    });

    expect(claseSesionCreate).not.toHaveBeenCalled();
    expect(resultado.procesadas).toHaveLength(0);
    expect(resultado.omitidas[0].motivo).toContain('alumnos');
  });

  it('respeta el estado pedido cuando no es asistencia', async () => {
    const resultado = await service.marcarAsistenciaClasesAtrasadas(9, {
      clases: [{ horarioId: 3, fecha: '2026-09-01' }],
      estado: 'FALTA' as never,
    });

    expect(resultado.estado).toBe('FALTA');
    expect(asistenciaUpdateMany.mock.calls[0][0].data).toMatchObject({
      estado: 'FALTA',
    });
  });

  it('no avisa a administración cuando no se procesó nada', async () => {
    const resultado = await service.marcarAsistenciaClasesAtrasadas(9, {
      clases: [{ horarioId: 3, fecha: '2026-09-02' }],
    });

    expect(resultado.procesadas).toHaveLength(0);
    expect(crearParaAdmins).not.toHaveBeenCalled();
  });
});

describe('ClasesService.obtenerHistorial (IDOR)', () => {
  const claseSesionFindMany = jest.fn();
  const prisma = {
    claseSesion: { findMany: claseSesionFindMany },
  } as unknown as PrismaService;
  const notificaciones = {} as unknown as NotificacionesService;
  const service = new ClasesService(
    prisma,
    notificaciones,
    periodosFalsos(new Date(2026, 7, 29), new Date(2026, 11, 18)),
  );

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
