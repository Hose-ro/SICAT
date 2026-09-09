import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AsistenciasService } from './asistencias.service';

describe('AsistenciasService filtros de historial', () => {
  const materiaFindMany = jest.fn();
  const materiaFindUnique = jest.fn();
  const grupoFindMany = jest.fn();
  const reticulaMateriaFindMany = jest.fn();
  const claseSesionFindMany = jest.fn();
  const prisma = {
    materia: {
      findMany: materiaFindMany,
      findUnique: materiaFindUnique,
    },
    grupo: { findMany: grupoFindMany },
    reticulaMateria: { findMany: reticulaMateriaFindMany },
    claseSesion: { findMany: claseSesionFindMany },
  } as unknown as PrismaService;
  const notificaciones = {} as unknown as NotificacionesService;
  const service = new AsistenciasService(prisma, notificaciones);

  const materia = {
    id: 12,
    nombre: 'Programación Web',
    clave: 'SCC-1010',
  };
  const gruposCandidatos = [
    {
      id: 4,
      nombre: 'ISC-3A',
      semestre: 3,
      carreraId: 1,
      periodo: '2026-B',
    },
    {
      id: 7,
      nombre: 'ISC-5A',
      semestre: 5,
      carreraId: 1,
      periodo: '2026-B',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindMany.mockResolvedValue([materia]);
    materiaFindUnique.mockResolvedValue({
      id: materia.id,
      clave: materia.clave,
      unidades: [{ id: 2, nombre: 'Unidad 1', orden: 1 }],
    });
    grupoFindMany.mockResolvedValue(gruposCandidatos);
    reticulaMateriaFindMany.mockResolvedValue([{ carreraId: 1, semestre: 3 }]);
    claseSesionFindMany.mockResolvedValue([
      { fecha: new Date(2026, 8, 2, 8, 0) },
      { fecha: new Date(2026, 8, 2, 9, 0) },
      { fecha: new Date(2026, 8, 4, 8, 0) },
    ]);
  });

  it('ofrece sólo grupos del semestre de retícula impartidos por el docente', async () => {
    const result = await service.obtenerFiltrosDisponibles(
      { id: 31, rol: 'DOCENTE' },
      { materiaId: materia.id },
    );

    expect(grupoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          activo: true,
          materias: { some: { id: materia.id } },
          horarios: {
            some: {
              materiaId: materia.id,
              activo: true,
              docenteId: 31,
            },
          },
        },
      }),
    );
    expect(reticulaMateriaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clave: materia.clave,
          activo: true,
        }) as Record<string, unknown>,
      }),
    );
    expect(result.grupos).toEqual([gruposCandidatos[0]]);
  });

  it('marca una sola vez cada día en que el docente impartió la materia', async () => {
    const result = await service.obtenerFiltrosDisponibles(
      { id: 31, rol: 'DOCENTE' },
      { materiaId: materia.id },
    );

    expect(claseSesionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { materiaId: materia.id, docenteId: 31 },
      }),
    );
    expect(result.fechasClase).toEqual(['2026-09-02', '2026-09-04']);
  });

  it('rechaza un grupo que no sea compatible con materia, retícula y docente', async () => {
    await expect(
      service.obtenerFiltrosDisponibles(
        { id: 31, rol: 'DOCENTE' },
        { materiaId: materia.id, grupoId: 7 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(claseSesionFindMany).not.toHaveBeenCalled();
  });
});

describe('AsistenciasService.obtenerAsistenciasAlumno (IDOR)', () => {
  const usuarioFindUnique = jest.fn();
  const materiaCount = jest.fn();
  const horarioMateriaCount = jest.fn();
  const claseSesionFindMany = jest.fn();
  const asistenciaFindMany = jest.fn();
  const prisma = {
    usuario: { findUnique: usuarioFindUnique },
    materia: { count: materiaCount },
    horarioMateria: { count: horarioMateriaCount },
    claseSesion: { findMany: claseSesionFindMany },
    asistencia: { findMany: asistenciaFindMany },
  } as unknown as PrismaService;
  const notificaciones = {} as unknown as NotificacionesService;
  const service = new AsistenciasService(prisma, notificaciones);

  const alumnoId = 50;
  const materiaId = 12;
  const docenteId = 31;

  beforeEach(() => {
    jest.clearAllMocks();
    usuarioFindUnique.mockResolvedValue({ grupoId: 4 });
    claseSesionFindMany.mockResolvedValue([]);
    asistenciaFindMany.mockResolvedValue([]);
  });

  it('rechaza a un DOCENTE que no imparte la materia del alumno', async () => {
    materiaCount.mockResolvedValue(0);
    horarioMateriaCount.mockResolvedValue(0);

    await expect(
      service.obtenerAsistenciasAlumno(alumnoId, materiaId, {
        id: docenteId,
        rol: 'DOCENTE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(claseSesionFindMany).not.toHaveBeenCalled();
    expect(asistenciaFindMany).not.toHaveBeenCalled();
  });

  it('permite a un DOCENTE que sí imparte la materia (asignación directa)', async () => {
    materiaCount.mockResolvedValue(1);
    horarioMateriaCount.mockResolvedValue(0);

    await expect(
      service.obtenerAsistenciasAlumno(alumnoId, materiaId, {
        id: docenteId,
        rol: 'DOCENTE',
      }),
    ).resolves.not.toThrow();

    expect(claseSesionFindMany).toHaveBeenCalled();
  });

  it('permite a un DOCENTE que imparte la materia sólo por horario activo', async () => {
    materiaCount.mockResolvedValue(0);
    horarioMateriaCount.mockResolvedValue(1);

    await expect(
      service.obtenerAsistenciasAlumno(alumnoId, materiaId, {
        id: docenteId,
        rol: 'DOCENTE',
      }),
    ).resolves.not.toThrow();

    expect(claseSesionFindMany).toHaveBeenCalled();
  });

  it('no restringe a un ADMIN aunque no imparta la materia', async () => {
    await expect(
      service.obtenerAsistenciasAlumno(alumnoId, materiaId, {
        id: 1,
        rol: 'ADMIN',
      }),
    ).resolves.not.toThrow();

    expect(materiaCount).not.toHaveBeenCalled();
    expect(claseSesionFindMany).toHaveBeenCalled();
  });

  it('no restringe la consulta de un ALUMNO sobre sus propias asistencias', async () => {
    await expect(
      service.obtenerAsistenciasAlumno(alumnoId, materiaId, {
        id: alumnoId,
        rol: 'ALUMNO',
      }),
    ).resolves.not.toThrow();

    expect(materiaCount).not.toHaveBeenCalled();
    expect(claseSesionFindMany).toHaveBeenCalled();
  });
});

describe('AsistenciasService rangos de día, semana y mes', () => {
  const claseSesionFindMany = jest.fn();
  const asistenciaFindMany = jest.fn();
  const prisma = {
    claseSesion: { findMany: claseSesionFindMany },
    asistencia: { findMany: asistenciaFindMany },
  } as unknown as PrismaService;
  const service = new AsistenciasService(
    prisma,
    {} as unknown as NotificacionesService,
  );
  const docente = { id: 9, rol: 'DOCENTE' } as never;

  const whereDeLaConsulta = () =>
    (claseSesionFindMany.mock.calls[0][0] as { where: Record<string, never> })
      .where;

  beforeEach(() => {
    jest.clearAllMocks();
    claseSesionFindMany.mockResolvedValue([]);
    asistenciaFindMany.mockResolvedValue([]);
  });

  it('acota el día en hora local, sin correrse al día anterior', async () => {
    await service.obtenerHistorial(docente, { fecha: '2026-09-08' });

    const { fecha } = whereDeLaConsulta() as unknown as {
      fecha: { gte: Date; lte: Date };
    };
    expect(fecha.gte).toEqual(new Date(2026, 8, 8, 0, 0, 0, 0));
    expect(fecha.lte).toEqual(new Date(2026, 8, 8, 23, 59, 59, 999));
  });

  it('resuelve la semana del lunes elegido, no la anterior', async () => {
    await service.obtenerHistorial(docente, { semana: '2026-09-07' });

    expect(whereDeLaConsulta()).toMatchObject({ semanaClave: '2026-09-07' });
  });

  it('acota el mes completo', async () => {
    await service.obtenerHistorial(docente, { mes: '2026-09' });

    const { fecha } = whereDeLaConsulta() as unknown as {
      fecha: { gte: Date; lte: Date };
    };
    expect(fecha.gte).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
    expect(fecha.lte).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
  });

  it('acota febrero de un año bisiesto hasta el día 29', async () => {
    await service.obtenerHistorial(docente, { mes: '2028-02' });

    const { fecha } = whereDeLaConsulta() as unknown as {
      fecha: { gte: Date; lte: Date };
    };
    expect(fecha.lte).toEqual(new Date(2028, 1, 29, 23, 59, 59, 999));
  });

  it('da prioridad al día sobre la semana y el mes', async () => {
    await service.obtenerHistorial(docente, {
      fecha: '2026-09-08',
      semana: '2026-09-07',
      mes: '2026-09',
    });

    expect(whereDeLaConsulta()).not.toHaveProperty('semanaClave');
    const { fecha } = whereDeLaConsulta() as unknown as {
      fecha: { gte: Date; lte: Date };
    };
    expect(fecha.gte).toEqual(new Date(2026, 8, 8, 0, 0, 0, 0));
  });

  it('rechaza un mes con formato inválido', async () => {
    await expect(
      service.obtenerHistorial(docente, { mes: '2026-13' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.obtenerHistorial(docente, { mes: 'septiembre' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sin filtros de fecha no acota el rango', async () => {
    await service.obtenerHistorial(docente, { materiaId: 12 });

    const where = whereDeLaConsulta();
    expect(where).not.toHaveProperty('fecha');
    expect(where).not.toHaveProperty('semanaClave');
  });
});
