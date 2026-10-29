import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from '../periodos/periodos.service';
import { TemarioService } from './temario.service';

const docente = { id: 7, rol: 'DOCENTE' };
const admin = { id: 1, rol: 'ADMIN' };

describe('TemarioService', () => {
  const materiaFindUnique = jest.fn();
  const temaVistoFindMany = jest.fn();
  const unidadFindUnique = jest.fn();
  const temaDeleteMany = jest.fn((args: unknown) => ({ borrar: args }));
  const temaUpdate = jest.fn((args: unknown) => ({ actualizar: args }));
  const temaCreate = jest.fn((args: unknown) => ({ crear: args }));
  const temaCount = jest.fn();
  const sesionFindUnique = jest.fn();
  const vistoDeleteMany = jest.fn(() => 'borrar-vistos');
  const vistoCreateMany = jest.fn((args: unknown) => ({ marcar: args }));
  const sesionUpdate = jest.fn((args: unknown) => ({ nota: args }));
  const transaction = jest.fn((ops: unknown[]) => Promise.resolve(ops));
  const prisma = {
    materia: { findUnique: materiaFindUnique },
    temaVisto: {
      findMany: temaVistoFindMany,
      deleteMany: vistoDeleteMany,
      createMany: vistoCreateMany,
    },
    unidad: { findUnique: unidadFindUnique },
    temaUnidad: {
      deleteMany: temaDeleteMany,
      update: temaUpdate,
      create: temaCreate,
      count: temaCount,
    },
    claseSesion: { findUnique: sesionFindUnique, update: sesionUpdate },
    $transaction: transaction,
  } as unknown as PrismaService;
  const periodos = {
    // Semana 7 del curso: inicio 31 ago, hoy 15 oct.
    obtenerRangoActual: jest.fn().mockResolvedValue({
      clave: '2026-B',
      inicio: new Date(2026, 7, 31),
      fin: new Date(2026, 11, 18, 23, 59),
    }),
  } as unknown as PeriodosService;
  const service = new TemarioService(prisma, periodos);

  const materia = {
    id: 4,
    nombre: 'Redes',
    clave: 'RED-1',
    docente: { nombre: 'Mtra. Ruiz' },
    grupos: [{ id: 3, nombre: '5A', modalidad: 'ESCOLARIZADO' }],
    unidades: [
      {
        id: 11,
        nombre: 'Unidad 1',
        orden: 1,
        status: 'FINALIZADA',
        temas: [
          { id: 101, orden: 1, nombre: 'Modelo OSI', semana: 1 },
          { id: 102, orden: 2, nombre: 'TCP/IP', semana: 2 },
          { id: 103, orden: 3, nombre: 'Subredes', semana: 9 },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 15, 10));
    materiaFindUnique.mockResolvedValue(materia);
    temaVistoFindMany.mockResolvedValue([
      { temaId: 101, sesion: { fecha: new Date(2026, 8, 3) } },
      { temaId: 101, sesion: { fecha: new Date(2026, 8, 1) } },
    ]);
  });
  afterEach(() => jest.useRealTimers());

  it('con grupo, marca vistos (la primera fecha), atrasados y el resumen', async () => {
    const temario = await service.obtener(admin, 4, 3);
    const [osi, tcp, subredes] = temario.unidades[0].temas;
    expect(osi).toMatchObject({
      estado: 'VISTO',
      vistoEn: new Date(2026, 8, 1),
    });
    expect(tcp.estado).toBe('ATRASADO');
    expect(subredes.estado).toBe('PENDIENTE');
    expect(temario.periodo).toEqual({
      clave: '2026-B',
      semanaActual: 7,
      semanas: 16,
    });
    expect(temario.avance).toEqual({
      total: 3,
      vistos: 1,
      porcentaje: 33,
      planeadosALaFecha: 2,
      atrasados: 1,
    });
  });

  it('sin grupo no calcula avance', async () => {
    materiaFindUnique.mockResolvedValue({ ...materia, grupos: [] });
    const temario = await service.obtener(admin, 4);
    expect(temario.avance).toBeNull();
    expect(temaVistoFindMany).not.toHaveBeenCalled();
  });

  it('guardar temas conserva los que traen id, crea los nuevos y borra el resto', async () => {
    unidadFindUnique.mockResolvedValue({
      id: 11,
      materiaId: 4,
      temas: [{ id: 101 }, { id: 102 }],
    });
    await service.guardarTemas(admin, 11, {
      temas: [
        { nombre: 'Intro', semana: 1 },
        { id: 102, nombre: ' TCP/IP ', semana: null },
      ],
    });
    expect(temaDeleteMany).toHaveBeenCalledWith({
      where: { unidadId: 11, id: { notIn: [102] } },
    });
    expect(temaCreate).toHaveBeenCalledWith({
      data: { unidadId: 11, orden: 1, nombre: 'Intro', semana: 1 },
    });
    expect(temaUpdate).toHaveBeenCalledWith({
      where: { id: 102 },
      data: { orden: 2, nombre: 'TCP/IP', semana: null },
    });
  });

  it('no deja meter temas de otra unidad', async () => {
    unidadFindUnique.mockResolvedValue({
      id: 11,
      materiaId: 4,
      temas: [{ id: 101 }],
    });
    await expect(
      service.guardarTemas(admin, 11, {
        temas: [{ id: 999, nombre: 'Ajeno' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('la bitácora sólo la escribe el docente de la clase y con temas de su materia', async () => {
    sesionFindUnique.mockResolvedValue({
      id: 50,
      docenteId: 99,
      materiaId: 4,
      grupoId: 3,
      unidadId: 11,
      fecha: new Date(),
      activa: true,
      bitacora: null,
    });
    await expect(
      service.guardarBitacora(docente, 50, { temaIds: [101] }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    sesionFindUnique.mockResolvedValue({
      id: 50,
      docenteId: 7,
      materiaId: 4,
      grupoId: 3,
      unidadId: 11,
      fecha: new Date(),
      activa: true,
      bitacora: null,
    });
    temaCount.mockResolvedValue(1);
    await expect(
      service.guardarBitacora(docente, 50, { temaIds: [101, 555] }),
    ).rejects.toThrow('no pertenece');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('guardar la bitácora reemplaza los temas de esa clase y la nota', async () => {
    sesionFindUnique.mockResolvedValue({
      id: 50,
      docenteId: 7,
      materiaId: 4,
      grupoId: 3,
      unidadId: 11,
      fecha: new Date(),
      activa: true,
      bitacora: null,
    });
    temaCount.mockResolvedValue(2);
    jest
      .spyOn(service, 'obtenerBitacora')
      .mockResolvedValue('bitacora' as never);
    await expect(
      service.guardarBitacora(docente, 50, {
        temaIds: [101, 102, 101],
        nota: '  Práctica en laboratorio  ',
      }),
    ).resolves.toBe('bitacora');
    expect(vistoDeleteMany).toHaveBeenCalledWith({
      where: { claseSesionId: 50 },
    });
    expect(vistoCreateMany).toHaveBeenCalledWith({
      data: [
        { claseSesionId: 50, temaId: 101 },
        { claseSesionId: 50, temaId: 102 },
      ],
    });
    expect(sesionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { bitacora: 'Práctica en laboratorio' },
      }) as unknown,
    );
  });
});
