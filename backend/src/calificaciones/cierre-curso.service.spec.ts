import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CalificacionesService } from './calificaciones.service';
import { CierreCursoService } from './cierre-curso.service';

const U1 = { id: 11, nombre: 'Unidad 1', orden: 1, status: 'FINALIZADA' };
const U2 = { id: 12, nombre: 'Unidad 2', orden: 2, status: 'FINALIZADA' };
const ana = {
  id: 1,
  nombre: 'Ana López',
  numeroControl: '22500',
  sexo: 'MUJER',
};
const luis = {
  id: 2,
  nombre: 'Luis Pérez',
  numeroControl: '22501',
  sexo: 'HOMBRE',
};

function reporte(
  notas: Record<string, number | null>,
  unidades: Array<typeof U1> = [U1, U2],
) {
  const rows = unidades.flatMap((unidad) =>
    [ana, luis].map((alumno) => ({
      alumno,
      unidad,
      calificacionFinal: notas[`${alumno.id}:${unidad.id}`] ?? null,
    })),
  );
  return {
    materia: {
      id: 4,
      nombre: 'Redes',
      clave: 'RED-1',
      docente: { nombre: 'Docente' },
    },
    grupoSeleccionado: { id: 3, nombre: '5A' },
    unidades,
    rows,
  };
}

