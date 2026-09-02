import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateMateriaDto } from './dto/create-materia.dto';
import { UpdateMateriaDto } from './dto/update-materia.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class MateriasService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  async create(
    dto: CreateMateriaDto,
    actor?: { id: number; rol: string },
    docenteId?: number | null,
  ) {
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

    if (actor?.rol === 'DOCENTE') {
      await this.notificaciones.crearParaAdmins({
        tipo: TipoNotificacion.MATERIA_CREADA,
        titulo: 'Nueva materia creada',
        mensaje: `Se creó la materia ${materia.nombre}.`,
        referenciaId: materia.id,
        referenciaTipo: 'Materia',
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
    const where: Prisma.MateriaWhereInput = {};
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

  findByDocente(docenteId?: number) {
    return this.prisma.materia.findMany({
      where: docenteId ? { docenteId } : undefined,
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

  async findOne(id: number, actor?: { id: number; rol: string }) {
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
          where: { estado: 'ACEPTADA' },
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
    if (actor?.rol === 'DOCENTE' && materia.docente?.id !== actor.id) {
      throw new ForbiddenException('No puedes consultar esta materia');
    }
    return materia;
  }

  async findByClave(clave: string) {
    const materia = await this.prisma.materia.findFirst({
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

  async update(id: number, dto: UpdateMateriaDto) {
    const materia = await this.prisma.materia.findUnique({ where: { id } });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const nombre = dto.nombre?.trim();
    const clave = dto.clave?.trim().toUpperCase();
    if (dto.nombre !== undefined && !nombre) {
      throw new BadRequestException('El nombre de la materia es obligatorio');
    }
    if (dto.clave !== undefined && !clave) {
      throw new BadRequestException('La clave de la materia es obligatoria');
    }

    const carreraId =
      dto.carreraId === undefined ? materia.carreraId : dto.carreraId;
    const claveFinal = clave ?? materia.clave;

    // La clave solo es unica dentro de la carrera, asi que tambien hay que
    // revisar el duplicado cuando la materia cambia de carrera.
    if (claveFinal !== materia.clave || carreraId !== materia.carreraId) {
      const existente = await this.prisma.materia.findFirst({
        where: { clave: claveFinal, carreraId },
        select: { id: true },
      });
      if (existente && existente.id !== id) {
        throw new ConflictException(
          'Ya existe una materia con esa clave en la carrera',
        );
      }
    }

    if (dto.carreraId !== undefined && dto.carreraId !== null) {
      const carrera = await this.prisma.carrera.findUnique({
        where: { id: dto.carreraId },
        select: { id: true },
      });
      if (!carrera) throw new NotFoundException('Carrera no encontrada');
    }

    const data: Prisma.MateriaUncheckedUpdateInput = {
      nombre,
      clave,
      descripcion:
        dto.descripcion === undefined
          ? undefined
          : dto.descripcion.trim() || null,
      carreraId: dto.carreraId,
      semestre: dto.semestre,
    };

    await this.prisma.materia.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.materia.delete({ where: { id } });
  }
}
