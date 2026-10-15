import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import { formatearFechaClave, sumarDias } from '../clases/clases.utils';
import { ordenSeguimientos, SeguimientosService } from './seguimientos.service';
import { huellaSeguimiento, leerHuella } from './supervision.utils';

const periodo = getCurrentAcademicPeriod();
const ahora = new Date('2026-10-15T12:00:00Z');

function alertaGuardada(extra: Record<string, unknown> = {}) {
  return {
    id: 7,
    fingerprint: huellaSeguimiento(3, periodo, {
      tipo: 'SEGUIMIENTO_DOCENTE',
      docenteId: 41,
    }),
    tipo: 'SEGUIMIENTO_DOCENTE',
    titulo: 'Seguimiento con Laura Méndez',
    mensaje: 'Acuerdos y revisiones con el docente',
    estado: 'EN_SEGUIMIENTO',
    fechaSeguimiento: null,
    responsable: { id: 41, nombre: 'Laura Méndez' },
    createdAt: ahora,
    updatedAt: ahora,
    notas: [
      {
        id: 1,
        texto: 'Hablé con la docente',
        estado: 'EN_SEGUIMIENTO',
        fechaRevision: null,
        autor: { id: 9, nombre: 'Jefa' },
        createdAt: ahora,
      },
    ],
    ...extra,
  };
}

function crear() {
  const tx = {
    alertaCarrera: {
      upsert: jest.fn().mockResolvedValue({ id: 7 }),
      update: jest.fn().mockResolvedValue({ id: 7 }),
    },
    seguimientoNota: { create: jest.fn().mockResolvedValue({ id: 1 }) },
  };
  const prisma = {
    jefeCarreraAsignacion: {
      findFirst: jest.fn().mockResolvedValue({ id: 1 }),
    },
    alertaCarrera: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(alertaGuardada()),
    },
    usuario: { findFirst: jest.fn() },
    horarioMateria: { findFirst: jest.fn() },
    grupo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 4,
          periodo: 'Agosto-Diciembre 2026',
          createdAt: new Date('2026-08-01T12:00:00Z'),
        },
      ]),
      findFirst: jest.fn(),
    },
    materia: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const service = new SeguimientosService(prisma as unknown as PrismaService);
  return { service, prisma, tx };
}

describe('huellas de seguimiento', () => {
  it('ida y vuelta para cada tipo de caso', () => {
    const casos = [
      { tipo: 'ASISTENCIA_SIN_CAPTURA', horarioId: 5, fecha: '2026-10-12' },
      { tipo: 'ALUMNO_RIESGO', alumnoId: 8 },
      { tipo: 'CALIFICACIONES_PENDIENTES', materiaId: 2, grupoId: 4 },
      { tipo: 'SEGUIMIENTO_DOCENTE', docenteId: 41 },
    ] as const;
    for (const caso of casos)
      expect(leerHuella(huellaSeguimiento(3, '2026-B', caso))).toEqual(caso);
  });

  it('el mismo caso en otra carrera o periodo es otro seguimiento', () => {
    const ref = { tipo: 'ALUMNO_RIESGO', alumnoId: 8 } as const;
    expect(huellaSeguimiento(3, '2026-B', ref)).not.toBe(
      huellaSeguimiento(4, '2026-B', ref),
    );
    expect(huellaSeguimiento(3, '2026-B', ref)).not.toBe(
      huellaSeguimiento(3, '2027-A', ref),
    );
  });

  it('las alertas anteriores no tienen referencia legible', () => {
    expect(leerHuella('CLASE_NO_INICIADA:12:2026-10-12')).toBeNull();
  });
});

