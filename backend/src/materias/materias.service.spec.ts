import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MateriasService } from './materias.service';

describe('MateriasService', () => {
  const materiaFindUnique = jest.fn();
  const materiaFindFirst = jest.fn();
  const materiaUpdate = jest.fn();
  const carreraFindUnique = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    materia: {
      findUnique: materiaFindUnique,
      findFirst: materiaFindFirst,
      update: materiaUpdate,
    },
    carrera: { findUnique: carreraFindUnique },
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
