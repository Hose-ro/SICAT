import { NotFoundException } from '@nestjs/common';
import { TipoTokenAuth } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from '../periodos/periodos.service';
import { CalendarioService } from './calendario.service';

describe('CalendarioService', () => {
  const authFindUnique = jest.fn();
  const authUpdateMany = jest.fn();
  const authCreate = jest.fn();
  const horarioFindMany = jest.fn();
  const suspensionClaseFindMany = jest.fn();
  const suspensionInstFindMany = jest.fn();
  const tareaFindMany = jest.fn();
  const prisma = {
    authToken: {
      findUnique: authFindUnique,
      updateMany: authUpdateMany,
      create: authCreate,
    },
    horarioMateria: { findMany: horarioFindMany },
    suspensionClase: { findMany: suspensionClaseFindMany },
    suspensionInstitucional: { findMany: suspensionInstFindMany },
    tarea: { findMany: tareaFindMany },
    inscripcion: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  const periodos = {
    obtenerActual: jest.fn((_ref: Date, modalidad: string) =>
      Promise.resolve({
        clave: '2026-B',
        modalidad,
        fechaInicio: modalidad === 'MIXTO' ? '2026-08-29' : '2026-08-31',
        fechaFin: '2026-12-18',
      }),
    ),
  } as unknown as PeriodosService;
  const service = new CalendarioService(prisma, periodos);
  const ahora = new Date('2026-10-01T15:00:00Z');
  const docente = {
    id: 36,
    nombre: 'Docente',
    rol: 'DOCENTE',
    activo: true,
    grupoId: null,
  };
  const vigente = (usuario = docente) => ({
    tipo: TipoTokenAuth.CALENDARIO,
    usedAt: null,
    expiresAt: new Date('2028-01-01'),
    usuario,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    horarioFindMany.mockResolvedValue([
      {
        id: 1,
        dias: 'Miercoles',
        horaInicio: '08:00',
        horaFin: '09:00',
        docenteId: 36,
        materia: { nombre: 'Redes' },
        grupo: { nombre: '8A', modalidad: 'ESCOLARIZADO' },
        aula: { nombre: 'Aula 3' },
      },
    ]);
    suspensionClaseFindMany.mockResolvedValue([
      { docenteId: 36, fecha: '2026-10-14' },
    ]);
    suspensionInstFindMany.mockResolvedValue([
      { fecha: '2026-11-18', motivo: 'Revolución' },
    ]);
    tareaFindMany.mockResolvedValue([
      {
        id: 5,
        titulo: 'Práctica 1',
        fechaLimite: new Date('2026-10-21T05:59:00Z'),
        horaLimite: '23:59',
        materia: { nombre: 'Redes' },
        grupo: { nombre: '8A' },
      },
    ]);
  });

  it('guarda sólo el hash del token y revoca el anterior', async () => {
    const { token } = await service.generarToken(36);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(authUpdateMany).toHaveBeenCalledWith({
      where: { usuarioId: 36, tipo: TipoTokenAuth.CALENDARIO, usedAt: null },
      data: { usedAt: expect.any(Date) as Date },
    });
    const { data } = (
      authCreate.mock.calls[0] as [{ data: { tokenHash: string } }]
    )[0];
    expect(data.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
  });

  it('rechaza igual un token inexistente, revocado, vencido, de otro tipo o de alguien inactivo', async () => {
    const casos = [
      null,
      { ...vigente(), usedAt: new Date() },
      { ...vigente(), expiresAt: new Date('2026-01-01') },
      { ...vigente(), tipo: TipoTokenAuth.RECUPERACION_PASSWORD },
      vigente({ ...docente, activo: false }),
      vigente({ ...docente, rol: 'ADMIN' }),
    ];
    for (const caso of casos) {
      authFindUnique.mockResolvedValueOnce(caso);
      await expect(service.feed('x'.repeat(32), ahora)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
  });

  it('el docente recibe sus clases sin los días suspendidos y sus entregas', async () => {
    authFindUnique.mockResolvedValue(vigente());
    const ics = await service.feed('x'.repeat(32), ahora);

    expect(ics).toContain('SUMMARY:Redes · 8A');
    expect(ics).toContain('DTSTART;TZID=America/Mexico_City:20260902T080000');
    expect(ics).toContain(
      'EXDATE;TZID=America/Mexico_City:20261014T080000,20261118T080000',
    );
    expect(ics).toContain('SUMMARY:Sin clases: Revolución');
    expect(ics).toContain('SUMMARY:Entrega: Práctica 1');
    // 21 oct 05:59 UTC son las 23:59 del 20 en CDMX.
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020');
    expect(
      (horarioFindMany.mock.calls[0] as [{ where: unknown }])[0].where,
    ).toEqual({ docenteId: 36, activo: true });
  });

  it('el alumno sin grupo recibe un calendario vacío pero válido', async () => {
    authFindUnique.mockResolvedValue(
      vigente({ ...docente, id: 39, rol: 'ALUMNO', grupoId: null }),
    );
    tareaFindMany.mockResolvedValue([]);
    const ics = await service.feed('x'.repeat(32), ahora);
    expect(horarioFindMany).not.toHaveBeenCalled();
    expect(ics).toContain('X-WR-CALNAME:SICAT · Mi horario');
    expect(ics).not.toContain('RRULE');
  });
});
