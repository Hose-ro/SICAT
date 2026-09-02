import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  convertirFechaAMinutos,
  convertirHoraAMinutos,
  horarioAplicaEnFecha,
  obtenerFinDelDia,
  obtenerInicioDelDia,
} from './clases.utils';

const MINUTOS_ANTICIPACION_MIN = 5;
const MINUTOS_ANTICIPACION_MAX = 10;

/**
 * Avisa a cada docente, dentro de la ventana de 5 a 10 minutos previos,
 * que una clase de su horario está por comenzar.
 */
@Injectable()
export class RecordatoriosClaseService {
  private readonly logger = new Logger(RecordatoriosClaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async enviarRecordatorios() {
    try {
      await this.procesar(new Date());
    } catch (error) {
      this.logger.error(
        'No se pudieron generar los recordatorios de clase',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async procesar(referencia: Date) {
    const minutosActuales = convertirFechaAMinutos(referencia);
    const inicioDia = obtenerInicioDelDia(referencia);
    const finDia = obtenerFinDelDia(referencia);

    const horarios = await this.prisma.horarioMateria.findMany({
      where: { activo: true, docente: { activo: true } },
      select: {
        id: true,
        dias: true,
        horaInicio: true,
        docenteId: true,
        materia: { select: { nombre: true } },
        grupo: { select: { nombre: true } },
        aula: { select: { nombre: true } },
      },
    });

    const candidatos = horarios.filter((horario) => {
      if (!horarioAplicaEnFecha(horario.dias, referencia)) return false;
      const faltan = convertirHoraAMinutos(horario.horaInicio) - minutosActuales;
      return (
        faltan >= MINUTOS_ANTICIPACION_MIN && faltan <= MINUTOS_ANTICIPACION_MAX
      );
    });

    for (const horario of candidatos) {
      const faltan = convertirHoraAMinutos(horario.horaInicio) - minutosActuales;

      const sesionExistente = await this.prisma.claseSesion.findFirst({
        where: {
          horarioMateriaId: horario.id,
          fecha: { gte: inicioDia, lte: finDia },
        },
        select: { id: true },
      });
      if (sesionExistente) continue;

      const yaNotificadoHoy = await this.prisma.notificacion.findFirst({
        where: {
          usuarioId: horario.docenteId,
          tipo: TipoNotificacion.CLASE_POR_INICIAR,
          referenciaId: horario.id,
          referenciaTipo: 'HorarioMateria',
          createdAt: { gte: inicioDia },
        },
        select: { id: true },
      });
      if (yaNotificadoHoy) continue;

      await this.notificaciones.crear({
        usuarioId: horario.docenteId,
        tipo: TipoNotificacion.CLASE_POR_INICIAR,
        titulo: `Tu clase de ${horario.materia.nombre} inicia en ${faltan} min`,
        mensaje: `${horario.materia.nombre}${horario.grupo ? ` · ${horario.grupo.nombre}` : ''} inicia a las ${horario.horaInicio}${horario.aula ? ` en ${horario.aula.nombre}` : ''}.`,
        referenciaId: horario.id,
        referenciaTipo: 'HorarioMateria',
      });
    }
  }
}
