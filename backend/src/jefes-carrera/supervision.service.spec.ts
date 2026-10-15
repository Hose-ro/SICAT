import { SupervisionService } from './supervision.service';

describe('SupervisionService - catálogos de jefatura', () => {
  const materia = {
    id: 10,
    nombre: 'Redes',
    clave: 'ISC-10',
    semestre: 7,
    docente: { id: 4, nombre: 'Docente', email: null },
    unidades: [],
    grupos: [
      {
        id: 20,
        nombre: '706-A',
        semestre: 7,
        modalidad: 'ESCOLARIZADO',
        periodo: '2026-A',
        carreraId: 1,
      },
    ],
    horarios: [
      {
        id: 30,
        grupoId: 20,
        docenteId: 4,
        docente: { id: 4, nombre: 'Docente', email: null },
      },
    ],
  };

  function crearServicio() {
    const prisma = {
      materia: { findMany: jest.fn().mockResolvedValue([materia]) },
    };
    return {
      prisma,
      service: new SupervisionService(prisma as never, {} as never),
    };
  }

  it('consulta todos los grupos activos de la carrera para el catálogo', async () => {
    const { prisma, service } = crearServicio();

    const ofertas = await (service as any).ofertas(1);

    expect(prisma.materia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          carreraId: 1,
          grupos: { some: { carreraId: 1, activo: true } },
        },
        include: expect.objectContaining({
          grupos: expect.objectContaining({
            where: { carreraId: 1, activo: true },
          }),
          horarios: expect.objectContaining({
            where: {
              activo: true,
              grupo: { carreraId: 1, activo: true },
            },
          }),
        }),
      }),
    );
    expect(ofertas).toHaveLength(1);
    expect(ofertas[0].docentes).toEqual([
      expect.objectContaining({ id: 4, nombre: 'Docente' }),
    ]);
  });

  it('conserva el filtro de periodo para las métricas académicas', async () => {
    const { prisma, service } = crearServicio();

    await (service as any).ofertas(1, '2026-B');

    expect(prisma.materia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          carreraId: 1,
          grupos: {
            some: { carreraId: 1, activo: true, periodo: '2026-B' },
          },
        },
      }),
    );
  });
});
