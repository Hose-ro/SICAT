import { BadRequestException } from '@nestjs/common';
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
