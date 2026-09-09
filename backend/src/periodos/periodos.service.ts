import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  formatearFechaClave,
  obtenerFinDelDia,
  obtenerInicioDelDia,
  parsearFechaClave,
} from '../clases/clases.utils';
import { getCurrentAcademicPeriod } from '../common/periodo.util';

/** Un periodo escolar no dura ni menos de un mes ni más de un año. */
const DIAS_MINIMOS = 30;
const DIAS_MAXIMOS = 366;

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
}
