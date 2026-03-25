import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UnidadesService {
  constructor(private prisma: PrismaService) {}

  async iniciar(id: number) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
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

  async finalizar(id: number) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    if (unidad.status !== 'ACTIVA')
      throw new BadRequestException('La unidad no está activa');
    return this.prisma.unidad.update({
      where: { id },
      data: { status: 'FINALIZADA', fechaFin: new Date() },
    });
  }

  findByMateria(materiaId: number) {
    return this.prisma.unidad.findMany({
      where: { materiaId },
      orderBy: { orden: 'asc' },
    });
  }
}
