import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from '../periodos/periodos.service';
import { AvisosService } from '../avisos/avisos.service';
import { ClasesJustificadasService } from './clases-justificadas.service';

// 2026-10-21 es miércoles.
const FECHA = '2026-10-21';

describe('ClasesJustificadasService', () => {
  const reunionFindUnique = jest.fn();
  const horarioFindMany = jest.fn();
  const justificadaFindMany = jest.fn();
  const justificadaUpsert = jest.fn();
  const sesionFindMany = jest.fn();
  const suspensionesDelDia = jest.fn();
  const avisarSuspensiones = jest.fn();
  const prisma = {
    reunionAcademica: { findUnique: reunionFindUnique },
    horarioMateria: { findMany: horarioFindMany },
    claseJustificada: {
      findMany: justificadaFindMany,
      upsert: justificadaUpsert,
    },
    claseSesion: { findMany: sesionFindMany },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  } as unknown as PrismaService;
  const service = new ClasesJustificadasService(
    prisma,
    { suspensionesDelDia } as unknown as PeriodosService,
    { avisarSuspensiones } as unknown as AvisosService,
  );

  const horario = (id: number, horaInicio: string, horaFin: string) => ({
    id,
    docenteId: 31,
    dias: 'MIERCOLES',
    horaInicio,
    horaFin,
    materia: { id: id * 10, nombre: `Materia ${id}`, clave: `M${id}` },
    grupo: { id: 2, nombre: '3A' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    reunionFindUnique.mockResolvedValue({
      id: 5,
      fecha: FECHA,
      horaInicio: '10:00',
      horaFin: '12:00',
      estado: 'PROGRAMADA',
      convocados: [{ docenteId: 31 }],
    });
    horarioFindMany.mockResolvedValue([
      horario(1, '08:00', '10:00'), // termina justo al empezar: no choca
      horario(2, '11:00', '13:00'),
      horario(3, '12:00', '14:00'), // empieza justo al terminar: no choca
    ]);
    justificadaFindMany.mockResolvedValue([]);
    sesionFindMany.mockResolvedValue([]);
    suspensionesDelDia.mockResolvedValue(new Map());
    justificadaUpsert.mockImplementation((args: unknown) =>
      Promise.resolve(args),
    );
  });

  it('solo cuenta como choque la clase que se traslapa con la reunión', async () => {
    const choques = await service.choques([31], {
      id: 5,
      fecha: FECHA,
      horaInicio: '10:00',
      horaFin: '12:00',
    });
    expect(choques.get(31)?.map((c) => c.horarioId)).toEqual([2]);
  });

  it('justifica la clase y avisa a los alumnos como un día sin clases', async () => {
    await service.justificar(31, 5, {
      horarioIds: [2],
      motivo: 'Reunión de academia',
    });
    expect(justificadaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { horarioId_fecha: { horarioId: 2, fecha: FECHA } },
        create: expect.objectContaining({
          docenteId: 31,
          reunionId: 5,
          motivo: 'Reunión de academia',
        }) as unknown,
      }),
    );
    expect(avisarSuspensiones).toHaveBeenCalledWith(
      31,
      [FECHA],
      'Reunión de academia',
      [2],
    );
  });

  it('rechaza justificar una clase que no se cruza', async () => {
    await expect(
      service.justificar(31, 5, { horarioIds: [1], motivo: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(justificadaUpsert).not.toHaveBeenCalled();
  });

  it('rechaza justificar una clase con lista ya pasada', async () => {
    sesionFindMany.mockResolvedValue([
      { horarioMateriaId: 2, activa: false, _count: { asistencias: 12 } },
    ]);
    await expect(
      service.justificar(31, 5, { horarioIds: [2], motivo: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('solo justifica quien está convocado y si la reunión sigue en pie', async () => {
    reunionFindUnique.mockResolvedValueOnce({
      id: 5,
      fecha: FECHA,
      horaInicio: '10:00',
      horaFin: '12:00',
      estado: 'PROGRAMADA',
      convocados: [],
    });
    await expect(
      service.justificar(40, 5, { horarioIds: [2], motivo: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    reunionFindUnique.mockResolvedValueOnce({
      id: 5,
      fecha: FECHA,
      horaInicio: '10:00',
      horaFin: '12:00',
      estado: 'CANCELADA',
      convocados: [{ docenteId: 31 }],
    });
    await expect(
      service.justificar(31, 5, { horarioIds: [2], motivo: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
