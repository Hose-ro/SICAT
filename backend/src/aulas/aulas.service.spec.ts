import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AulasService } from './aulas.service';

describe('AulasService', () => {
  const aulaFindUnique = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    aula: { findUnique: aulaFindUnique },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new AulasService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    aulaFindUnique.mockResolvedValue({ id: 3, nombre: 'Aula A1' });
  });

  it('elimina el aula y deja sin aula a lo que la usaba', async () => {
    const tx = {
      materia: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      horarioMateria: { updateMany: jest.fn().mockResolvedValue({ count: 5 }) },
      aula: {
        delete: jest.fn().mockResolvedValue({ id: 3, nombre: 'Aula A1' }),
      },
    };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );

    await expect(service.removePermanently(3)).resolves.toEqual({
      id: 3,
      nombre: 'Aula A1',
      liberados: { materias: 2, horarios: 5 },
    });
    expect(tx.materia.updateMany).toHaveBeenCalledWith({
      where: { aulaId: 3 },
      data: { aulaId: null },
    });
    expect(tx.horarioMateria.updateMany).toHaveBeenCalledWith({
      where: { aulaId: 3 },
      data: { aulaId: null },
    });
    expect(tx.aula.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });

  it('no elimina un aula inexistente', async () => {
    aulaFindUnique.mockResolvedValue(null);

    await expect(service.removePermanently(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
