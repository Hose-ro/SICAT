import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AsistenciasService } from './asistencias.service';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from '../periodos/periodos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

describe('Opciones del calendario de reportes docente', () => {
  const grupoFindMany = jest.fn();
  const materiaFindMany = jest.fn();
  const sesionesFindMany = jest.fn();
  const prisma = {
    grupo: { findMany: grupoFindMany },
    materia: { findMany: materiaFindMany },
    claseSesion: { findMany: sesionesFindMany },
  } as unknown as PrismaService;
  const servicio = new AsistenciasService(
    prisma,
    {} as NotificacionesService,
    {} as PeriodosService,
  );
  const actor = { id: 31, rol: 'DOCENTE' };
  const grupos = [
    {
      id: 4,
      nombre: '103A',
      semestre: 1,
      modalidad: 'ESCOLARIZADO',
      periodo: '2026-B',
    },
  ];
  const materias = [
    {
      id: 12,
      nombre: 'Cálculo',
      clave: 'MAT',
      unidades: [{ id: 2, nombre: 'Unidad 1', orden: 1 }],
    },
  ];
  beforeEach(() => {
    jest.clearAllMocks();
    grupoFindMany.mockResolvedValue(grupos);
    materiaFindMany.mockResolvedValue(materias);
    sesionesFindMany.mockResolvedValue([
      { fecha: new Date(2026, 8, 10, 8) },
      { fecha: new Date(2026, 8, 10, 10) },
    ]);
  });

  it('comienza por grupos con horarios del actor sin consultar materias de otros grupos', async () => {
    const resultado = await servicio.obtenerFiltrosDisponibles(actor, {
      orden: 'grupo',
      docenteId: 99,
    });
    expect(resultado.grupos).toEqual(grupos);
    expect(resultado.materias).toEqual([]);
    expect(grupoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          horarios: {
            some: {
              docenteId: 31,
              activo: true,
              materia: { pausas: { none: { docenteId: 31 } } },
            },
          },
        }),
      }),
    );
    expect(materiaFindMany).not.toHaveBeenCalled();
  });

  it('las materias están restringidas al grupo y al docente autenticado', async () => {
    const resultado = await servicio.obtenerFiltrosDisponibles(actor, {
      orden: 'grupo',
      grupoId: 4,
    });
    expect(resultado.materias).toEqual([
      { id: 12, nombre: 'Cálculo', clave: 'MAT' },
    ]);
    expect(materiaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          horarios: { some: { docenteId: 31, grupoId: 4, activo: true } },
          pausas: { none: { docenteId: 31 } },
        },
      }),
    );
    expect(sesionesFindMany).not.toHaveBeenCalled();
  });

  it('devuelve solo fechas de la unidad, grupo, materia y actor; agrupa múltiples sesiones de un día', async () => {
    const resultado = await servicio.obtenerFiltrosDisponibles(actor, {
      orden: 'grupo',
      grupoId: 4,
      materiaId: 12,
      unidadId: 2,
    });
    expect(sesionesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { docenteId: 31, grupoId: 4, materiaId: 12, unidadId: 2 },
      }),
    );
    expect(resultado.fechasClase).toEqual(['2026-09-10']);
    expect(resultado).toMatchObject({
      diasClase: [{ fecha: '2026-09-10', sesiones: 2 }],
    });
  });

  it('rechaza un grupo ajeno antes de consultar sus materias', async () => {
    await expect(
      servicio.obtenerFiltrosDisponibles(actor, {
        orden: 'grupo',
        grupoId: 90,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(materiaFindMany).not.toHaveBeenCalled();
  });

  it('rechaza una materia que ese docente no imparte en el grupo', async () => {
    await expect(
      servicio.obtenerFiltrosDisponibles(actor, {
        orden: 'grupo',
        grupoId: 4,
        materiaId: 90,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sesionesFindMany).not.toHaveBeenCalled();
  });

  it('rechaza una unidad de otra materia', async () => {
    await expect(
      servicio.obtenerFiltrosDisponibles(actor, {
        orden: 'grupo',
        grupoId: 4,
        materiaId: 12,
        unidadId: 90,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sesionesFindMany).not.toHaveBeenCalled();
  });
});
