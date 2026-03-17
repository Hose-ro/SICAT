import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CarrerasService {
  constructor(private prisma: PrismaService) {}

  create(nombre: string, codigo: string) {
    return this.prisma.carrera.create({ data: { nombre, codigo } });
  }

  findAll() {
    return this.prisma.carrera.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
    });
  }

  async remove(id: number) {
    const c = await this.prisma.carrera.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Carrera no encontrada');
    return this.prisma.carrera.delete({ where: { id } });
  }
}
