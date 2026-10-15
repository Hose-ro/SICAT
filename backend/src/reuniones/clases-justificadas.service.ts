import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from '../periodos/periodos.service';
import { AvisosService } from '../avisos/avisos.service';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import {
  convertirHoraAMinutos,
  horarioAplicaEnFecha,
  obtenerFinDelDia,
  obtenerInicioDelDia,
  parsearFechaClave,
} from '../clases/clases.utils';

/** Duración que se asume cuando la convocatoria no dice a qué hora termina. */
export const DURACION_REUNION_DEFAULT_MIN = 60;

type ReunionAgenda = {
  id: number;
  fecha: string;
  horaInicio: string;
  horaFin: string | null;
};

/** Una clase del docente que se cruza con la reunión. */
export type ChoqueReunion = {
  horarioId: number;
  materia: { id: number; nombre: string; clave: string };
  grupo: { id: number; nombre: string } | null;
  horaInicio: string;
  horaFin: string;
  /** Ya justificada (por esta u otra reunión a la misma hora). */
  justificacion: { motivo: string; reunionId: number; creadaEn: Date } | null;
  /** Ese día ya no hay clases (festivo o día marcado): nada que justificar. */
  sinClases: string | null;
  /** Ya hay lista pasada o una sesión abierta: la clase sí se dio. */
  listaCapturada: boolean;
};

const minutosDeReunion = (r: ReunionAgenda) => {
  const inicio = convertirHoraAMinutos(r.horaInicio);
  return {
    inicio,
    fin: r.horaFin
      ? convertirHoraAMinutos(r.horaFin)
      : inicio + DURACION_REUNION_DEFAULT_MIN,
  };
};

/**
 * Clases que el docente no imparte porque se cruzan con una reunión de
 * academia a la que fue convocado. Justificar una clase la deja como un día
 * sin clases, pero sólo para ese horario: no se cuenta como pendiente, no se
 * recuerda y los alumnos reciben el aviso, igual que con un festivo.
 */
@Injectable()
export class ClasesJustificadasService {
  constructor(
    private prisma: PrismaService,
    private periodos: PeriodosService,
    private avisos: AvisosService,
  ) {}

  /** Clases de cada docente que se cruzan con la reunión. */
  async choques(
    docenteIds: number[],
    reunion: ReunionAgenda,
  ): Promise<Map<number, ChoqueReunion[]>> {
    const resultado = new Map<number, ChoqueReunion[]>();
    const fecha = parsearFechaClave(reunion.fecha);
    if (!docenteIds.length || !fecha) return resultado;
    const agenda = minutosDeReunion(reunion);

    const horarios = (
      await this.prisma.horarioMateria.findMany({
        where: {
          docenteId: { in: docenteIds },
          activo: true,
          grupoId: { not: null },
        },
        select: {
          id: true,
          docenteId: true,
          dias: true,
          horaInicio: true,
          horaFin: true,
          materia: { select: { id: true, nombre: true, clave: true } },
          grupo: { select: { id: true, nombre: true } },
        },
        orderBy: { horaInicio: 'asc' },
      })
    ).filter(
      (h) =>
        horarioAplicaEnFecha(h.dias, fecha) &&
        convertirHoraAMinutos(h.horaInicio) < agenda.fin &&
        agenda.inicio < convertirHoraAMinutos(h.horaFin),
    );
    if (!horarios.length) return resultado;

    const horarioIds = horarios.map((h) => h.id);
    const [suspendidos, justificadas, sesiones] = await Promise.all([
      this.periodos.suspensionesDelDia(fecha, [
        ...new Set(horarios.map((h) => h.docenteId)),
      ]),
      this.prisma.claseJustificada.findMany({
        where: { horarioId: { in: horarioIds }, fecha: reunion.fecha },
        select: {
          horarioId: true,
          motivo: true,
          reunionId: true,
          createdAt: true,
        },
      }),
      this.prisma.claseSesion.findMany({
        where: {
          horarioMateriaId: { in: horarioIds },
          fecha: {
            gte: obtenerInicioDelDia(fecha),
            lte: obtenerFinDelDia(fecha),
          },
        },
        select: {
          horarioMateriaId: true,
          activa: true,
          _count: { select: { asistencias: true } },
        },
      }),
    ]);

    for (const h of horarios) {
      const justificada = justificadas.find((j) => j.horarioId === h.id);
      const lista = resultado.get(h.docenteId) ?? [];
      lista.push({
        horarioId: h.id,
        materia: h.materia,
        grupo: h.grupo,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        justificacion: justificada
          ? {
              motivo: justificada.motivo,
              reunionId: justificada.reunionId,
              creadaEn: justificada.createdAt,
            }
          : null,
        sinClases: suspendidos.get(h.docenteId)?.motivo ?? null,
        listaCapturada: sesiones.some(
          (s) =>
            s.horarioMateriaId === h.id &&
            (s.activa || s._count.asistencias > 0),
        ),
      });
      resultado.set(h.docenteId, lista);
    }
    return resultado;
  }

