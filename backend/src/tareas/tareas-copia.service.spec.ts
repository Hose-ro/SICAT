import { ForbiddenException } from '@nestjs/common';
import { EstadoTarea, TipoEntrega, TipoEvaluacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TareasCopiaService } from './tareas-copia.service';

jest.mock('fs/promises', () => ({ copyFile: jest.fn() }));
import { copyFile } from 'fs/promises';

describe('TareasCopiaService', () => {
  const tareaFindUnique = jest.fn();
  const tareaFindMany = jest.fn();
  const tareaCreate = jest.fn();
  const grupoFindFirst = jest.fn();
  const periodoFindUnique = jest.fn();
  const materiaCount = jest.fn();
  const horarioMateriaCount = jest.fn();
  const prisma = {
    tarea: {
      findUnique: tareaFindUnique,
      findMany: tareaFindMany,
      create: tareaCreate,
    },
    grupo: { findFirst: grupoFindFirst },
    periodoAcademico: { findUnique: periodoFindUnique },
    materia: { count: materiaCount },
    horarioMateria: { count: horarioMateriaCount },
  } as unknown as PrismaService;
  const service = new TareasCopiaService(prisma);
  type DatosCreados = Record<string, unknown> & {
    grupoId: number;
    estado: EstadoTarea;
    fechaLimite: Date | null;
    archivos: { create: { url: string }[] };
  };
  const creada = (n = 0) =>
    (tareaCreate.mock.calls[n] as [{ data: DatosCreados }])[0].data;
  const docente = { id: 31, rol: 'DOCENTE' };

  const origen = {
    id: 40,
    materiaId: 12,
    grupoId: 3,
    docenteId: 31,
    titulo: 'Práctica 1',
    instrucciones: 'Resolver',
    unidad: 1,
    unidadId: 5,
    categoriaId: 2,
    tipoEntrega: TipoEntrega.EN_LINEA,
    tipoEvaluacion: TipoEvaluacion.RUBRICA,
    permiteReenvio: true,
    tieneFechaLimite: true,
    // Martes 10 de febrero de 2026, 23:59 en el plantel.
    fechaLimite: new Date('2026-02-11T05:59:00.000Z'),
    horaLimite: '23:59',
    rubricJson: '[{"criterio":"Orden","peso":100}]',
    estado: EstadoTarea.CERRADA,
    archivos: [
      {
        nombre: 'guia.pdf',
        url: '/uploads/tareas/11111111-1111-1111-1111-111111111111.pdf',
        tipoArchivo: 'PDF',
      },
    ],
    grupo: { id: 3, periodo: '2026-A', modalidad: 'ESCOLARIZADO' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // asegurarAccesoMateria: la materia existe y el docente la tiene asignada.
    materiaCount.mockResolvedValue(1);
    horarioMateriaCount.mockResolvedValue(0);
    grupoFindFirst.mockResolvedValue({
      id: 9,
      periodo: '2026-B',
      modalidad: 'ESCOLARIZADO',
    });
    periodoFindUnique.mockResolvedValue(null);
    tareaCreate.mockImplementation(({ data }: { data: { titulo: string } }) =>
      Promise.resolve({ id: 99, titulo: data.titulo }),
    );
    (copyFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('duplica en el mismo grupo como borrador, con "(copia)" y su propio adjunto', async () => {
    tareaFindUnique.mockResolvedValue(origen);
    grupoFindFirst.mockResolvedValue({
      id: 3,
      periodo: '2026-A',
      modalidad: 'ESCOLARIZADO',
    });

    await expect(service.duplicar(40, docente)).resolves.toEqual({
      id: 99,
      titulo: 'Práctica 1 (copia)',
      adjuntosOmitidos: 0,
    });
    const data = creada(0);
    expect(data).toMatchObject({
      grupoId: 3,
      docenteId: 31,
      estado: EstadoTarea.BORRADOR,
      fechaPublicacion: null,
      fechaLimite: origen.fechaLimite,
      categoriaId: 2,
      unidadId: 5,
      rubricJson: origen.rubricJson,
    });
    const archivo = data.archivos.create[0];
    expect(archivo.url).not.toBe(origen.archivos[0].url);
    expect(archivo.url).toMatch(/^\/uploads\/tareas\/[0-9a-f-]{36}\.pdf$/);
    expect(copyFile).toHaveBeenCalledTimes(1);
  });

  it('no copia tareas de otro docente', async () => {
    tareaFindUnique.mockResolvedValue({ ...origen, docenteId: 77 });
    await expect(service.duplicar(40, docente)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tareaCreate).not.toHaveBeenCalled();
  });

  it('al importar desplaza las fechas semanas completas al periodo destino', async () => {
    tareaFindMany.mockResolvedValue([origen]);

    const resultado = await service.importar(docente, {
      materiaId: 12,
      grupoDestinoId: 9,
      tareaIds: [40],
    });

    expect(resultado.creadas).toEqual([{ id: 99, titulo: 'Práctica 1' }]);
    const data = creada(0);
    // 1 ene → 1 jul son 181 días ≈ 26 semanas: cae otra vez en martes.
    expect(data.fechaLimite).toEqual(
      new Date(origen.fechaLimite.getTime() + 26 * 7 * 86400000),
    );
    expect(data.fechaLimite?.getUTCDay()).toBe(origen.fechaLimite.getUTCDay());
    expect(data.grupoId).toBe(9);
    expect(data.estado).toBe(EstadoTarea.BORRADOR);
  });

  it('sin poder ubicar los periodos, o sin ajustar fechas, la copia queda sin fecha', async () => {
    tareaFindMany.mockResolvedValue([
      { ...origen, grupo: { ...origen.grupo, periodo: 'Agosto-Diciembre' } },
    ]);
    await service.importar(docente, {
      materiaId: 12,
      grupoDestinoId: 9,
      tareaIds: [40],
    });
    expect(creada(0).fechaLimite).toBeNull();

    tareaFindMany.mockResolvedValue([origen]);
    await service.importar(docente, {
      materiaId: 12,
      grupoDestinoId: 9,
      tareaIds: [40],
      ajustarFechas: false,
    });
    expect(creada(1).fechaLimite).toBeNull();
  });

  it('si el archivo original ya no está, copia la tarea y lo reporta', async () => {
    tareaFindMany.mockResolvedValue([origen]);
    (copyFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    await expect(
      service.importar(docente, {
        materiaId: 12,
        grupoDestinoId: 9,
        tareaIds: [40],
      }),
    ).resolves.toMatchObject({ adjuntosOmitidos: 1 });
    expect(creada(0).archivos.create).toEqual([]);
  });

  it('agrupa las importables por grupo con la fecha sugerida', async () => {
    tareaFindMany.mockResolvedValue([
      {
        id: 40,
        titulo: 'Práctica 1',
        grupoId: 3,
        fechaLimite: origen.fechaLimite,
        grupo: {
          id: 3,
          nombre: '8A',
          periodo: '2026-A',
          modalidad: 'ESCOLARIZADO',
        },
      },
    ]);
    const [grupo] = await service.listarImportables(docente, 12, 9);
    expect(grupo.grupo.nombre).toBe('8A');
    expect(grupo.desplazamientoDias).toBe(182);
    expect(grupo.tareas[0].fechaSugerida).toEqual(
      new Date(origen.fechaLimite.getTime() + 182 * 86400000),
    );
    expect(
      (tareaFindMany.mock.calls[0] as [{ where: unknown }])[0].where,
    ).toMatchObject({
      materiaId: 12,
      grupoId: { not: 9 },
      docenteId: 31,
    });
  });
});
