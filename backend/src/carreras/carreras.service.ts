import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateCarreraDto } from './dto/create-carrera.dto';
import { MateriaReticulaImportada } from './reticula-import';

@Injectable()
export class CarrerasService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCarreraDto, materias: MateriaReticulaImportada[]) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const carrera = await tx.carrera.create({
          data: {
            nombre: dto.nombre.trim(),
            codigo: dto.codigo.trim().toUpperCase(),
            planEstudios: dto.planEstudios?.trim() || null,
          },
        });

        await tx.reticulaMateria.createMany({
          data: materias.map((materia) => ({
            ...materia,
            carreraId: carrera.id,
            activo: true,
          })),
        });

        return tx.carrera.findUniqueOrThrow({
          where: { id: carrera.id },
          include: {
            _count: { select: { usuarios: true, reticulaMaterias: true } },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una carrera con ese nombre o código',
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.carrera.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { usuarios: true, reticulaMaterias: true },
        },
      },
    });
  }

  async remove(id: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const carrera = await tx.carrera.findUnique({ where: { id } });
        if (!carrera) throw new NotFoundException('Carrera no encontrada');

        await tx.reticulaMateria.deleteMany({ where: { carreraId: id } });
        return tx.carrera.delete({ where: { id } });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar la carrera porque tiene usuarios, grupos, materias u horarios relacionados',
        );
      }
      throw error;
    }
  }
}
