import { getCurrentAcademicPeriod } from '../common/periodo.util';
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
      carrera: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1, nombre: 'Sistemas', codigo: 'ISC' }]),
      },
      materia: { findMany: jest.fn().mockResolvedValue([materia]) },
      grupo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 20,
            periodo: 'Agosto-Diciembre 2026',
            createdAt: new Date('2026-08-01T12:00:00Z'),
          },
        ]),
      },
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

  it('incluye etiquetas institucionales equivalentes en el periodo de supervisión', async () => {
    const { prisma, service } = crearServicio();

    const grupos = await (service as any).gruposDelPeriodo(1, '2026-B');
    await (service as any).ofertas(
      1,
      grupos.map((grupo: { id: number }) => grupo.id),
    );

    expect(prisma.materia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          carreraId: 1,
          grupos: {
            // Los ids ya vienen filtrados por vigencia del periodo.
            some: { carreraId: 1, id: { in: [20] } },
          },
        },
      }),
    );
  });

  it('un ciclo anterior incluye grupos dados de baja después', async () => {
    const { prisma, service } = crearServicio();
    const privado = service as unknown as {
      gruposDelPeriodo: (
        carreraId: number,
        periodo: string,
      ) => Promise<unknown>;
    };

    await privado.gruposDelPeriodo(1, '2020-A');
    expect(prisma.grupo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { carreraId: 1 } }),
    );

    await privado.gruposDelPeriodo(1, getCurrentAcademicPeriod());
    expect(prisma.grupo.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { carreraId: 1, activo: true } }),
    );
  });

  it('ofrece en el selector los ciclos detectados desde etiquetas libres', async () => {
    const { service } = crearServicio();

    const contexto = await service.contexto(9);

    expect(contexto.periodos).toContain('2026-B');
    expect(contexto.periodos).not.toContain('Agosto-Diciembre 2026');
  });
});
