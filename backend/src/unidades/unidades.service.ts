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
