import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  formatearFechaClave,
  obtenerFinDelDia,
  obtenerInicioDelDia,
  parsearFechaClave,
  horarioAplicaEnFecha,
} from '../clases/clases.utils';
import { getCurrentAcademicPeriod } from '../common/periodo.util';

/** Un periodo escolar no dura ni menos de un mes ni más de un año. */
const DIAS_MINIMOS = 30;
const DIAS_MAXIMOS = 366;

/** Un día sin clases tal como lo ve un docente, venga de él o de la institución. */
export type SuspensionVigente = {
  id: number;
  fecha: string;
  motivo: string;
  institucional: boolean;
};

export type SuspensionDeDocente = Omit<SuspensionVigente, 'id'> & {
  /** Prefijado por origen para que no choquen ids de tablas distintas. */
  id: string;
  docenteId: number;
};

@Injectable()
export class PeriodosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Fechas del periodo en curso. Mientras nadie las haya capturado se devuelve
   * un estimado por el calendario (enero–junio o julio–diciembre) marcado con
   * `configurado: false`, para que la interfaz pida las reales en vez de fingir
   * que las sabe.
   */
  async obtenerActual(referencia = new Date()) {
    const clave = getCurrentAcademicPeriod(referencia);
    const guardado = await this.prisma.periodoAcademico.findUnique({
      where: { clave },
    });

    if (guardado) {
      return {
        clave,
        fechaInicio: formatearFechaClave(guardado.fechaInicio),
        fechaFin: formatearFechaClave(guardado.fechaFin),
        configurado: true,
        actualizadoEn: guardado.updatedAt,
      };
    }

    const anio = referencia.getFullYear();
    const primerSemestre = referencia.getMonth() + 1 <= 6;
    return {
      clave,
      fechaInicio: formatearFechaClave(
        new Date(anio, primerSemestre ? 0 : 6, 1),
      ),
      fechaFin: formatearFechaClave(
        new Date(anio, primerSemestre ? 5 : 11, primerSemestre ? 30 : 31),
      ),
      configurado: false,
      actualizadoEn: null,
    };
  }

  /** Límites reales del periodo, ya como fechas locales, para acotar consultas. */
  async obtenerRangoActual(referencia = new Date()) {
    const periodo = await this.obtenerActual(referencia);
    return {
      clave: periodo.clave,
      configurado: periodo.configurado,
      inicio: obtenerInicioDelDia(
        parsearFechaClave(periodo.fechaInicio) as Date,
      ),
      fin: obtenerFinDelDia(parsearFechaClave(periodo.fechaFin) as Date),
    };
  }

  async actualizarActual(
    actorId: number,
    dto: { fechaInicio: string; fechaFin: string },
    referencia = new Date(),
  ) {
    const inicio = parsearFechaClave(dto.fechaInicio);
    const fin = parsearFechaClave(dto.fechaFin);
    if (!inicio || !fin) throw new BadRequestException('Fecha inválida');

    if (fin <= inicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }

    const dias = Math.round((fin.getTime() - inicio.getTime()) / 86400000);
    if (dias < DIAS_MINIMOS) {
      throw new BadRequestException(
        `El periodo debe durar al menos ${DIAS_MINIMOS} días`,
      );
    }
    if (dias > DIAS_MAXIMOS) {
      throw new BadRequestException(
        `El periodo no puede durar más de ${DIAS_MAXIMOS} días`,
      );
    }

    const clave = getCurrentAcademicPeriod(referencia);
    await this.prisma.periodoAcademico.upsert({
      where: { clave },
      create: {
        clave,
        fechaInicio: inicio,
        fechaFin: fin,
        actualizadoPorId: actorId,
      },
      update: {
        fechaInicio: inicio,
        fechaFin: fin,
        actualizadoPorId: actorId,
      },
    });

    return this.obtenerActual(referencia);
  }

  /**
   * Días sin clases del docente en el periodo en curso: los suyos más los que
   * marcó la institución. Si una fecha aparece en ambos manda el institucional,
   * porque el docente no puede levantarlo.
   */
  async listarSuspensiones(
    docenteId: number,
    referencia = new Date(),
  ): Promise<SuspensionVigente[]> {
    const periodo = await this.obtenerActual(referencia);
    const [propias, institucionales] = await Promise.all([
      this.prisma.suspensionClase.findMany({
        where: { docenteId, periodoClave: periodo.clave },
        select: { id: true, fecha: true, motivo: true },
      }),
      this.prisma.suspensionInstitucional.findMany({
        where: { periodoClave: periodo.clave },
        select: { id: true, fecha: true, motivo: true },
      }),
    ]);
    const porFecha = new Map<string, SuspensionVigente>();
    for (const item of propias) {
      porFecha.set(item.fecha, { ...item, institucional: false });
    }
    for (const item of institucionales) {
      porFecha.set(item.fecha, { ...item, institucional: true });
    }
    return [...porFecha.values()].sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
  }

  /** Suspensión vigente para un docente en una fecha, o null si hay clases. */
  async obtenerSuspension(
    docenteId: number,
    fecha: Date,
  ): Promise<SuspensionVigente | null> {
    const clave = formatearFechaClave(fecha);
    const institucional = await this.prisma.suspensionInstitucional.findUnique({
      where: { fecha: clave },
      select: { id: true, fecha: true, motivo: true },
    });
    if (institucional) return { ...institucional, institucional: true };
    const propia = await this.prisma.suspensionClase.findUnique({
      where: { docenteId_fecha: { docenteId, fecha: clave } },
      select: { id: true, fecha: true, motivo: true },
    });
    return propia ? { ...propia, institucional: false } : null;
  }

  /**
   * Qué docentes de la lista no tienen clases en la fecha. Con suspensión
   * institucional son todos; si no, sólo los que marcaron ese día.
   */
  async suspensionesDelDia(fecha: Date, docenteIds: number[]) {
    const resultado = new Map<number, SuspensionVigente>();
    if (!docenteIds.length) return resultado;
    const clave = formatearFechaClave(fecha);
    const institucional = await this.prisma.suspensionInstitucional.findUnique({
      where: { fecha: clave },
      select: { id: true, fecha: true, motivo: true },
    });
    if (institucional) {
      for (const docenteId of docenteIds) {
        resultado.set(docenteId, { ...institucional, institucional: true });
      }
      return resultado;
    }
    const propias = await this.prisma.suspensionClase.findMany({
      where: { fecha: clave, docenteId: { in: docenteIds } },
      select: { id: true, docenteId: true, fecha: true, motivo: true },
    });
    for (const item of propias) {
      resultado.set(item.docenteId, {
        id: item.id,
        fecha: item.fecha,
        motivo: item.motivo,
        institucional: false,
      });
    }
    return resultado;
  }

  /**
   * Suspensiones de varios docentes, opcionalmente acotadas a un rango de
   * claves `YYYY-MM-DD`. Las institucionales se expanden a cada docente para
   * que quien las consuma no tenga que distinguir el origen.
   */
  async listarSuspensionesDeDocentes(
    docenteIds: number[],
    rango?: { gte?: string; lte?: string },
  ): Promise<SuspensionDeDocente[]> {
    if (!docenteIds.length) return [];
    const fecha =
      rango?.gte || rango?.lte
        ? {
            ...(rango.gte ? { gte: rango.gte } : {}),
            ...(rango.lte ? { lte: rango.lte } : {}),
          }
        : undefined;
    const [propias, institucionales] = await Promise.all([
      this.prisma.suspensionClase.findMany({
        where: { docenteId: { in: docenteIds }, ...(fecha ? { fecha } : {}) },
        select: { id: true, docenteId: true, fecha: true, motivo: true },
      }),
      this.prisma.suspensionInstitucional.findMany({
        where: fecha ? { fecha } : {},
        select: { id: true, fecha: true, motivo: true },
      }),
    ]);
    const porClave = new Map<string, SuspensionDeDocente>();
    for (const item of propias) {
      porClave.set(`${item.docenteId}:${item.fecha}`, {
        id: `docente-${item.id}`,
        docenteId: item.docenteId,
        fecha: item.fecha,
        motivo: item.motivo,
        institucional: false,
      });
    }
    for (const item of institucionales) {
      for (const docenteId of docenteIds) {
        porClave.set(`${docenteId}:${item.fecha}`, {
          id: `institucional-${item.id}`,
          docenteId,
          fecha: item.fecha,
          motivo: item.motivo,
          institucional: true,
        });
      }
    }
    return [...porClave.values()];
  }

  async guardarSuspensiones(
    docenteId: number,
    dto: { fechas: string[]; motivo: string },
  ) {
    const { motivo, fechas, periodo } = await this.validarSuspensiones(dto);
    const horarios = await this.prisma.horarioMateria.findMany({
      where: { docenteId, activo: true },
      select: { dias: true },
    });
    const institucionales = new Set(
      (
        await this.prisma.suspensionInstitucional.findMany({
          where: { fecha: { in: fechas } },
          select: { fecha: true },
        })
      ).map((item) => item.fecha),
    );
    for (const clave of fechas) {
      if (institucionales.has(clave)) {
        throw new BadRequestException(
          `El ${clave} ya está marcado sin clases para toda la institución`,
        );
      }
      if (
        !horarios.some((horario) =>
          horarioAplicaEnFecha(horario.dias, parsearFechaClave(clave) as Date),
        )
      ) {
        throw new BadRequestException(
          `No tienes clases programadas el ${clave}`,
        );
      }
    }
    await this.validarSinListasCapturadas(fechas, docenteId);

    await this.prisma.$transaction(
      fechas.map((fecha) =>
        this.prisma.suspensionClase.upsert({
          where: { docenteId_fecha: { docenteId, fecha } },
          create: { docenteId, periodoClave: periodo.clave, fecha, motivo },
          update: { periodoClave: periodo.clave, motivo },
        }),
      ),
    );
    return this.listarSuspensiones(docenteId);
  }

  async eliminarSuspension(docenteId: number, fecha: string) {
    const parsed = parsearFechaClave(fecha);
    if (!parsed || formatearFechaClave(parsed) !== fecha) {
      throw new BadRequestException('Fecha inválida');
    }
    await this.prisma.suspensionClase.deleteMany({
      where: { docenteId, fecha },
    });
    return this.listarSuspensiones(docenteId);
  }

  async listarSuspensionesInstitucionales(referencia = new Date()) {
    const periodo = await this.obtenerActual(referencia);
    return this.prisma.suspensionInstitucional.findMany({
      where: { periodoClave: periodo.clave },
      orderBy: { fecha: 'asc' },
      select: { id: true, fecha: true, motivo: true },
    });
  }

  /** Día sin clases para todos los docentes; sólo el admin lo marca. */
  async guardarSuspensionesInstitucionales(
    actorId: number,
    dto: { fechas: string[]; motivo: string },
  ) {
    const { motivo, fechas, periodo } = await this.validarSuspensiones(dto);
    await this.validarSinListasCapturadas(fechas);

    await this.prisma.$transaction(
      fechas.map((fecha) =>
        this.prisma.suspensionInstitucional.upsert({
          where: { fecha },
          create: {
            periodoClave: periodo.clave,
            fecha,
            motivo,
            creadoPorId: actorId,
          },
          update: { periodoClave: periodo.clave, motivo, creadoPorId: actorId },
        }),
      ),
    );
    return this.listarSuspensionesInstitucionales();
  }

  async eliminarSuspensionInstitucional(fecha: string) {
    const parsed = parsearFechaClave(fecha);
    if (!parsed || formatearFechaClave(parsed) !== fecha) {
      throw new BadRequestException('Fecha inválida');
    }
    await this.prisma.suspensionInstitucional.deleteMany({ where: { fecha } });
    return this.listarSuspensionesInstitucionales();
  }

  /** Motivo y fechas válidas, únicas y dentro del periodo en curso. */
  private async validarSuspensiones(dto: { fechas: string[]; motivo: string }) {
    const motivo = dto.motivo?.trim();
    if (!motivo || motivo.length > 500) {
      throw new BadRequestException(
        'Escribe un motivo de hasta 500 caracteres',
      );
    }
    const fechas = [...new Set(dto.fechas ?? [])].sort();
    if (!fechas.length || fechas.length > 31) {
      throw new BadRequestException('Selecciona entre 1 y 31 fechas');
    }
    const periodo = await this.obtenerActual();
    for (const clave of fechas) {
      const fecha = parsearFechaClave(clave);
      if (!fecha || formatearFechaClave(fecha) !== clave) {
        throw new BadRequestException(`Fecha inválida: ${clave}`);
      }
      if (clave < periodo.fechaInicio || clave > periodo.fechaFin) {
        throw new BadRequestException(
          `${clave} está fuera del periodo escolar`,
        );
      }
    }
    return { motivo, fechas, periodo };
  }

  /**
   * Un día con una clase abierta o con lista ya pasada no se puede suspender:
   * habría asistencias de un día que "no existió". Sin `docenteId` revisa a
   * todos, que es lo que aplica a una suspensión institucional.
   */
  private async validarSinListasCapturadas(
    fechas: string[],
    docenteId?: number,
  ) {
    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        ...(docenteId ? { docenteId } : {}),
        fecha: {
          gte: obtenerInicioDelDia(parsearFechaClave(fechas[0]) as Date),
          lte: obtenerFinDelDia(
            parsearFechaClave(fechas[fechas.length - 1]) as Date,
          ),
        },
      },
      select: {
        fecha: true,
        activa: true,
        _count: { select: { asistencias: true } },
      },
    });
    for (const clave of fechas) {
      if (
        sesiones.some(
          (sesion) =>
            formatearFechaClave(sesion.fecha) === clave &&
            (sesion.activa || sesion._count.asistencias > 0),
        )
      ) {
        throw new ConflictException(
          `El ${clave} tiene una clase activa o asistencias capturadas`,
        );
      }
    }
  }
}
