import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMateriaDto } from './dto/create-materia.dto';

@Injectable()
export class MateriasService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMateriaDto, docenteId?: number | null) {
    const materia = await this.prisma.materia.create({
      data: {
        nombre: dto.nombre,
        clave: dto.clave,
        descripcion: dto.descripcion,
        horaInicio: dto.horaInicio ?? '',
        horaFin: dto.horaFin ?? '',
        dias: dto.dias ?? '',
        numUnidades: dto.numUnidades,
        docenteId: docenteId ?? null,
        carreraId: dto.carreraId ?? null,
        semestre: dto.semestre ?? null,
      },
    });

    for (let i = 1; i <= dto.numUnidades; i++) {
      await this.prisma.unidad.create({
        data: { nombre: `Unidad ${i}`, orden: i, materiaId: materia.id },
      });
    }

    return this.findOne(materia.id);
  }

  findAll(carreraId?: number, semestre?: number, docenteId?: number) {
    return this.prisma.materia.findMany({
      where: {
        ...(carreraId && { carreraId }),
        ...(semestre && { semestre }),
        ...(docenteId && { docenteId }),
      },
      include: {
        docente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            academias: { select: { id: true, nombre: true } },
          },
        },
        carrera: { select: { id: true, nombre: true } },
        grupos: {
          select: {
            id: true,
            nombre: true,
            semestre: true,
            seccion: true,
            periodo: true,
          },
        },
        _count: { select: { inscripciones: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findForAlumno(alumnoId: number) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { carreraId: true, semestre: true, grupoId: true },
    });

    // If alumno is assigned to a grupo, return that grupo's materias
    if (alumno?.grupoId) {
      const grupo = await this.prisma.grupo.findUnique({
        where: { id: alumno.grupoId },
        include: {
          materias: {
            include: {
              docente: {
                select: {
                  id: true,
                  nombre: true,
                  email: true,
                  academias: { select: { id: true, nombre: true } },
                },
              },
              carrera: { select: { id: true, nombre: true } },
              grupos: {
                select: {
                  id: true,
                  nombre: true,
                  semestre: true,
                  seccion: true,
                  periodo: true,
                },
              },
              _count: { select: { inscripciones: true } },
            },
            orderBy: { nombre: 'asc' },
          },
        },
      });
      return grupo?.materias ?? [];
    }

    // Fallback: filter by carrera+semestre from profile
    const where: any = {};
    if (alumno?.carreraId) where.carreraId = alumno.carreraId;
    if (alumno?.semestre) where.semestre = alumno.semestre;

    return this.prisma.materia.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        docente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            academias: { select: { id: true, nombre: true } },
          },
        },
        carrera: { select: { id: true, nombre: true } },
        grupos: {
          select: {
            id: true,
            nombre: true,
            semestre: true,
            seccion: true,
            periodo: true,
          },
        },
        _count: { select: { inscripciones: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  findByDocente(docenteId: number) {
    return this.prisma.materia.findMany({
      where: { docenteId },
      include: {
        unidades: { orderBy: { orden: 'asc' } },
        carrera: { select: { id: true, nombre: true } },
        grupos: {
          select: {
            id: true,
            nombre: true,
            semestre: true,
            seccion: true,
            periodo: true,
          },
        },
        _count: { select: { inscripciones: true } },
      },
    });
  }

  async findOne(id: number) {
    const materia = await this.prisma.materia.findUnique({
      where: { id },
      include: {
        docente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            academias: { select: { id: true, nombre: true } },
          },
        },
        carrera: { select: { id: true, nombre: true } },
        grupos: {
          select: {
            id: true,
            nombre: true,
            semestre: true,
            seccion: true,
            periodo: true,
          },
        },
        unidades: {
          orderBy: { orden: 'asc' },
        },
        claseSesiones: {
          orderBy: { fecha: 'desc' },
        },
        inscripciones: {
          include: {
            alumno: {
              select: {
                id: true,
                nombre: true,
                email: true,
                numeroControl: true,
                telefono: true,
              },
            },
          },
        },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    return materia;
  }

  async findByClave(clave: string) {
    const materia = await this.prisma.materia.findUnique({
      where: { clave },
      include: {
        docente: {
          select: {
            id: true,
            nombre: true,
            academias: { select: { id: true, nombre: true } },
          },
        },
        carrera: { select: { id: true, nombre: true } },
        grupos: {
          select: {
            id: true,
            nombre: true,
            semestre: true,
            seccion: true,
            periodo: true,
          },
        },
        _count: { select: { inscripciones: true } },
      },
    });
    if (!materia)
      throw new NotFoundException('Materia no encontrada con esa clave');
    return materia;
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.materia.delete({ where: { id } });
  }
}