  /** El docente justifica que no dará (o no dio) esas clases por la reunión. */
  async justificar(
    docenteId: number,
    reunionId: number,
    dto: { horarioIds: number[]; motivo: string },
  ) {
    const reunion = await this.reunionDelConvocado(docenteId, reunionId);
    const motivo = dto.motivo.trim();
    const choques = (await this.choques([docenteId], reunion)).get(docenteId);
    const elegidas = [...new Set(dto.horarioIds)].map((horarioId) => {
      const choque = choques?.find((c) => c.horarioId === horarioId);
      if (!choque) {
        throw new BadRequestException(
          'Solo puedes justificar clases que se cruzan con la reunión',
        );
      }
      if (choque.sinClases) {
        throw new ConflictException(
          `Ese día ya no hay clases: ${choque.sinClases}`,
        );
      }
      if (choque.listaCapturada) {
        throw new ConflictException(
          `Ya pasaste lista de ${choque.materia.nombre}; esa clase sí se dio`,
        );
      }
      return choque;
    });

    const periodoClave = getCurrentAcademicPeriod(
      parsearFechaClave(reunion.fecha) as Date,
    );
    await this.prisma.$transaction(
      elegidas.map((c) =>
        this.prisma.claseJustificada.upsert({
          where: {
            horarioId_fecha: { horarioId: c.horarioId, fecha: reunion.fecha },
          },
          create: {
            periodoClave,
            docenteId,
            horarioId: c.horarioId,
            reunionId,
            fecha: reunion.fecha,
            motivo,
          },
          update: { reunionId, motivo },
        }),
      ),
    );
    await this.avisos.avisarSuspensiones(
      docenteId,
      [reunion.fecha],
      motivo,
      elegidas.map((c) => c.horarioId),
    );
    return (await this.choques([docenteId], reunion)).get(docenteId) ?? [];
  }

  /** El docente retira la justificación: la clase vuelve a darse. */
  async quitar(docenteId: number, reunionId: number, horarioId: number) {
    const reunion = await this.reunionDelConvocado(docenteId, reunionId, {
      permitirCancelada: true,
    });
    const justificada = await this.prisma.claseJustificada.findFirst({
      where: { docenteId, horarioId, fecha: reunion.fecha },
      select: { id: true },
    });
    if (!justificada) {
      throw new NotFoundException('Esa clase no está justificada');
    }
    await this.borrar([justificada.id]);
    return (await this.choques([docenteId], reunion)).get(docenteId) ?? [];
  }

  /**
   * Justificaciones que dejan de valer porque la reunión se canceló, cambió de
   * horario o el docente ya no está convocado. Las borra, avisa a los alumnos
   * que sí hay clase y devuelve qué clases se retiraron, por docente.
   */
  async retirarInvalidas(
    reunion: ReunionAgenda & { estado: string },
    convocados: number[],
  ) {
    const actuales = await this.prisma.claseJustificada.findMany({
      where: { reunionId: reunion.id },
      select: {
        id: true,
        docenteId: true,
        horarioId: true,
        fecha: true,
        horario: {
          select: {
            horaInicio: true,
            materia: { select: { nombre: true } },
            grupo: { select: { nombre: true } },
          },
        },
      },
    });
    if (!actuales.length) return new Map<number, string[]>();

    const vigentes =
      reunion.estado === 'CANCELADA'
        ? new Map<number, ChoqueReunion[]>()
        : await this.choques(convocados, reunion);
    const invalidas = actuales.filter(
      (j) =>
        j.fecha !== reunion.fecha ||
        !vigentes.get(j.docenteId)?.some((c) => c.horarioId === j.horarioId),
    );
    await this.borrar(invalidas.map((j) => j.id));

    const porDocente = new Map<number, string[]>();
    for (const j of invalidas) {
      porDocente.set(j.docenteId, [
        ...(porDocente.get(j.docenteId) ?? []),
        `${j.horario.materia.nombre} (${j.horario.grupo ? `${j.horario.grupo.nombre}, ` : ''}${j.horario.horaInicio})`,
      ]);
    }
    return porDocente;
  }

  /**
   * Borra justificaciones y retira el aviso "no hay clase" de cada una, salvo
   * que ese día siga sin clases por otra razón.
   */
  private async borrar(ids: number[]) {
    if (!ids.length) return;
    const filas = await this.prisma.claseJustificada.findMany({
      where: { id: { in: ids } },
      select: {
        docenteId: true,
        fecha: true,
        horario: { select: { materiaId: true, grupoId: true } },
      },
    });
    await this.prisma.claseJustificada.deleteMany({
      where: { id: { in: ids } },
    });
    for (const fila of filas) {
      if (!fila.horario.grupoId) continue;
      const fecha = parsearFechaClave(fila.fecha);
      if (!fecha) continue;
      if (await this.periodos.obtenerSuspension(fila.docenteId, fecha)) {
        continue;
      }
      const otra = await this.prisma.claseJustificada.count({
        where: {
          docenteId: fila.docenteId,
          fecha: fila.fecha,
          horario: {
            materiaId: fila.horario.materiaId,
            grupoId: fila.horario.grupoId,
          },
        },
      });
      if (otra) continue;
      await this.avisos.retirarAvisosDeSuspension(fila.docenteId, fila.fecha, {
        materiaId: fila.horario.materiaId,
        grupoId: fila.horario.grupoId,
      });
    }
  }

  private async reunionDelConvocado(
    docenteId: number,
    reunionId: number,
    { permitirCancelada = false } = {},
  ) {
    const reunion = await this.prisma.reunionAcademica.findUnique({
      where: { id: reunionId },
      select: {
        id: true,
        fecha: true,
        horaInicio: true,
        horaFin: true,
        estado: true,
        convocados: { where: { docenteId }, select: { docenteId: true } },
      },
    });
    if (!reunion) throw new NotFoundException('Reunión no encontrada');
    if (!reunion.convocados.length) {
      throw new ForbiddenException('No estás convocado a esta reunión');
    }
    if (!permitirCancelada && reunion.estado === 'CANCELADA') {
      throw new ConflictException(
        'La reunión se canceló: la clase se imparte normalmente',
      );
    }
    return reunion;
  }
}
