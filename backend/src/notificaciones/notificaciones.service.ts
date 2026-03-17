import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TipoNotificacion } from '@prisma/client';

interface CrearNotificacionDto {
  usuarioId: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  referenciaId?: number;
  referenciaTipo?: string;
}

@Injectable()
export class NotificacionesService {
  constructor(private prisma: PrismaService) {}

  async crear(dto: CrearNotificacionDto) {
    return this.prisma.notificacion.create({ data: dto });
  }

  async crearParaVarios(usuarioIds: number[], data: Omit<CrearNotificacionDto, 'usuarioId'>) {
    if (!usuarioIds.length) return;
    return this.prisma.notificacion.createMany({
      data: usuarioIds.map((usuarioId) => ({ ...data, usuarioId })),
    });
  }

  async obtenerPorUsuario(usuarioId: number, skip = 0, take = 20) {
    const [items, total] = await Promise.all([
      this.prisma.notificacion.findMany({
        where: { usuarioId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notificacion.count({ where: { usuarioId } }),
    ]);
    return { items, total, skip, take };
  }

  async contarNoLeidas(usuarioId: number) {
    return this.prisma.notificacion.count({ where: { usuarioId, leida: false } });
  }

  async marcarLeida(id: number, usuarioId: number) {
    return this.prisma.notificacion.update({
      where: { id, usuarioId },
      data: { leida: true },
    });
  }

  async marcarTodasLeidas(usuarioId: number) {
    return this.prisma.notificacion.updateMany({
      where: { usuarioId, leida: false },
      data: { leida: true },
    });
  }
}