describe('SeguimientosService', () => {
  it('rechaza una carrera fuera del alcance', async () => {
    const { service, prisma } = crear();
    prisma.jefeCarreraAsignacion.findFirst.mockResolvedValue(null);
    await expect(service.listar(9, { carreraId: 3 })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('solo lista casos con notas de la carrera y periodo', async () => {
    const { service, prisma } = crear();
    prisma.alertaCarrera.findMany.mockResolvedValue([alertaGuardada()]);
    const lista = await service.listar(9, { carreraId: 3, periodo });
    expect(prisma.alertaCarrera.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { carreraId: 3, periodo, notas: { some: {} } },
      }),
    );
    expect(lista[0]).toMatchObject({
      abierto: true,
      referencia: { tipo: 'SEGUIMIENTO_DOCENTE', docenteId: 41 },
      notas: [{ autor: 'Jefa', texto: 'Hablé con la docente' }],
    });
  });

  it('los periodos anteriores son de solo consulta', async () => {
    const { service } = crear();
    await expect(
      service.registrar(
        9,
        { carreraId: 3, periodo: '2020-A' },
        {
          tipo: 'SEGUIMIENTO_DOCENTE',
          docenteId: 41,
          texto: 'Nota',
          estado: 'EN_SEGUIMIENTO',
        },
      ),
    ).rejects.toThrow('Los periodos anteriores son de solo consulta');
  });

  it('no acepta un caso de otra carrera', async () => {
    const { service, prisma } = crear();
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(
      service.registrar(
        9,
        { carreraId: 3, periodo },
        {
          tipo: 'SEGUIMIENTO_DOCENTE',
          docenteId: 41,
          texto: 'Nota',
          estado: 'EN_SEGUIMIENTO',
        },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('crea el caso con su primera nota y la huella estable', async () => {
    const { service, prisma, tx } = crear();
    prisma.usuario.findFirst.mockResolvedValue({
      id: 41,
      nombre: 'Laura Méndez',
    });
    const revision = formatearFechaClave(sumarDias(new Date(), 3));
    await service.registrar(
      9,
      { carreraId: 3, periodo },
      {
        tipo: 'SEGUIMIENTO_DOCENTE',
        docenteId: 41,
        texto: '  Hablé con la docente  ',
        estado: 'EN_SEGUIMIENTO',
        fechaRevision: revision,
      },
    );
    const huella = huellaSeguimiento(3, periodo, {
      tipo: 'SEGUIMIENTO_DOCENTE',
      docenteId: 41,
    });
    const upsert = (
      tx.alertaCarrera.upsert.mock.calls as unknown[][]
    )[0][0] as {
      where: { fingerprint: string };
      create: Record<string, unknown>;
    };
    expect(upsert.where.fingerprint).toBe(huella);
    expect(upsert.create).toMatchObject({
      carreraId: 3,
      periodo,
      responsableId: 41,
      estado: 'EN_SEGUIMIENTO',
    });
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              horariosDocente: {
                some: expect.objectContaining({
                  grupo: { id: { in: [4] }, carreraId: 3 },
                }),
              },
            }),
          ]),
        }),
      }),
    );
    const nota = (
      tx.seguimientoNota.create.mock.calls as unknown[][]
    )[0][0] as {
      data: { texto: string; autorId: number; fechaRevision: Date };
    };
    expect(nota.data.texto).toBe('Hablé con la docente');
    expect(nota.data.autorId).toBe(9);
    expect(formatearFechaClave(nota.data.fechaRevision)).toBe(revision);
  });

  it('cerrar un caso borra la fecha de revisión', async () => {
    const { service, prisma, tx } = crear();
    prisma.alertaCarrera.findFirst.mockResolvedValue({ id: 7 });
    await service.registrar(
      9,
      { carreraId: 3, periodo },
      {
        alertaId: 7,
        texto: 'Capturó las listas',
        estado: 'CERRADA',
        fechaRevision: '2099-01-01',
      },
    );
    expect(tx.alertaCarrera.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { estado: 'CERRADA', fechaSeguimiento: null },
    });
  });

  it('no acepta una fecha de revisión pasada', async () => {
    const { service, prisma } = crear();
    prisma.alertaCarrera.findFirst.mockResolvedValue({ id: 7 });
    await expect(
      service.registrar(
        9,
        { carreraId: 3, periodo },
        {
          alertaId: 7,
          texto: 'Nota',
          estado: 'EN_SEGUIMIENTO',
          fechaRevision: '2020-01-01',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('ordena abiertos por revisión más próxima y después cerrados', () => {
    const base = { actualizadoEn: '2026-10-10T00:00:00Z' };
    const lista = [
      { ...base, id: 'cerrado', abierto: false, fechaRevision: null },
      { ...base, id: 'sin-fecha', abierto: true, fechaRevision: null },
      { ...base, id: 'tarde', abierto: true, fechaRevision: '2026-10-20' },
      { ...base, id: 'pronto', abierto: true, fechaRevision: '2026-10-16' },
    ].sort(ordenSeguimientos);
    expect(lista.map((s) => s.id)).toEqual([
      'pronto',
      'tarde',
      'sin-fecha',
      'cerrado',
    ]);
  });
});
