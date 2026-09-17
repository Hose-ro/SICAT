import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstadoTarea } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TareasService } from './tareas.service';
import { getUploadAbsolutePath } from './tareas.storage';

describe('TareasService.obtenerArchivo (archivos privados)', () => {
  const tareaArchivoFindFirst = jest.fn();
  const entregaArchivoFindFirst = jest.fn();
  const inscripcionFindFirst = jest.fn();
  const materiaCount = jest.fn();
  const horarioMateriaCount = jest.fn();
  const prisma = {
    tareaArchivo: { findFirst: tareaArchivoFindFirst },
    entregaArchivo: { findFirst: entregaArchivoFindFirst },
    inscripcion: { findFirst: inscripcionFindFirst },
    materia: { count: materiaCount },
    horarioMateria: { count: horarioMateriaCount },
  } as unknown as PrismaService;
  const service = new TareasService(prisma, {} as NotificacionesService);

  const filename = '0f8fcd1e-3f6a-4c56-9b8e-1f2a3b4c5d6e.pdf';
  const docente = { id: 31, rol: 'DOCENTE' };
  const otroDocente = { id: 99, rol: 'DOCENTE' };
  const admin = { id: 1, rol: 'ADMIN' };
  const alumno = { id: 500, rol: 'ALUMNO' };
  const otroAlumno = { id: 501, rol: 'ALUMNO' };

  const tarea = {
    materiaId: 12,
    grupoId: 3,
    docenteId: docente.id,
    estado: EstadoTarea.PUBLICADA,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tareaArchivoFindFirst.mockResolvedValue(null);
    entregaArchivoFindFirst.mockResolvedValue(null);
    inscripcionFindFirst.mockResolvedValue(null);
    materiaCount.mockResolvedValue(0);
    horarioMateriaCount.mockResolvedValue(0);
  });

  it('rechaza nombres que no genera el almacenamiento sin consultar la BD', async () => {
    for (const name of ['../../.env', 'guia.pdf', `${filename}.exe`, '']) {
      await expect(service.obtenerArchivo(name, admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
    expect(tareaArchivoFindFirst).not.toHaveBeenCalled();
    expect(entregaArchivoFindFirst).not.toHaveBeenCalled();
  });

  it('responde 404 cuando el nombre no está registrado en ninguna tarea ni entrega', async () => {
    await expect(
      service.obtenerArchivo(filename, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tareaArchivoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { url: `/uploads/tareas/${filename}` },
      }),
    );
  });

  describe('adjuntos de la tarea', () => {
    beforeEach(() => {
      tareaArchivoFindFirst.mockResolvedValue({ nombre: 'Guía.pdf', tarea });
    });

    it('los entrega al docente dueño y a ADMIN con el nombre original', async () => {
      await expect(service.obtenerArchivo(filename, docente)).resolves.toEqual({
        path: getUploadAbsolutePath(filename),
        nombre: 'Guía.pdf',
      });
      await expect(service.obtenerArchivo(filename, admin)).resolves.toEqual(
        expect.objectContaining({ nombre: 'Guía.pdf' }),
      );
    });

    it('rechaza a un docente que no imparte la materia en ese grupo', async () => {
      await expect(
        service.obtenerArchivo(filename, otroDocente),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(horarioMateriaCount).toHaveBeenCalledWith({
        where: {
          materiaId: tarea.materiaId,
          docenteId: otroDocente.id,
          activo: true,
          grupoId: tarea.grupoId,
        },
      });
    });

    it('los entrega a un docente que imparte la materia en ese grupo por horario', async () => {
      horarioMateriaCount.mockResolvedValue(1);
      await expect(
        service.obtenerArchivo(filename, otroDocente),
      ).resolves.toEqual(expect.objectContaining({ nombre: 'Guía.pdf' }));
    });

    it('los entrega al alumno inscrito en la materia y grupo', async () => {
      inscripcionFindFirst.mockResolvedValue({ id: 1 });
      await expect(service.obtenerArchivo(filename, alumno)).resolves.toEqual(
        expect.objectContaining({ nombre: 'Guía.pdf' }),
      );
      const where = (
        inscripcionFindFirst.mock.calls[0] as [{ where: object }]
      )[0].where;
      expect(where).toMatchObject({
        alumnoId: alumno.id,
        materiaId: tarea.materiaId,
        estado: 'ACEPTADA',
      });
    });

    it('rechaza al alumno no inscrito', async () => {
      await expect(
        service.obtenerArchivo(filename, alumno),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('oculta a los alumnos los adjuntos de una tarea en borrador', async () => {
      tareaArchivoFindFirst.mockResolvedValue({
        nombre: 'Guía.pdf',
        tarea: { ...tarea, estado: EstadoTarea.BORRADOR },
      });
      inscripcionFindFirst.mockResolvedValue({ id: 1 });
      await expect(
        service.obtenerArchivo(filename, alumno),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(inscripcionFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('evidencias de una entrega', () => {
    beforeEach(() => {
      entregaArchivoFindFirst.mockResolvedValue({
        nombre: 'evidencia.jpg',
        entrega: { alumnoId: alumno.id, tarea },
      });
    });

    it('las entrega al alumno que las subió, a su docente y a ADMIN', async () => {
      for (const actor of [alumno, docente, admin]) {
        await expect(service.obtenerArchivo(filename, actor)).resolves.toEqual({
          path: getUploadAbsolutePath(filename),
          nombre: 'evidencia.jpg',
        });
      }
    });

    it('rechaza a otro alumno y a otro docente', async () => {
      for (const actor of [otroAlumno, otroDocente]) {
        await expect(
          service.obtenerArchivo(filename, actor),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
    });
  });
});

describe('TareasService: política docente–materia–grupo', () => {
  const tareaFindUnique = jest.fn();
  const tareaFindMany = jest.fn();
  const materiaCount = jest.fn();
  const materiaFindMany = jest.fn();
  const horarioMateriaCount = jest.fn();
  const horarioMateriaFindMany = jest.fn();
  const entregaTareaFindMany = jest.fn();
  const inscripcionFindMany = jest.fn();
  const prisma = {
    tarea: {
      findUnique: tareaFindUnique,
      findMany: tareaFindMany,
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    materia: { count: materiaCount, findMany: materiaFindMany },
    horarioMateria: {
      count: horarioMateriaCount,
      findMany: horarioMateriaFindMany,
    },
    entregaTarea: { findMany: entregaTareaFindMany },
    inscripcion: { findMany: inscripcionFindMany },
  } as unknown as PrismaService;
  const service = new TareasService(prisma, {} as NotificacionesService);

  const creador = { id: 31, rol: 'DOCENTE' };
  const colega = { id: 32, rol: 'DOCENTE' };
  const tarea = {
    id: 7,
    materiaId: 12,
    grupoId: 3,
    docenteId: creador.id,
    estado: EstadoTarea.PUBLICADA,
    tieneFechaLimite: false,
    fechaLimite: null,
    archivos: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tareaFindUnique.mockResolvedValue(tarea);
    tareaFindMany.mockResolvedValue([]);
    materiaCount.mockResolvedValue(0);
    materiaFindMany.mockResolvedValue([]);
    horarioMateriaCount.mockResolvedValue(0);
    horarioMateriaFindMany.mockResolvedValue([]);
    entregaTareaFindMany.mockResolvedValue([]);
    inscripcionFindMany.mockResolvedValue([]);
  });

  it('el detalle lo ve quien creó la tarea sin consultar horarios', async () => {
    await expect(service.obtenerDetalle(tarea.id, creador)).resolves.toEqual(
      expect.objectContaining({ id: tarea.id }),
    );
    expect(horarioMateriaCount).not.toHaveBeenCalled();
  });

  it('el detalle lo ve el docente que imparte la materia en ese grupo aunque no la haya creado', async () => {
    horarioMateriaCount.mockResolvedValue(1);
    await expect(service.obtenerDetalle(tarea.id, colega)).resolves.toEqual(
      expect.objectContaining({ id: tarea.id }),
    );
    expect(horarioMateriaCount).toHaveBeenCalledWith({
      where: {
        materiaId: tarea.materiaId,
        docenteId: colega.id,
        activo: true,
        grupoId: tarea.grupoId,
      },
    });
  });

  it('el detalle se niega a un docente ajeno a la materia y grupo', async () => {
    await expect(
      service.obtenerDetalle(tarea.id, colega),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el listado incluye tareas propias y de las clases que imparte', async () => {
    materiaFindMany.mockResolvedValue([{ id: 40 }]);
    horarioMateriaFindMany.mockResolvedValue([
      { materiaId: 12, grupoId: 3 },
      { materiaId: 13, grupoId: null },
    ]);
    await service.listarDocente(colega, { fecha: '2026-09-15' });
    const where = (
      tareaFindMany.mock.calls[0] as [{ where: { AND: unknown[] } }]
    )[0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0]).toEqual({
      OR: [
        { docenteId: colega.id },
        { materiaId: 40 },
        { materiaId: 12, grupoId: 3 },
        { materiaId: 13, grupoId: null },
      ],
    });
    expect(where.AND[1]).toHaveProperty('OR');
  });

  it('el ADMIN lista todo y puede acotar por docente', async () => {
    await service.listarDocente({ id: 1, rol: 'ADMIN' }, { docenteId: 5 });
    const where = (tareaFindMany.mock.calls[0] as [{ where: unknown }])[0]
      .where;
    expect(where).toEqual({ docenteId: 5 });
    expect(materiaFindMany).not.toHaveBeenCalled();
  });
});

describe('TareasService: fecha límite en la zona del plantel', () => {
  const service = new TareasService(
    {} as PrismaService,
    {} as NotificacionesService,
  );
  type Privados = {
    resolverFechaLimite(t: boolean, f?: string, h?: string): Date | null;
    buildDateWhere(f?: string): { OR: Array<Record<string, unknown>> } | null;
  };
  const privados = service as unknown as Privados;

  it('interpreta lo que manda el formulario como hora local del plantel, sin importar la TZ del servidor', () => {
    expect(
      privados
        .resolverFechaLimite(true, '2026-09-20T23:59', '23:59')
        ?.toISOString(),
    ).toBe('2026-09-21T05:59:00.000Z');
    expect(
      privados.resolverFechaLimite(true, '2026-09-20T23:59')?.toISOString(),
    ).toBe('2026-09-21T05:59:00.000Z');
  });

  it('al editar conserva el instante guardado y aplica la nueva hora sobre el mismo día local', () => {
    expect(
      privados
        .resolverFechaLimite(true, '2026-09-21T05:59:00.000Z', '10:00')
        ?.toISOString(),
    ).toBe('2026-09-20T16:00:00.000Z');
  });

  it('valida hora y fecha', () => {
    expect(privados.resolverFechaLimite(false)).toBeNull();
    expect(() => privados.resolverFechaLimite(true)).toThrow(/obligatoria/);
    expect(() =>
      privados.resolverFechaLimite(true, '2026-09-20', '25:00'),
    ).toThrow(/HH:mm/);
    expect(() => privados.resolverFechaLimite(true, 'ayer')).toThrow(
      /no es válida/,
    );
  });

  it('el filtro por día abarca el día completo del plantel', () => {
    const where = privados.buildDateWhere('2026-09-20');
    expect(where?.OR[1]).toEqual({
      fechaLimite: {
        gte: new Date('2026-09-20T06:00:00.000Z'),
        lte: new Date('2026-09-21T05:59:59.999Z'),
      },
    });
    expect(privados.buildDateWhere('hoy')).toBeNull();
  });
});
