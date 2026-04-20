import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  EstadoRevision,
  EstadoTarea,
  Rol,
  TipoNotificacion,
} from '@prisma/client';
import { getCurrentAcademicPeriod } from '../common/periodo.util';

interface CrearNotificacionDto {
  usuarioId: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  referenciaId?: number;
  referenciaTipo?: string;
}

interface ListarNotificacionesOptions {
  skip?: number;
  take?: number;
  soloNoLeidas?: boolean;
}

const ESTADOS_CON_ENTREGA = new Set<EstadoRevision>([
  EstadoRevision.PENDIENTE,
  EstadoRevision.ENTREGADA,
  EstadoRevision.REVISADA,
  EstadoRevision.CALIFICADA,
  EstadoRevision.INCORRECTA,
]);

@Injectable()
export class NotificacionesService {
  constructor(private prisma: PrismaService) {}

  async crear(dto: CrearNotificacionDto) {
    return this.prisma.notificacion.create({ data: dto });
  }

  async crearSiNoExisteNoLeida(dto: CrearNotificacionDto) {
    const existente = await this.prisma.notificacion.findFirst({
      where: {
        usuarioId: dto.usuarioId,
        tipo: dto.tipo,
        leida: false,
        referenciaId: dto.referenciaId ?? undefined,
        referenciaTipo: dto.referenciaTipo ?? undefined,
      },
      select: { id: true },
    });

    if (existente) {
      return null;
    }

    return this.crear(dto);
  }

  async crearParaVarios(
    usuarioIds: number[],
    data: Omit<CrearNotificacionDto, 'usuarioId'>,
  ) {
    const ids = [...new Set(usuarioIds)].filter(Boolean);
    if (!ids.length) return;
    return this.prisma.notificacion.createMany({
      data: ids.map((usuarioId) => ({ ...data, usuarioId })),
    });
  }

  async crearParaAdmins(
    data: Omit<CrearNotificacionDto, 'usuarioId'>,
    excluirIds: number[] = [],
  ) {
    const adminIds = await this.obtenerAdminIds(excluirIds);
    return this.crearParaVarios(adminIds, data);
  }

  async obtenerPorUsuario(
    usuarioId: number,
    options: ListarNotificacionesOptions = {},
  ) {
    await this.sincronizarAutomaticas(usuarioId);

    const skip = options.skip ?? 0;
    const take = options.take ?? 20;
    const where = {
      usuarioId,
      ...(options.soloNoLeidas ? { leida: false } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notificacion.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async contarNoLeidas(usuarioId: number) {
    await this.sincronizarAutomaticas(usuarioId);
    return this.prisma.notificacion.count({
      where: { usuarioId, leida: false },
    });
  }

  async marcarLeida(id: number, usuarioId: number) {
    const updated = await this.prisma.notificacion.updateMany({
      where: { id, usuarioId },
      data: { leida: true },
    });

    if (!updated.count) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return this.prisma.notificacion.findUnique({ where: { id } });
  }

  async marcarTodasLeidas(usuarioId: number) {
    return this.prisma.notificacion.updateMany({
      where: { usuarioId, leida: false },
      data: { leida: true },
    });
  }

  async eliminar(id: number, usuarioId: number) {
    const deleted = await this.prisma.notificacion.deleteMany({
      where: { id, usuarioId },
    });

    if (!deleted.count) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return { deleted: true, id };
  }

  private async obtenerAdminIds(excluirIds: number[] = []) {
    const admins = await this.prisma.usuario.findMany({
      where: {
        rol: Rol.ADMIN,
        activo: true,
        ...(excluirIds.length ? { id: { notIn: excluirIds } } : {}),
      },
      select: { id: true },
    });

    return admins.map((item) => item.id);
  }

  private async sincronizarAutomaticas(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, rol: true, grupoId: true, activo: true },
    });

    if (!usuario?.activo) {
      return;
    }

    if (usuario.rol === Rol.ALUMNO) {
      await this.generarRecordatoriosFechaLimite(usuario.id, usuario.grupoId);
      return;
    }

    if (usuario.rol === Rol.DOCENTE) {
      await this.generarPendientesRevision(usuario.id);
    }
  }

  private async generarRecordatoriosFechaLimite(
    alumnoId: number,
    grupoId?: number | null,
  ) {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const periodo = getCurrentAcademicPeriod();

    const tareas = await this.prisma.tarea.findMany({
      where: {
        activa: true,
        estado: EstadoTarea.PUBLICADA,
        tieneFechaLimite: true,
        fechaLimite: {
          gte: ahora,
          lte: limite,
        },
        materia: {
          inscripciones: {
            some: {
              alumnoId,
              estado: 'ACEPTADA',
              periodo,
            },
          },
        },
      },
      select: {
        id: true,
        titulo: true,
        fechaLimite: true,
        grupoId: true,
      },
    });

    const tareasVisibles = tareas.filter(
      (tarea) => !tarea.grupoId || tarea.grupoId === grupoId,
    );
    if (!tareasVisibles.length) {
      return;
    }

    const entregaIds = new Set(
      (
        await this.prisma.entregaTarea.findMany({
          where: {
            alumnoId,
            tareaId: { in: tareasVisibles.map((item) => item.id) },
            estadoRevision: {
              in: Array.from(ESTADOS_CON_ENTREGA),
            },
          },
          select: { tareaId: true },
        })
      ).map((entrega) => entrega.tareaId),
    );

    const notificacionesExistentes = new Set(
      (
        await this.prisma.notificacion.findMany({
          where: {
            usuarioId: alumnoId,
            tipo: TipoNotificacion.RECORDATORIO_FECHA_LIMITE,
            referenciaId: { in: tareasVisibles.map((item) => item.id) },
          },
          select: { referenciaId: true },
        })
      )
        .map((item) => item.referenciaId)
        .filter((value): value is number => typeof value === 'number'),
    );

    const pendientes = tareasVisibles.filter(
      (tarea) =>
        !entregaIds.has(tarea.id) && !notificacionesExistentes.has(tarea.id),
    );
    if (!pendientes.length) {
      return;
    }

    await this.prisma.notificacion.createMany({
      data: pendientes.map((tarea) => ({
        usuarioId: alumnoId,
        tipo: TipoNotificacion.RECORDATORIO_FECHA_LIMITE,
        titulo: `Recordatorio: ${tarea.titulo}`,
        mensaje: `La tarea ${tarea.titulo} vence pronto.`,
        referenciaId: tarea.id,
        referenciaTipo: 'Tarea',
      })),
    });
  }

  private async generarPendientesRevision(docenteId: number) {
    const pendienteExistente = await this.prisma.notificacion.findFirst({
      where: {
        usuarioId: docenteId,
        tipo: TipoNotificacion.TAREAS_PENDIENTES_REVISION,
        leida: false,
      },
      select: { id: true },
    });

    if (pendienteExistente) {
      return;
    }

    const pendientes = await this.prisma.entregaTarea.count({
      where: {
        estadoRevision: {
          in: [EstadoRevision.PENDIENTE, EstadoRevision.ENTREGADA],
        },
        tarea: {
          docenteId,
        },
      },
    });

    if (!pendientes) {
      return;
    }

    await this.crear({
      usuarioId: docenteId,
      tipo: TipoNotificacion.TAREAS_PENDIENTES_REVISION,
      titulo: 'Tareas pendientes de revisar',
      mensaje: `Tienes ${pendientes} entrega(s) pendientes de revisar.`,
      referenciaTipo: 'TareasPendientes',
    });
  }
}
