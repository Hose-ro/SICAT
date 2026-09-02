import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HorariosService } from '../horarios/horarios.service';
import { GruposService } from './grupos.service';

describe('GruposService', () => {
  const grupoFindUnique = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    grupo: { findUnique: grupoFindUnique },
    $transaction: transaction,
  } as unknown as PrismaService;
  const horarios = {} as unknown as HorariosService;
  const service = new GruposService(prisma, horarios);

  beforeEach(() => {
    jest.clearAllMocks();
    grupoFindUnique.mockResolvedValue({ id: 4, nombre: 'ISC-1A' });
  });

  it('borra el grupo con su horario y libera todo lo demás', async () => {
    const contador = (count: number) => jest.fn().mockResolvedValue({ count });
    const tx = {
      usuario: { updateMany: contador(12) },
      horarioMateria: { deleteMany: contador(7) },
      claseSesion: { updateMany: contador(30) },
      tarea: { updateMany: contador(5) },
      calificacionUnidad: { updateMany: contador(60) },
      importacionHorario: { updateMany: contador(2) },
      grupo: { delete: jest.fn().mockResolvedValue({ id: 4, nombre: 'ISC-1A' }) },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.eliminarGrupoDefinitivo(4)).resolves.toEqual({
      id: 4,
      nombre: 'ISC-1A',
      horariosEliminados: 7,
      liberados: {
        alumnos: 12,
        sesiones: 30,
        tareas: 5,
        calificaciones: 60,
        importaciones: 2,
      },
    });
    expect(tx.usuario.updateMany).toHaveBeenCalledWith({
      where: { grupoId: 4 },
      data: { grupoId: null },
    });
    expect(tx.horarioMateria.deleteMany).toHaveBeenCalledWith({
      where: { grupoId: 4 },
    });
    // Las calificaciones no se borran: sólo dejan de apuntar al grupo.
    expect(tx.calificacionUnidad.updateMany).toHaveBeenCalledWith({
      where: { grupoId: 4 },
      data: { grupoId: null },
    });
    expect(tx.grupo.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it('no elimina un grupo inexistente', async () => {
    grupoFindUnique.mockResolvedValue(null);

    await expect(service.eliminarGrupoDefinitivo(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
