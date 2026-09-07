import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MateriasService } from './materias.service';

describe('MateriasService', () => {
  const materiaFindUnique = jest.fn();
  const materiaFindFirst = jest.fn();
  const materiaUpdate = jest.fn();
  const carreraFindUnique = jest.fn();
  const transaction = jest.fn();
  const materiaCount = jest.fn();
  const materiaFindMany = jest.fn();
  const grupoFindUnique = jest.fn();
  const reticulaFindMany = jest.fn();
  const horarioCount = jest.fn();
  const unidadFindMany = jest.fn();
  const calificacionCount = jest.fn();
  const tareaCount = jest.fn();
  const sesionCount = jest.fn();
  const prisma = {
    materia: {
      findUnique: materiaFindUnique,
      findFirst: materiaFindFirst,
      update: materiaUpdate,
      count: materiaCount,
      findMany: materiaFindMany,
    },
    grupo: { findUnique: grupoFindUnique },
    reticulaMateria: { findMany: reticulaFindMany },
    carrera: { findUnique: carreraFindUnique },
    horarioMateria: { count: horarioCount },
    unidad: { findMany: unidadFindMany },
    calificacionUnidad: { count: calificacionCount },
    tarea: { count: tareaCount },
    claseSesion: { count: sesionCount },
    $transaction: transaction,
  } as unknown as PrismaService;
  const notificaciones = {
    crearParaAdmins: jest.fn(),
  } as unknown as NotificacionesService;
  const service = new MateriasService(prisma, notificaciones);

  const materia = {
    id: 7,
    nombre: 'Cálculo Diferencial',
    clave: 'ACF-2301',
    descripcion: null,
    carreraId: 1,
    semestre: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    materiaFindUnique.mockResolvedValue(materia);
    materiaFindFirst.mockResolvedValue(null);
    materiaUpdate.mockResolvedValue({ ...materia, clave: 'ACF-0901' });
    carreraFindUnique.mockResolvedValue({ id: 1 });
  });

  it('normaliza y actualiza los datos generales de una materia', async () => {
    await service.update(7, {
      nombre: '  Cálculo Diferencial  ',
      clave: ' acf-0901 ',
      descripcion: '  Materia base  ',
      carreraId: 1,
      semestre: 1,
    });

    expect(materiaUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        nombre: 'Cálculo Diferencial',
        clave: 'ACF-0901',
        descripcion: 'Materia base',
        carreraId: 1,
        semestre: 1,
      },
    });
  });

  it('busca la clave duplicada solo dentro de la carrera destino', async () => {
    await service.update(7, { clave: 'ACF-0901', carreraId: 3 });

    expect(materiaFindFirst).toHaveBeenCalledWith({
      where: { clave: 'ACF-0901', carreraId: 3 },
      select: { id: true },
    });
  });

  it('rechaza una clave asignada a otra materia de la misma carrera', async () => {
    materiaFindFirst.mockResolvedValue({ id: 22 });

    await expect(
      service.update(7, { clave: 'SCC-1019' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(materiaUpdate).not.toHaveBeenCalled();
  });

  it('rechaza una carrera inexistente', async () => {
    carreraFindUnique.mockResolvedValue(null);

    await expect(service.update(7, { carreraId: 999 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(materiaUpdate).not.toHaveBeenCalled();
  });

  describe('materias por grupo', () => {
    beforeEach(() => {
      grupoFindUnique.mockResolvedValue({ id: 3, semestre: 5, carreraId: 1 });
      reticulaFindMany.mockResolvedValue([
        { clave: 'SCD-1027', semestre: 5 },
        { clave: 'AEF-1052', semestre: 1 },
      ]);
      materiaFindMany.mockResolvedValue([
        { id: 10, clave: 'SCD-1027', nombre: 'Fundamentos de BD', semestre: 5 },
        { id: 11, clave: 'AEF-1052', nombre: 'Cálculo', semestre: 1 },
        { id: 12, clave: 'SCD-1027', nombre: 'Sección sin semestre', semestre: null },
        { id: 13, clave: 'XXX-0000', nombre: 'Fuera de retícula', semestre: null },
      ]);
    });

    it('sólo deja las materias del semestre que cursa el grupo', async () => {
      const materias = await service.findForGrupo(3);

      expect(materiaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { carreraId: 1 } }),
      );
      // La sección sin semestre capturado se resuelve con la retícula.
      expect(materias.map((materia) => materia.id)).toEqual([10, 12]);
    });

    it('rechaza un grupo inexistente', async () => {
      grupoFindUnique.mockResolvedValue(null);

      await expect(service.findForGrupo(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('unidades', () => {
    const unidades = [
      { id: 1, orden: 1, nombre: 'Unidad 1' },
      { id: 2, orden: 2, nombre: 'Unidad 2' },
      { id: 3, orden: 3, nombre: 'Unidad 3' },
    ];
    const tx = {
      unidad: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(5),
      },
      materia: { update: jest.fn().mockResolvedValue({ id: 7 }) },
      asistencia: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      claseSesion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      entregaTarea: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      tarea: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      calificacionUnidad: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    beforeEach(() => {
      Object.values(tx).forEach((modelo) =>
        Object.values(modelo).forEach((fn) => (fn as jest.Mock).mockClear()),
      );
      materiaCount.mockResolvedValue(1);
      horarioCount.mockResolvedValue(1);
      unidadFindMany.mockResolvedValue(unidades);
      calificacionCount.mockResolvedValue(0);
      tareaCount.mockResolvedValue(0);
      sesionCount.mockResolvedValue(0);
      transaction.mockImplementation(
        (callback: (client: typeof tx) => unknown) =>
          Promise.resolve(callback(tx)),
      );
    });

    it('agrega las unidades que faltan al subir el número', async () => {
      await service.actualizarUnidades(7, { numUnidades: 5 });

      expect(tx.unidad.createMany).toHaveBeenCalledWith({
        data: [
          { nombre: 'Unidad 4', orden: 4, materiaId: 7 },
          { nombre: 'Unidad 5', orden: 5, materiaId: 7 },
        ],
      });
      expect(tx.unidad.deleteMany).not.toHaveBeenCalled();
      expect(tx.materia.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { numUnidades: 5 },
      });
    });

    it('pide confirmación antes de borrar unidades con información', async () => {
      calificacionCount.mockResolvedValue(2);

      await expect(
        service.actualizarUnidades(7, { numUnidades: 2 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('borra las unidades sobrantes cuando se confirma', async () => {
      calificacionCount.mockResolvedValue(2);

      await service.actualizarUnidades(7, { numUnidades: 2, forzar: true });

      expect(tx.calificacionUnidad.deleteMany).toHaveBeenCalledWith({
        where: { unidadId: { in: [3] } },
      });
      expect(tx.unidad.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [3] } },
      });
    });

    it('reduce sin confirmación cuando las unidades están vacías', async () => {
      await service.actualizarUnidades(7, { numUnidades: 2 });

      expect(tx.unidad.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [3] } },
      });
    });

    it('cuenta tareas y sesiones también por el número de unidad heredado', async () => {
      tareaCount.mockResolvedValue(1);

      await expect(
        service.actualizarUnidades(7, { numUnidades: 2 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tareaCount).toHaveBeenCalledWith({
        where: {
          OR: [{ unidadId: { in: [3] } }, { materiaId: 7, unidad: { in: [3] } }],
        },
      });
    });

    it('rechaza al docente que no imparte la materia', async () => {
      // Existe la materia, pero no es suya ni por asignación ni por horario.
      materiaCount.mockResolvedValueOnce(1).mockResolvedValue(0);
      horarioCount.mockResolvedValue(0);

      await expect(
        service.actualizarUnidades(
          7,
          { numUnidades: 4 },
          { id: 99, rol: 'DOCENTE' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  it('elimina la materia con todo lo que cuelga de ella', async () => {
    const contador = (count: number) => jest.fn().mockResolvedValue({ count });
    const tx = {
      asistencia: { deleteMany: contador(40) },
      entregaTarea: { deleteMany: contador(12) },
      tarea: { deleteMany: contador(3) },
      claseSesion: { deleteMany: contador(15) },
      inscripcion: { deleteMany: contador(28) },
      calificacionUnidad: { deleteMany: contador(9) },
      horarioMateria: { deleteMany: contador(2) },
      unidad: { deleteMany: contador(3) },
      materia: {
        delete: jest
          .fn()
          .mockResolvedValue({ id: 7, nombre: 'Cálculo Diferencial', clave: 'ACF-0901' }),
      },
    };
    transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)) as unknown,
    );

    const resultado = await service.remove(7);

    // Las asistencias y entregas se borran antes que sus sesiones y tareas.
    expect(tx.asistencia.deleteMany).toHaveBeenCalledWith({
      where: { claseSesion: { materiaId: 7 } },
    });
    expect(tx.entregaTarea.deleteMany).toHaveBeenCalledWith({
      where: { tarea: { materiaId: 7 } },
    });
    expect(tx.unidad.deleteMany).toHaveBeenCalledWith({
      where: { materiaId: 7 },
    });
    expect(tx.materia.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } }),
    );
    expect(resultado).toEqual(
      expect.objectContaining({
        id: 7,
        eliminados: expect.objectContaining({
          asistencias: 40,
          entregas: 12,
          unidades: 3,
        }) as Record<string, number>,
      }),
    );
  });
});
