import { PrismaService } from '../prisma.service';
import { CarrerasService } from './carreras.service';

describe('CarrerasService', () => {
  const carreraCreate = jest.fn();
  const carreraFindUnique = jest.fn();
  const carreraDelete = jest.fn();
  const reticulaCreateMany = jest.fn();
  const reticulaDeleteMany = jest.fn();
  const carreraFindUniqueOrThrow = jest.fn();
  const tx = {
    carrera: {
      create: carreraCreate,
      delete: carreraDelete,
      findUnique: carreraFindUnique,
      findUniqueOrThrow: carreraFindUniqueOrThrow,
    },
    reticulaMateria: {
      createMany: reticulaCreateMany,
      deleteMany: reticulaDeleteMany,
    },
  };
  const transaction = jest.fn(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const service = new CarrerasService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    carreraCreate.mockResolvedValue({ id: 9 });
    carreraFindUnique.mockResolvedValue({ id: 9 });
    carreraDelete.mockResolvedValue({ id: 9 });
    reticulaCreateMany.mockResolvedValue({ count: 1 });
    reticulaDeleteMany.mockResolvedValue({ count: 1 });
    carreraFindUniqueOrThrow.mockResolvedValue({
      id: 9,
      nombre: 'Ingeniería de Prueba',
      codigo: 'IP',
      _count: { usuarios: 0, reticulaMaterias: 1 },
    });
  });

  it('crea la carrera y su retícula dentro de la misma transacción', async () => {
    const result = await service.create(
      {
        nombre: ' Ingeniería de Prueba ',
        codigo: 'ip',
        planEstudios: ' PLAN-2026 ',
      },
      [
        {
          nombre: 'Materia uno',
          clave: 'IP-01',
          semestre: 1,
          horasTeoria: 2,
          horasPractica: 2,
          creditos: 4,
        },
      ],
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(carreraCreate).toHaveBeenCalledWith({
      data: {
        nombre: 'Ingeniería de Prueba',
        codigo: 'IP',
        planEstudios: 'PLAN-2026',
      },
    });
    expect(reticulaCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ carreraId: 9, clave: 'IP-01', activo: true }),
      ],
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 9,
        _count: { reticulaMaterias: 1, usuarios: 0 },
      }),
    );
  });

  it('elimina la retícula y la carrera en la misma transacción', async () => {
    await expect(service.remove(9)).resolves.toEqual({ id: 9 });

    expect(reticulaDeleteMany).toHaveBeenCalledWith({
      where: { carreraId: 9 },
    });
    expect(carreraDelete).toHaveBeenCalledWith({ where: { id: 9 } });
  });
});
