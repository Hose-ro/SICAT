import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  asegurarAccesoMateria,
  ActorMateria,
} from '../common/materia-ownership';
import { EditarFechasUnidadDto } from './dto/editar-fechas-unidad.dto';
import { resolverFechaHoraLimite } from '../common/zona-horaria.util';

@Injectable()
export class UnidadesService {
  constructor(private prisma: PrismaService) {}

  async iniciar(id: number, actor: ActorMateria) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    await asegurarAccesoMateria(this.prisma, actor, unidad.materiaId);
    if (unidad.status !== 'PENDIENTE')
      throw new BadRequestException('La unidad ya fue iniciada');

    const unidadActiva = await this.prisma.unidad.findFirst({
      where: {
        materiaId: unidad.materiaId,
        status: 'ACTIVA',
        id: { not: id },
      },
    });

    if (unidadActiva) {
      throw new ConflictException(
        'Ya existe una unidad activa para esta materia',
      );
    }

    return this.prisma.unidad.update({
      where: { id },
      data: { status: 'ACTIVA', fechaInicio: new Date() },
    });
  }

  /**
   * Deshace un "iniciar" hecho por error: solo aplica a una unidad ACTIVA,
   * que no tiene todavía fechaFin ni depende de que otra unidad se cierre.
   */
  async cancelar(id: number, actor: ActorMateria) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    await asegurarAccesoMateria(this.prisma, actor, unidad.materiaId);
    if (unidad.status !== 'ACTIVA')
      throw new BadRequestException('Solo se puede cancelar una unidad activa');

    return this.prisma.unidad.update({
      where: { id },
      data: { status: 'PENDIENTE', fechaInicio: null },
    });
  }

  /**
   * Deshace un "finalizar": la última unidad FINALIZADA vuelve a ACTIVA. Solo
   * si no hay otra activa y ninguna posterior se ha iniciado, para no romper
   * el orden de las unidades.
   */
  async reabrir(id: number, actor: ActorMateria) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    await asegurarAccesoMateria(this.prisma, actor, unidad.materiaId);
    if (unidad.status !== 'FINALIZADA')
      throw new BadRequestException(
        'Solo se puede reabrir una unidad finalizada',
      );

    const unidadActiva = await this.prisma.unidad.findFirst({
      where: { materiaId: unidad.materiaId, status: 'ACTIVA' },
    });
    if (unidadActiva) {
      throw new ConflictException(
        `Primero cancela o finaliza ${unidadActiva.nombre}`,
      );
    }

    const posteriorIniciada = await this.prisma.unidad.findFirst({
      where: {
        materiaId: unidad.materiaId,
        orden: { gt: unidad.orden },
        status: { not: 'PENDIENTE' },
      },
    });
    if (posteriorIniciada) {
      throw new ConflictException(
        'Solo se puede reabrir la última unidad finalizada',
      );
    }

    return this.prisma.unidad.update({
      where: { id },
      data: { status: 'ACTIVA', fechaFin: null },
    });
  }

  async editarFechas(
    id: number,
    actor: ActorMateria,
    dto: EditarFechasUnidadDto,
  ) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    await asegurarAccesoMateria(this.prisma, actor, unidad.materiaId);

    // El docente escribe la fecha en hora de pared del plantel; en Render el
    // proceso corre en UTC, así que hay que anclarla a esa zona (ver zona-horaria.util).
    const fechaInicio =
      dto.fechaInicio !== undefined
        ? resolverFechaHoraLimite(dto.fechaInicio)
        : unidad.fechaInicio;
    const fechaFin =
      dto.fechaFin !== undefined
        ? resolverFechaHoraLimite(dto.fechaFin)
        : unidad.fechaFin;

    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }

    return this.prisma.unidad.update({
      where: { id },
      data: {
        ...(dto.fechaInicio !== undefined ? { fechaInicio } : {}),
        ...(dto.fechaFin !== undefined ? { fechaFin } : {}),
      },
    });
  }

  async finalizar(id: number, actor: ActorMateria) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    await asegurarAccesoMateria(this.prisma, actor, unidad.materiaId);
    if (unidad.status !== 'ACTIVA')
      throw new BadRequestException('La unidad no está activa');
    return this.prisma.unidad.update({
      where: { id },
      data: { status: 'FINALIZADA', fechaFin: new Date() },
    });
  }

  async findByMateria(materiaId: number, actor: ActorMateria) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId);
    return this.prisma.unidad.findMany({
      where: { materiaId },
      orderBy: { orden: 'asc' },
    });
  }
}