describe('CierreCursoService', () => {
  const obtenerReporteDocente = jest.fn();
  const calificaciones = {
    obtenerReporteDocente,
  } as unknown as CalificacionesService;
  const findMany = jest.fn();
  const upsert = jest.fn((args: unknown) => args);
  const findUnique = jest.fn();
  const create = jest.fn();
  const deleteMany = jest.fn();
  const prisma = {
    calificacionUnidad: { findMany, upsert },
    cierreCurso: { findUnique, create, deleteMany },
    $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
  } as unknown as PrismaService;
  const service = new CierreCursoService(prisma, calificaciones);
  const docente = { id: 7, rol: 'DOCENTE', nombre: 'Mtra. Ruiz' };

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    findUnique.mockResolvedValue(null);
  });

  it('calcula el resultado por alumno y bloquea el cierre mientras falte la segunda oportunidad', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:11': 60, '2:12': 75 }),
    );
    const cierre = await service.obtener(docente, 4, 3);

    const [a, l] = cierre.alumnos;
    expect(a).toMatchObject({
      estado: 'ACREDITADO',
      final: 85,
      nivel: 'NOTABLE',
    });
    expect(l.estado).toBe('PENDIENTE');
    expect(l.unidades[0]).toMatchObject({
      estado: 'PENDIENTE_SEGUNDA',
      primera: 60,
    });
    expect(cierre.resumen).toMatchObject({
      total: 2,
      acreditados: 1,
      pendientes: 1,
    });
    expect(cierre.puedeCerrar).toBe(false);
    expect(cierre.bloqueos).toEqual([
      '1 alumno tiene segunda oportunidad sin capturar.',
    ]);
    expect(cierre.porUnidad[0]).toMatchObject({
      alcanzadaPrimera: 1,
      pendienteSegunda: 1,
    });
  });

  it('una unidad abierta no se evalúa y bloquea el cierre', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80 }, [U1, { ...U2, status: 'ACTIVA' }]),
    );
    const cierre = await service.obtener(docente, 4, 3);
    expect(cierre.alumnos[0].unidades[1]).toMatchObject({
      primera: null,
      estado: 'SIN_CALIFICAR',
    });
    expect(cierre.bloqueos).toContain('Falta cerrar Unidad 2.');
  });

  it('una unidad cerrada sin calificación bloquea el cierre', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:12': 75 }),
    );
    const cierre = await service.obtener(docente, 4, 3);
    expect(cierre.bloqueos).toEqual([
      '1 alumno no tiene calificación en Unidad 1.',
    ]);
    expect(cierre.puedeCerrar).toBe(false);
  });

  it('la segunda oportunidad cuenta y desbloquea el cierre', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:11': 60, '2:12': 75 }),
    );
    findMany.mockResolvedValue([
      {
        alumnoId: 2,
        unidadId: 11,
        calificacionSegunda: 72,
        segundaNoPresento: false,
      },
    ]);
    const cierre = await service.obtener(docente, 4, 3);
    expect(cierre.alumnos[1]).toMatchObject({
      estado: 'ACREDITADO',
      final: 74,
      nivel: 'SUFICIENTE',
    });
    expect(cierre.alumnos[1].unidades[0]).toMatchObject({
      estado: 'ALCANZADA_SEGUNDA',
      oportunidad: 2,
    });
    expect(cierre.puedeCerrar).toBe(true);
  });

  it('no deja capturar segunda oportunidad en una unidad ya alcanzada', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:11': 60, '2:12': 75 }),
    );
    await expect(
      service.guardarSegunda(docente, {
        materiaId: 4,
        grupoId: 3,
        capturas: [{ alumnoId: 1, unidadId: 11, calificacion: 95 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('guarda la segunda oportunidad o el "no se presentó"', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:11': 60, '2:12': 75 }),
    );
    await service.guardarSegunda(docente, {
      materiaId: 4,
      grupoId: 3,
      capturas: [
        { alumnoId: 2, unidadId: 11, calificacion: 50, noPresento: true },
      ],
    });
    const args = upsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.create).toMatchObject({
      calificacionSegunda: null,
      segundaNoPresento: true,
      grupoId: 3,
    });
    expect(args.update).toMatchObject({
      calificacionSegunda: null,
      segundaNoPresento: true,
    });
  });

  it('cerrar congela el concentrado con el nombre de quien cerró', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:11': 70, '2:12': 75 }),
    );
    await service.cerrar(docente, 4, 3);
    const { data: datos } = (create.mock.calls as unknown[][])[0][0] as {
      data: {
        concentrado: { docente: string; alumnos: Array<{ final: number }> };
      };
    };
    expect(datos).toMatchObject({ materiaId: 4, grupoId: 3, docenteId: 7 });
    expect(datos.concentrado.docente).toBe('Mtra. Ruiz');
    expect(datos.concentrado.alumnos.map((item) => item.final)).toEqual([
      85, 73,
    ]);
  });

  it('no cierra con bloqueos ni dos veces', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:11': 60, '2:12': 75 }),
    );
    await expect(service.cerrar(docente, 4, 3)).rejects.toBeInstanceOf(
      ConflictException,
    );
    findUnique.mockResolvedValue({
      cerradoEn: new Date(),
      concentrado: { alumnos: [] },
    });
    await expect(service.cerrar(docente, 4, 3)).rejects.toThrow(
      'ya está cerrado',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('con el curso cerrado avisa quién cambió después y bloquea la segunda oportunidad', async () => {
    obtenerReporteDocente.mockResolvedValue(
      reporte({ '1:11': 90, '1:12': 80, '2:11': 70, '2:12': 75 }),
    );
    findUnique.mockResolvedValue({
      cerradoEn: new Date('2026-12-10T18:00:00Z'),
      concentrado: {
        docente: 'Mtra. Ruiz',
        unidades: [],
        alumnos: [
          { alumno: ana, final: 85, estado: 'ACREDITADO' },
          { alumno: luis, final: 70, estado: 'ACREDITADO' },
        ],
      },
    });
    const cierre = await service.obtener(docente, 4, 3);
    expect(
      cierre.cierre?.cambios.map((item) => [
        item.alumno.id,
        item.antes,
        item.ahora,
      ]),
    ).toEqual([[2, 70, 73]]);
    expect(cierre.puedeCerrar).toBe(false);
    await expect(
      service.guardarSegunda(docente, {
        materiaId: 4,
        grupoId: 3,
        capturas: [{ alumnoId: 2, unidadId: 11, calificacion: 80 }],
      }),
    ).rejects.toThrow('El curso está cerrado');
  });

  it('reabrir valida el acceso antes de borrar el cierre', async () => {
    obtenerReporteDocente.mockRejectedValueOnce(new Error('sin acceso'));
    await expect(service.reabrir(docente, 4, 3)).rejects.toThrow('sin acceso');
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
