import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  ActorMateria,
  asegurarAccesoMateria,
  esDocenteDeMateria,
  materiasDelDocenteWhere,
} from '../common/materia-ownership';
import { unidadesIniciales } from '../common/unidades.util';
import { ActualizarUnidadesDto } from './dto/actualizar-unidades.dto';
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
        unidades: { create: unidadesIniciales(dto.numUnidades) },
      },
    });

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
        // Un docente imparte la materia por asignación directa o porque tiene
        // un horario activo en ella (una misma materia puede repartirse entre
        // varios docentes por grupo).
        ...(docenteId ? materiasDelDocenteWhere(docenteId) : {}),
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

  /**
   * Materias que puede cursar un grupo: las de su carrera cuyo semestre
   * coincide con el que cursa el grupo. El semestre de la materia se toma de
   * la retícula cuando la sección no lo tiene capturado, que es el mismo
   * criterio con el que HorariosService valida al guardar la clase.
   */
  async findForGrupo(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { id: true, semestre: true, carreraId: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const [materias, reticula] = await Promise.all([
      this.prisma.materia.findMany({
        where: { carreraId: grupo.carreraId },
        select: {
          id: true,
          nombre: true,
          clave: true,
          semestre: true,
          carreraId: true,
          docente: { select: { id: true, nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.reticulaMateria.findMany({
        where: { carreraId: grupo.carreraId, activo: true },
        select: { clave: true, semestre: true },
      }),
    ]);

    const semestrePorClave = new Map(
      reticula.map((materia) => [materia.clave, materia.semestre]),
    );

    return materias.filter((materia) => {
      const semestre = materia.semestre ?? semestrePorClave.get(materia.clave);
      return semestre === grupo.semestre;
    });
  }

  findByDocente(docenteId?: number) {
    return this.prisma.materia.findMany({
      where: docenteId ? materiasDelDocenteWhere(docenteId) : undefined,
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
    if (actor?.rol === 'DOCENTE') {
      // La asignación puede venir del horario, no sólo de Materia.docenteId.
      const imparte = await esDocenteDeMateria(this.prisma, id, actor.id);
      if (!imparte) {
        throw new ForbiddenException('No puedes consultar esta materia');
      }
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

  async update(id: number, dto: UpdateMateriaDto, actor?: ActorMateria) {
    // Un docente sólo edita las materias que imparte; el admin, cualquiera.
    await asegurarAccesoMateria(this.prisma, actor, id);

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

  /**
   * Aplica el mismo cambio de carrera y/o semestre a varias materias. Cada una
   * se procesa por separado para que un fallo (clave duplicada en la carrera
   * destino, materia ajena) no frene a las demás; se devuelve el detalle.
   */
  async updateMany(
    ids: number[],
    cambios: Pick<UpdateMateriaDto, 'carreraId' | 'semestre'>,
    actor?: ActorMateria,
  ) {
    if (cambios.carreraId === undefined && cambios.semestre === undefined) {
      throw new BadRequestException(
        'Indica la carrera o el semestre a cambiar',
      );
    }
    const errores: { id: number; motivo: string }[] = [];
    let actualizadas = 0;
    for (const id of [...new Set(ids)]) {
      try {
        await this.update(id, cambios, actor);
        actualizadas += 1;
      } catch (error) {
        errores.push({
          id,
          motivo: describirError(error, 'No se pudo editar'),
        });
      }
    }
    return { actualizadas, errores };
  }

  /**
   * Define cuántas unidades tiene la materia. Crecer sólo agrega unidades;
   * reducir borra las sobrantes con lo que tengan registrado, y por eso exige
   * confirmación explícita (`forzar`) cuando hay algo que perder.
   *
   * Las unidades cuelgan de la materia, no del grupo: el cambio lo ven todos
   * los grupos que la llevan.
   */
  async actualizarUnidades(
    id: number,
    dto: ActualizarUnidadesDto,
    actor?: ActorMateria,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, id);

    const materia = await this.prisma.materia.findUnique({
      where: { id },
      select: { id: true, nombre: true, numUnidades: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const unidades = await this.prisma.unidad.findMany({
      where: { materiaId: id },
      orderBy: { orden: 'asc' },
      select: { id: true, orden: true, nombre: true },
    });

    const objetivo = dto.numUnidades;
    const sobrantes = unidades.filter((unidad) => unidad.orden > objetivo);

    if (sobrantes.length) {
      const resumen = await this.contarDatosDeUnidades(id, sobrantes);
      const total =
        resumen.calificaciones + resumen.tareas + resumen.sesiones;
      if (total > 0 && !dto.forzar) {
        throw new ConflictException({
          requiereConfirmacion: true,
          message: `Reducir a ${objetivo} unidades borrará ${this.describirResumen(resumen)} de ${sobrantes.map((u) => u.nombre).join(', ')}.`,
          resumen,
          unidades: sobrantes.map((u) => u.nombre),
        });
      }
    }

    await this.prisma.$transaction(
      async (tx) => {
        if (sobrantes.length) {
          await this.borrarUnidades(tx, id, sobrantes);
        }

        // Se completan los órdenes que falten hasta el objetivo, por si la
        // materia tenía huecos o ninguna unidad.
        const conservadas = new Set(
          unidades
            .filter((unidad) => unidad.orden <= objetivo)
            .map((unidad) => unidad.orden),
        );
        const faltantes: Prisma.UnidadCreateManyInput[] = [];
        for (let orden = 1; orden <= objetivo; orden++) {
          if (conservadas.has(orden)) continue;
          faltantes.push({
            nombre: `Unidad ${orden}`,
            orden,
            materiaId: id,
          });
        }
        if (faltantes.length) {
          await tx.unidad.createMany({ data: faltantes });
        }

        // numUnidades es sólo un contador: se recalcula de las filas reales.
        const total = await tx.unidad.count({ where: { materiaId: id } });
        await tx.materia.update({
          where: { id },
          data: { numUnidades: total },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    return this.findOne(id, actor);
  }

  private describirResumen(resumen: {
    calificaciones: number;
    tareas: number;
    sesiones: number;
  }) {
    const partes: string[] = [];
    if (resumen.calificaciones)
      partes.push(`${resumen.calificaciones} calificación(es)`);
    if (resumen.tareas) partes.push(`${resumen.tareas} tarea(s)`);
    if (resumen.sesiones)
      partes.push(`${resumen.sesiones} sesión(es) de clase`);
    return partes.join(', ');
  }

  /**
   * Tareas y sesiones guardan la unidad por relación y también por el número
   * de orden heredado, así que se cuentan las dos formas.
   */
  private async contarDatosDeUnidades(
    materiaId: number,
    unidades: { id: number; orden: number }[],
  ) {
    const ids = unidades.map((unidad) => unidad.id);
    const ordenes = unidades.map((unidad) => unidad.orden);
    const porUnidad = {
      OR: [{ unidadId: { in: ids } }, { materiaId, unidad: { in: ordenes } }],
    };

    const [calificaciones, tareas, sesiones] = await Promise.all([
      this.prisma.calificacionUnidad.count({
        where: { unidadId: { in: ids } },
      }),
      this.prisma.tarea.count({ where: porUnidad }),
      this.prisma.claseSesion.count({ where: porUnidad }),
    ]);
    return { calificaciones, tareas, sesiones };
  }

  private async borrarUnidades(
    tx: Prisma.TransactionClient,
    materiaId: number,
    unidades: { id: number; orden: number }[],
  ) {
    const ids = unidades.map((unidad) => unidad.id);
    const ordenes = unidades.map((unidad) => unidad.orden);
    const porUnidad = {
      OR: [{ unidadId: { in: ids } }, { materiaId, unidad: { in: ordenes } }],
    };

    await tx.asistencia.deleteMany({ where: { claseSesion: porUnidad } });
    await tx.claseSesion.deleteMany({ where: porUnidad });
    await tx.entregaTarea.deleteMany({ where: { tarea: porUnidad } });
    await tx.tarea.deleteMany({ where: porUnidad });
    await tx.calificacionUnidad.deleteMany({ where: { unidadId: { in: ids } } });
    await tx.unidad.deleteMany({ where: { id: { in: ids } } });
  }

  /**
   * Borrado definitivo. Se lleva lo que cuelga de la materia: horarios,
   * sesiones de clase con sus asistencias, tareas con sus entregas,
   * inscripciones, calificaciones y unidades. Los grupos y las academias
   * conservan sus registros, sólo dejan de tenerla asignada.
   */
  async remove(id: number, actor?: ActorMateria) {
    await asegurarAccesoMateria(this.prisma, actor, id);
    await this.findOne(id);

    return this.prisma.$transaction(
      async (tx) => {
        const asistencias = await tx.asistencia.deleteMany({
          where: { claseSesion: { materiaId: id } },
        });
        const entregas = await tx.entregaTarea.deleteMany({
          where: { tarea: { materiaId: id } },
        });
        const tareas = await tx.tarea.deleteMany({ where: { materiaId: id } });
        const sesiones = await tx.claseSesion.deleteMany({
          where: { materiaId: id },
        });
        const inscripciones = await tx.inscripcion.deleteMany({
          where: { materiaId: id },
        });
        const calificaciones = await tx.calificacionUnidad.deleteMany({
          where: { materiaId: id },
        });
        const horarios = await tx.horarioMateria.deleteMany({
          where: { materiaId: id },
        });
        const unidades = await tx.unidad.deleteMany({
          where: { materiaId: id },
        });

        const eliminada = await tx.materia.delete({
          where: { id },
          select: { id: true, nombre: true, clave: true },
        });

        return {
          ...eliminada,
          eliminados: {
            asistencias: asistencias.count,
            entregas: entregas.count,
            tareas: tareas.count,
            sesiones: sesiones.count,
            inscripciones: inscripciones.count,
            calificaciones: calificaciones.count,
            horarios: horarios.count,
            unidades: unidades.count,
          },
        };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  /** Borra varias materias una por una y reporta cuáles no se pudieron. */
  async removeMany(ids: number[], actor?: ActorMateria) {
    const errores: { id: number; motivo: string }[] = [];
    let eliminadas = 0;
    for (const id of [...new Set(ids)]) {
      try {
        await this.remove(id, actor);
        eliminadas += 1;
      } catch (error) {
        errores.push({
          id,
          motivo: describirError(error, 'No se pudo eliminar'),
        });
      }
    }
    return { eliminadas, errores };
  }
}

/** Mensaje legible de un error de Nest o de Prisma para el resumen por lote. */
function describirError(error: unknown, fallback: string): string {
  if (error instanceof HttpException) {
    const respuesta = error.getResponse();
    if (typeof respuesta === 'string') return respuesta;
    const message = (respuesta as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  return error instanceof Error ? error.message : fallback;
}
