import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAulaDto } from './dto/create-aula.dto';
import { UpdateAulaDto } from './dto/update-aula.dto';

@Injectable()
export class AulasService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateAulaDto) {
    return this.prisma.aula.create({ data: dto });
  }

  findAll() {
    return this.prisma.aula.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const aula = await this.prisma.aula.findUnique({ where: { id } });
    if (!aula) throw new NotFoundException('Aula no encontrada');
    return aula;
  }

  async update(id: number, dto: UpdateAulaDto) {
    await this.findOne(id);
    return this.prisma.aula.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.aula.update({ where: { id }, data: { activo: false } });
  }
}
