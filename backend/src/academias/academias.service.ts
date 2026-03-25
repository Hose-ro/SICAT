import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAcademiaDto } from './dto/create-academia.dto';
import { UpdateAcademiaDto } from './dto/update-academia.dto';

const INCLUDE_DETAIL = {
  docentes: { select: { id: true, nombre: true, email: true } },
  materias: { select: { id: true, nombre: true, clave: true, semestre: true } },
};

@Injectable()
export class AcademiasService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAcademiaDto) {
    const existe = await this.prisma.academia.findUnique({
      where: { nombre: dto.nombre },
    });
    if (existe)
      throw new ConflictException('Ya existe una academia con ese nombre');
    return this.prisma.academia.create({ data: dto });
  }

  findAll() {
    return this.prisma.academia.findMany({
      where: { activo: true },
      include: { _count: { select: { docentes: true, materias: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const academia = await this.prisma.academia.findUnique({
      where: { id },
      include: INCLUDE_DETAIL,
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');
    return academia;
  }

  async update(id: number, dto: UpdateAcademiaDto) {
    const academia = await this.prisma.academia.findUnique({ where: { id } });
    if (!academia) throw new NotFoundException('Academia no encontrada');
    if (dto.nombre && dto.nombre !== academia.nombre) {
      const existe = await this.prisma.academia.findUnique({
        where: { nombre: dto.nombre },
      });
      if (existe)
        throw new ConflictException('Ya existe una academia con ese nombre');
    }
    return this.prisma.academia.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    const academia = await this.prisma.academia.findUnique({ where: { id } });
    if (!academia) throw new NotFoundException('Academia no encontrada');
    return this.prisma.academia.update({
      where: { id },
      data: { activo: false },
    });
  }

  async asignarDocentes(academiaId: number, docenteIds: number[]) {
    const academia = await this.prisma.academia.findUnique({
      where: { id: academiaId },
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');

    const docentes = await this.prisma.usuario.findMany({
      where: { id: { in: docenteIds }, rol: 'DOCENTE' },
    });
    if (docentes.length !== docenteIds.length) {
      throw new BadRequestException(
        'Uno o más IDs no corresponden a docentes válidos',
      );
    }

    return this.prisma.academia.update({
      where: { id: academiaId },
      data: { docentes: { connect: docenteIds.map((id) => ({ id })) } },
      include: INCLUDE_DETAIL,
    });
  }

  async quitarDocente(academiaId: number, docenteId: number) {
    const academia = await this.prisma.academia.findUnique({
      where: { id: academiaId },
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');

    const docente = await this.prisma.usuario.findUnique({
      where: { id: docenteId },
      include: {
        academias: { select: { id: true } },
        docenteMaterias: {
          select: {
            id: true,
            nombre: true,
            academias: { select: { id: true } },
          },
        },
      },
    });
    if (!docente) throw new NotFoundException('Docente no encontrado');

    const academiasRestantes = docente.academias
      .map((a) => a.id)
      .filter((id) => id !== academiaId);

    const materiasHuerfanas = docente.docenteMaterias.filter((m) => {
      const academiasMateria = m.academias.map((a) => a.id);
      return !academiasMateria.some((id) => academiasRestantes.includes(id));
    });

    if (materiasHuerfanas.length > 0) {
      const nombres = materiasHuerfanas.map((m) => m.nombre).join(', ');
      throw new ConflictException(
        `No se puede quitar al docente: tiene materias asignadas que solo pertenecen a esta academia (${nombres}). Reasígnalas primero.`,
      );
    }

    return this.prisma.academia.update({
      where: { id: academiaId },
      data: { docentes: { disconnect: { id: docenteId } } },
      include: INCLUDE_DETAIL,
    });
  }

  async asignarMaterias(academiaId: number, materiaIds: number[]) {
    const academia = await this.prisma.academia.findUnique({
      where: { id: academiaId },
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');

    const materias = await this.prisma.materia.findMany({
      where: { id: { in: materiaIds } },
    });
    if (materias.length !== materiaIds.length) {
      throw new BadRequestException('Una o más materias no fueron encontradas');
    }

    return this.prisma.academia.update({
      where: { id: academiaId },
      data: { materias: { connect: materiaIds.map((id) => ({ id })) } },
      include: INCLUDE_DETAIL,
    });
  }

  async quitarMateria(academiaId: number, materiaId: number) {
    const academia = await this.prisma.academia.findUnique({
      where: { id: academiaId },
      include: { materias: { where: { id: materiaId }, select: { id: true } } },
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');
    if (academia.materias.length === 0) {
      throw new NotFoundException('La materia no pertenece a esta academia');
    }

    return this.prisma.academia.update({
      where: { id: academiaId },
      data: { materias: { disconnect: { id: materiaId } } },
      include: INCLUDE_DETAIL,
    });
  }

  async getDocentes(academiaId: number) {
    const academia = await this.prisma.academia.findUnique({
      where: { id: academiaId },
      include: {
        docentes: { select: { id: true, nombre: true, email: true } },
      },
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');
    return academia.docentes;
  }

  async getMaterias(academiaId: number) {
    const academia = await this.prisma.academia.findUnique({
      where: { id: academiaId },
      include: {
        materias: {
          select: { id: true, nombre: true, clave: true, semestre: true },
        },
      },
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');
    return academia.materias;
  }
}
