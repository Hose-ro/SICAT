import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  EstadoImportacionHorario,
  Prisma,
  Rol,
  TipoNotificacion,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  getCurrentAcademicPeriod,
  normalizeAcademicPeriod,
} from '../common/periodo.util';
import { hayConflictoHorario } from '../horarios/utils/conflicto-horario.util';
import { HorarioVisionService } from './horario-vision.service';
import {
  eliminarFotoHorario,
  leerFotoHorario,
  rutaFotoHorario,
} from './horario-importaciones.storage';
import {
  encontrarDocente,
  encontrarMateria,
} from './horario-importaciones.matching';
import { UpdateImportacionHorarioDto } from './dto/update-importacion-horario.dto';
import {
  HORARIO_VISION_ERROR,
  HorarioVisionError,
} from './horario-vision.error';

type RegistroHorarioOptions = {
  periodo?: string;
  seccion?: string;
  usarHorarioExistente?: boolean;
};

const INCLUDE_IMPORTACION = {
  alumno: {
    select: {
      id: true,
      nombre: true,
      numeroControl: true,
      email: true,
      semestre: true,
    },
  },
  carrera: {
    select: { id: true, nombre: true, codigo: true, planEstudios: true },
  },
  grupo: { select: { id: true, nombre: true, periodo: true } },
  revisor: { select: { id: true, nombre: true } },
  bloques: {
    include: {
      reticulaMateria: {
        select: { id: true, clave: true, nombre: true, semestre: true },
      },
      docente: { select: { id: true, nombre: true } },
    },
    orderBy: [{ orden: 'asc' as const }, { dia: 'asc' as const }],
  },
} satisfies Prisma.ImportacionHorarioInclude;

@Injectable()
export class HorarioImportacionesService implements OnModuleInit {
  private readonly logger = new Logger(HorarioImportacionesService.name);
  private readonly enProceso = new Map<number, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly vision: HorarioVisionService,
  ) {}

  async onModuleInit() {
    await this.reanudarPendientes();
  }

  configuracionLector() {
    return this.vision.estadoConfiguracion();
  }

  async buscarHorarioDisponible(
    carreraId: number,
    semestre: number,
    periodo?: string,
    seccion?: string,
  ) {
    const clave = this.normalizarClaveGrupo(periodo, seccion);
    const grupo = await this.prisma.grupo.findFirst({
      where: {
        carreraId,
        semestre,
        periodo: clave.periodo,
        seccion: clave.seccion,
        activo: true,
        horarios: { some: { activo: true } },
      },
      select: {
        id: true,
        nombre: true,
        periodo: true,
        semestre: true,
        seccion: true,
        carrera: { select: { id: true, nombre: true, codigo: true } },
        horarios: {
          where: { activo: true },
          select: {
            materia: { select: { id: true, clave: true, nombre: true } },
          },
        },
      },
    });

    if (!grupo)
      return {
        disponible: false,
        periodo: clave.periodo,
        seccion: clave.seccion,
      };
    const materias = Array.from(
      new Map(
        grupo.horarios.map((item) => [item.materia.id, item.materia]),
      ).values(),
    );
    return {
      disponible: true,
      grupo: {
        id: grupo.id,
        nombre: grupo.nombre,
        periodo: grupo.periodo,
        semestre: grupo.semestre,
        seccion: grupo.seccion,
        carrera: grupo.carrera,
        materias,
      },
    };
  }

  async registrarDesdeRegistro(
    alumno: { id: number; carreraId: number | null; semestre: number | null },
    options: RegistroHorarioOptions,
    foto?: Express.Multer.File,
  ) {
    if (!alumno.carreraId || !alumno.semestre) {
      return { estado: 'SIN_DATOS_ACADEMICOS' };
    }
    const clave = this.normalizarClaveGrupo(options.periodo, options.seccion);
    if (options.usarHorarioExistente) {
      const disponible = await this.buscarHorarioDisponible(
        alumno.carreraId,
        alumno.semestre,
        clave.periodo,
        clave.seccion,
      );
      if (disponible.disponible && disponible.grupo) {
        await this.prisma.usuario.update({
          where: { id: alumno.id },
          data: { grupoId: disponible.grupo.id },
        });
        return { estado: 'REUTILIZADO', grupo: disponible.grupo };
      }
    }

    if (!foto) return { estado: 'SIN_FOTOGRAFIA' };
    const importacion = await this.prisma.importacionHorario.create({
      data: {
        alumnoId: alumno.id,
        carreraId: alumno.carreraId,
        periodo: clave.periodo,
        semestre: alumno.semestre,
        seccion: clave.seccion,
        imagenContenido: Uint8Array.from(foto.buffer),
        imagenNombre: foto.originalname,
        imagenMime: foto.mimetype,
      },
    });
    await this.notificarAdministradores(importacion.id);
    // La lectura tarda hasta 90 s: se deja en segundo plano para que el alta
    // del alumno responda de inmediato.
    void this.encolarProcesamiento(importacion.id);
    return {
      estado: EstadoImportacionHorario.PENDIENTE_PROCESAMIENTO,
      importacionId: importacion.id,
      mensaje:
        'Recibimos tu fotografía. El horario quedó pendiente de revisión.',
    };
  }

  async listar() {
    const importaciones = await this.prisma.importacionHorario.findMany({
      include: INCLUDE_IMPORTACION,
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return importaciones.map(({ imagenContenido: _contenido, ...item }) => ({
      ...item,
      codigoErrorProcesamiento:
        item.codigoErrorProcesamiento || this.codigoErrorEfectivo(item.estado),
      fotoDisponible: Boolean(_contenido?.length || item.imagenRuta),
      imagenRuta: undefined,
    }));
  }

  async obtenerDetalle(id: number) {
    const importacion = await this.obtenerInterna(id);
    const [reticula, docentes] = await Promise.all([
      this.prisma.reticulaMateria.findMany({
        where: {
          carreraId: importacion.carreraId,
          semestre: importacion.semestre,
          activo: true,
        },
        select: { id: true, clave: true, nombre: true, semestre: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.usuario.findMany({
        where: { rol: Rol.DOCENTE, activo: true },
        select: { id: true, nombre: true, email: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return {
      ...importacion,
      codigoErrorProcesamiento:
        importacion.codigoErrorProcesamiento ||
        this.codigoErrorEfectivo(importacion.estado),
      fotoDisponible: Boolean(
        importacion.imagenContenido?.length || importacion.imagenRuta,
      ),
      imagenContenido: undefined,
      imagenRuta: undefined,
      catalogo: { reticula, docentes },
    };
  }

  async obtenerFoto(id: number) {
    const importacion = await this.prisma.importacionHorario.findUnique({
      where: { id },
      select: {
        imagenContenido: true,
        imagenRuta: true,
        imagenMime: true,
        imagenNombre: true,
      },
    });
    if (!importacion?.imagenContenido?.length && !importacion?.imagenRuta) {
      throw new NotFoundException('La fotografía ya no está disponible');
    }
    return {
      buffer: importacion.imagenContenido
        ? Buffer.from(importacion.imagenContenido)
        : null,
      path: importacion.imagenRuta
        ? rutaFotoHorario(importacion.imagenRuta)
        : null,
      mime: importacion.imagenMime || 'image/jpeg',
      nombre: importacion.imagenNombre || 'horario.jpg',
    };
  }

  async actualizar(id: number, dto: UpdateImportacionHorarioDto) {
    const actual = await this.obtenerInterna(id);
    if (actual.estado === EstadoImportacionHorario.APROBADA) {
      throw new ConflictException('Un horario aprobado ya no puede editarse');
    }
    await this.validarCatalogo(
      actual.carreraId,
      actual.semestre,
      dto.bloques.map((item) => item.reticulaMateriaId),
      dto.bloques.map((item) => item.docenteId),
    );
    this.validarBloques(dto.bloques);
    await this.prisma.$transaction(async (tx) => {
      await tx.bloqueImportacionHorario.deleteMany({
        where: { importacionId: id },
      });
      if (dto.bloques.length) {
        const materias = await tx.reticulaMateria.findMany({
          where: {
            id: { in: dto.bloques.map((item) => item.reticulaMateriaId) },
          },
          select: { id: true, clave: true, nombre: true },
        });
        const docentes = await tx.usuario.findMany({
          where: { id: { in: dto.bloques.map((item) => item.docenteId) } },
          select: { id: true, nombre: true },
        });
        const materiaMap = new Map(materias.map((item) => [item.id, item]));
        const docenteMap = new Map(docentes.map((item) => [item.id, item]));
        await tx.bloqueImportacionHorario.createMany({
          data: dto.bloques.map((item, orden) => ({
            importacionId: id,
            reticulaMateriaId: item.reticulaMateriaId,
            docenteId: item.docenteId,
            claveDetectada: materiaMap.get(item.reticulaMateriaId)?.clave,
            materiaDetectada:
              materiaMap.get(item.reticulaMateriaId)?.nombre || 'Materia',
            docenteDetectado: docenteMap.get(item.docenteId)?.nombre,
            aulaDetectada: item.aulaDetectada?.trim() || null,
            dia: item.dia,
            horaInicio: item.horaInicio,
            horaFin: item.horaFin,
            confianzaMateria: 1,
            confianzaDocente: 1,
            orden,
          })),
        });
      }
      await tx.importacionHorario.update({
        where: { id },
        data: {
          estado: EstadoImportacionHorario.PENDIENTE_REVISION,
          codigoErrorProcesamiento: null,
          errorProcesamiento: null,
          observaciones: dto.observaciones?.trim() || null,
        },
      });
    });
    return this.obtenerDetalle(id);
  }

  async reprocesar(id: number) {
    const importacion = await this.obtenerInterna(id);
    if (importacion.estado === EstadoImportacionHorario.APROBADA) {
      throw new ConflictException('El horario ya fue aprobado');
    }
    if (!importacion.imagenContenido?.length && !importacion.imagenRuta) {
      throw new NotFoundException('No hay una fotografía para reprocesar');
    }
    await this.prisma.importacionHorario.update({
      where: { id },
      data: {
        estado: EstadoImportacionHorario.PENDIENTE_PROCESAMIENTO,
        codigoErrorProcesamiento: null,
        errorProcesamiento: null,
      },
    });
    await this.encolarProcesamiento(id);
    return this.obtenerDetalle(id);
  }

  async aprobar(id: number, revisorId: number) {
    const importacion = await this.obtenerInterna(id);
    if (importacion.estado === EstadoImportacionHorario.APROBADA) {
      return this.obtenerDetalle(id);
    }
    if (!importacion.bloques.length) {
      throw new BadRequestException(
        'Agrega al menos un bloque antes de aprobar',
      );
    }
    if (
      importacion.bloques.some(
        (bloque) => !bloque.reticulaMateriaId || !bloque.docenteId,
      )
    ) {
      throw new BadRequestException(
        'Todas las materias y docentes deben confirmarse antes de aprobar',
      );
    }
    this.validarBloques(importacion.bloques);

    const grupoExistente = await this.prisma.grupo.findFirst({
      where: {
        carreraId: importacion.carreraId,
        semestre: importacion.semestre,
        periodo: importacion.periodo,
        seccion: importacion.seccion,
        activo: true,
      },
      include: { horarios: { where: { activo: true }, select: { id: true } } },
    });

    if (grupoExistente?.horarios.length) {
      await this.marcarComoReutilizada(
        importacion,
        grupoExistente.id,
        revisorId,
      );
      await eliminarFotoHorario(importacion.imagenRuta);
      return this.obtenerDetalle(id);
    }

    await this.validarConflictos(importacion.bloques, importacion.periodo);
    const resultado = await this.prisma.$transaction(async (tx) => {
      const grupo =
        grupoExistente ||
        (await tx.grupo.create({
          data: {
            nombre: `${importacion.semestre}${importacion.carrera.codigo}${importacion.seccion}`,
            semestre: importacion.semestre,
            seccion: importacion.seccion,
            carreraId: importacion.carreraId,
            periodo: importacion.periodo,
          },
        }));

      const reticulaIds = Array.from(
        new Set(importacion.bloques.map((bloque) => bloque.reticulaMateriaId!)),
      );
      const reticula = await tx.reticulaMateria.findMany({
        where: {
          id: { in: reticulaIds },
          carreraId: importacion.carreraId,
          semestre: importacion.semestre,
          activo: true,
        },
      });
      if (reticula.length !== reticulaIds.length) {
        throw new BadRequestException(
          'Una materia seleccionada no pertenece a la retícula del alumno',
        );
      }

      const materiaPorReticula = new Map<number, number>();
      for (const materiaReticula of reticula) {
        let materia = await tx.materia.findFirst({
          where: {
            clave: materiaReticula.clave,
            carreraId: materiaReticula.carreraId,
          },
          select: { id: true },
        });
        if (!materia) {
          materia = await tx.materia.create({
            data: {
              nombre: materiaReticula.nombre,
              clave: materiaReticula.clave,
              semestre: materiaReticula.semestre,
              carreraId: materiaReticula.carreraId,
              horaInicio: '',
              horaFin: '',
              dias: '',
              numUnidades: 3,
              unidades: {
                create: [1, 2, 3].map((orden) => ({
                  nombre: `Unidad ${orden}`,
                  orden,
                })),
              },
            },
            select: { id: true },
          });
        }
        materiaPorReticula.set(materiaReticula.id, materia.id);
      }

      await tx.grupo.update({
        where: { id: grupo.id },
        data: {
          materias: {
            connect: Array.from(new Set(materiaPorReticula.values())).map(
              (materiaId) => ({ id: materiaId }),
            ),
          },
        },
      });

      for (const bloque of importacion.bloques) {
        const aulaNombre = bloque.aulaDetectada?.trim();
        const aula = aulaNombre
          ? ((await tx.aula.findFirst({
              where: {
                nombre: { equals: aulaNombre, mode: 'insensitive' },
              },
              select: { id: true },
            })) ??
            (await tx.aula.create({
              data: { nombre: aulaNombre },
              select: { id: true },
            })))
          : null;
        await tx.horarioMateria.create({
          data: {
            materiaId: materiaPorReticula.get(bloque.reticulaMateriaId!)!,
            docenteId: bloque.docenteId!,
            grupoId: grupo.id,
            aulaId: aula?.id ?? null,
            dias: bloque.dia,
            horaInicio: bloque.horaInicio,
            horaFin: bloque.horaFin,
            semestre: importacion.semestre,
          },
        });
      }

      for (const materiaId of new Set(materiaPorReticula.values())) {
        const horarios = await tx.horarioMateria.findMany({
          where: { materiaId, activo: true },
          orderBy: { id: 'asc' },
        });
        const primero = horarios[0];
        if (primero) {
          await tx.materia.update({
            where: { id: materiaId },
            data: {
              docenteId: primero.docenteId,
              aulaId: primero.aulaId,
              dias: Array.from(new Set(horarios.map((item) => item.dias))).join(
                ', ',
              ),
              horaInicio: primero.horaInicio,
              horaFin: primero.horaFin,
            },
          });
        }
      }

      await tx.usuario.update({
        where: { id: importacion.alumnoId },
        data: { grupoId: grupo.id },
      });
      await tx.importacionHorario.update({
        where: { id },
        data: {
          estado: EstadoImportacionHorario.APROBADA,
          grupoId: grupo.id,
          revisorId,
          revisadoAt: new Date(),
          imagenContenido: null,
          imagenRuta: null,
          codigoErrorProcesamiento: null,
          errorProcesamiento: null,
        },
      });
      await tx.notificacion.create({
        data: {
          usuarioId: importacion.alumnoId,
          tipo: TipoNotificacion.HORARIO_APROBADO,
          titulo: 'Horario aprobado',
          mensaje: `Tu horario del grupo ${grupo.nombre} fue aprobado y ya está disponible.`,
          referenciaId: id,
          referenciaTipo: 'ImportacionHorario',
        },
      });
      return grupo;
    });
    await eliminarFotoHorario(importacion.imagenRuta);
    return { ...(await this.obtenerDetalle(id)), grupo: resultado };
  }

  async rechazar(id: number, revisorId: number, motivo: string) {
    const importacion = await this.obtenerInterna(id);
    if (importacion.estado === EstadoImportacionHorario.APROBADA) {
      throw new ConflictException('Un horario aprobado no puede rechazarse');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.importacionHorario.update({
        where: { id },
        data: {
          estado: EstadoImportacionHorario.RECHAZADA,
          revisorId,
          revisadoAt: new Date(),
          observaciones: motivo.trim(),
          imagenContenido: null,
          imagenRuta: null,
        },
      });
      await tx.notificacion.create({
        data: {
          usuarioId: importacion.alumnoId,
          tipo: TipoNotificacion.HORARIO_RECHAZADO,
          titulo: 'Horario pendiente de corrección',
          mensaje: motivo.trim(),
          referenciaId: id,
          referenciaTipo: 'ImportacionHorario',
        },
      });
    });
    await eliminarFotoHorario(importacion.imagenRuta);
    return this.obtenerDetalle(id);
  }

  /**
   * Reencola las importaciones que quedaron en PENDIENTE_PROCESAMIENTO porque el
   * proceso se reinició a media lectura. La fotografía sigue guardada, así que
   * la lectura se repite sin pedirle nada al alumno.
   */
  private async reanudarPendientes() {
    try {
      const pendientes = await this.prisma.importacionHorario.findMany({
        where: { estado: EstadoImportacionHorario.PENDIENTE_PROCESAMIENTO },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 25,
      });
      if (!pendientes.length) return;
      this.logger.log(
        `Reanudando la lectura de ${pendientes.length} importación(es) de horario`,
      );
      for (const { id } of pendientes) void this.encolarProcesamiento(id);
    } catch (error: unknown) {
      this.logger.error(
        'No se pudieron reanudar las importaciones pendientes',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Lanza la lectura en segundo plano y devuelve la promesa en curso: el
   * registro público la ignora para responder de inmediato y la pantalla
   * administrativa la espera para mostrar el resultado. Si ya hay una lectura en
   * vuelo para la misma importación, ambas comparten la misma promesa en lugar
   * de llamar al lector dos veces.
   */
  private encolarProcesamiento(id: number): Promise<void> {
    const enCurso = this.enProceso.get(id);
    if (enCurso) return enCurso;
    const tarea = this.procesar(id)
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error(
          `Falló la lectura en segundo plano de la importación ${id}`,
          error instanceof Error ? error.stack : undefined,
        );
      })
      .finally(() => {
        this.enProceso.delete(id);
      });
    this.enProceso.set(id, tarea);
    return tarea;
  }

  private async procesar(id: number) {
    const importacion = await this.obtenerInterna(id);
    try {
      if (!importacion.imagenContenido?.length && !importacion.imagenRuta)
        throw new HorarioVisionError(
          HORARIO_VISION_ERROR.IMAGEN,
          'La fotografía ya no está disponible para procesarse.',
        );
      const [imagen, reticula, docentes] = await Promise.all([
        importacion.imagenContenido?.length
          ? Promise.resolve(Buffer.from(importacion.imagenContenido))
          : leerFotoHorario(importacion.imagenRuta!),
        this.prisma.reticulaMateria.findMany({
          where: {
            carreraId: importacion.carreraId,
            semestre: importacion.semestre,
            activo: true,
          },
          select: { id: true, clave: true, nombre: true },
        }),
        this.prisma.usuario.findMany({
          where: { rol: Rol.DOCENTE, activo: true },
          select: { id: true, nombre: true },
        }),
      ]);
      const detectado = await this.vision.extraer(
        imagen,
        importacion.imagenMime || 'image/jpeg',
        {
          periodo: importacion.periodo,
          semestre: importacion.semestre,
          seccion: importacion.seccion,
          carrera: importacion.carrera.nombre,
          reticula,
          docentes,
        },
      );
      const bloques = detectado.bloques.filter(
        (bloque) =>
          bloque.materia.trim() &&
          this.horaValida(bloque.horaInicio) &&
          this.horaValida(bloque.horaFin) &&
          this.aMinutos(bloque.horaInicio) < this.aMinutos(bloque.horaFin),
      );
      if (!bloques.length) {
        throw new HorarioVisionError(
          HORARIO_VISION_ERROR.SIN_BLOQUES,
          'El lector no encontró bloques completos en la tabla.',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.bloqueImportacionHorario.deleteMany({
          where: { importacionId: id },
        });
        for (const [orden, bloque] of bloques.entries()) {
          const materia = encontrarMateria(
            bloque.clave,
            bloque.materia,
            reticula,
          );
          const docente = encontrarDocente(bloque.docente, docentes);
          await tx.bloqueImportacionHorario.create({
            data: {
              importacionId: id,
              reticulaMateriaId: materia.candidato?.id,
              docenteId: docente.candidato?.id,
              claveDetectada: bloque.clave || null,
              materiaDetectada: bloque.materia,
              docenteDetectado: bloque.docente || null,
              aulaDetectada: bloque.aula || null,
              dia: bloque.dia,
              horaInicio: bloque.horaInicio,
              horaFin: bloque.horaFin,
              confianzaMateria: materia.confianza,
              confianzaDocente: docente.confianza,
              orden,
            },
          });
        }
        await tx.importacionHorario.update({
          where: { id },
          data: {
            estado: EstadoImportacionHorario.PENDIENTE_REVISION,
            confianzaGeneral: detectado.confianzaGeneral,
            datosDetectados: detectado as unknown as Prisma.InputJsonValue,
            codigoErrorProcesamiento: null,
            errorProcesamiento: null,
          },
        });
      });
    } catch (error: unknown) {
      this.logger.error(
        `No se pudo procesar la importación de horario ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.prisma.importacionHorario.update({
        where: { id },
        data: {
          estado: EstadoImportacionHorario.ERROR,
          codigoErrorProcesamiento:
            error instanceof HorarioVisionError
              ? error.code
              : HORARIO_VISION_ERROR.PROVEEDOR,
          errorProcesamiento:
            error instanceof HorarioVisionError
              ? error.message
              : 'No fue posible leer la fotografía automáticamente.',
        },
      });
    }
    return this.obtenerInterna(id);
  }

  private async obtenerInterna(id: number) {
    const importacion = await this.prisma.importacionHorario.findUnique({
      where: { id },
      include: INCLUDE_IMPORTACION,
    });
    if (!importacion) throw new NotFoundException('Importación no encontrada');
    return importacion;
  }

  private normalizarClaveGrupo(periodo?: string, seccion?: string) {
    const periodoNormalizado = normalizeAcademicPeriod(
      periodo || getCurrentAcademicPeriod(),
    );
    if (!/^\d{4}-[AB]$/.test(periodoNormalizado)) {
      throw new BadRequestException('El periodo debe tener el formato 2026-A');
    }
    const seccionNormalizada = (seccion || 'A').trim().toUpperCase();
    if (!/^[A-Z]$/.test(seccionNormalizada)) {
      throw new BadRequestException('La sección debe ser una letra de A a Z');
    }
    return { periodo: periodoNormalizado, seccion: seccionNormalizada };
  }

  private codigoErrorEfectivo(estado: EstadoImportacionHorario) {
    if (
      estado === EstadoImportacionHorario.ERROR &&
      !this.vision.estadoConfiguracion().configurado
    ) {
      return HORARIO_VISION_ERROR.NO_CONFIGURADO;
    }
    return null;
  }

  private validarBloques(
    bloques: Array<{ dia: string; horaInicio: string; horaFin: string }>,
  ) {
    const dias = new Set([
      'Lunes',
      'Martes',
      'Miercoles',
      'Jueves',
      'Viernes',
      'Sabado',
    ]);
    for (const bloque of bloques) {
      if (
        !dias.has(bloque.dia) ||
        !this.horaValida(bloque.horaInicio) ||
        !this.horaValida(bloque.horaFin)
      ) {
        throw new BadRequestException('Hay un día u horario inválido');
      }
      if (this.aMinutos(bloque.horaInicio) >= this.aMinutos(bloque.horaFin)) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la hora de inicio',
        );
      }
    }
  }

  private async validarCatalogo(
    carreraId: number,
    semestre: number,
    reticulaIds: number[],
    docenteIds: number[],
  ) {
    const [materias, docentes] = await Promise.all([
      this.prisma.reticulaMateria.count({
        where: {
          id: { in: Array.from(new Set(reticulaIds)) },
          carreraId,
          semestre,
          activo: true,
        },
      }),
      this.prisma.usuario.count({
        where: {
          id: { in: Array.from(new Set(docenteIds)) },
          rol: Rol.DOCENTE,
          activo: true,
        },
      }),
    ]);
    if (materias !== new Set(reticulaIds).size) {
      throw new BadRequestException(
        'Hay una materia ajena a la retícula seleccionada',
      );
    }
    if (docentes !== new Set(docenteIds).size) {
      throw new BadRequestException('Hay un docente inválido o inactivo');
    }
  }

  private async validarConflictos(
    bloques: Array<{
      docenteId: number | null;
      dia: string;
      horaInicio: string;
      horaFin: string;
      materiaDetectada: string;
      aulaDetectada: string | null;
    }>,
    periodo: string,
  ) {
    for (let i = 0; i < bloques.length; i += 1) {
      for (let j = i + 1; j < bloques.length; j += 1) {
        const a = bloques[i];
        const b = bloques[j];
        if (
          !hayConflictoHorario(
            { dias: a.dia, horaInicio: a.horaInicio, horaFin: a.horaFin },
            { dias: b.dia, horaInicio: b.horaInicio, horaFin: b.horaFin },
          )
        )
          continue;
        if (a.docenteId === b.docenteId) {
          throw new ConflictException(
            `El docente tiene dos bloques simultáneos en la propuesta (${a.dia}).`,
          );
        }
        throw new ConflictException(
          `El grupo tendría dos materias simultáneas el ${a.dia}.`,
        );
      }
    }

    const existentes = await this.prisma.horarioMateria.findMany({
      where: {
        activo: true,
        OR: [{ grupo: { periodo } }, { grupoId: null }],
      },
      include: {
        docente: { select: { nombre: true } },
        materia: { select: { nombre: true } },
        aula: { select: { nombre: true } },
      },
    });
    for (const bloque of bloques) {
      const conflicto = existentes.find(
        (existente) =>
          existente.docenteId === bloque.docenteId &&
          hayConflictoHorario(
            {
              dias: existente.dias,
              horaInicio: existente.horaInicio,
              horaFin: existente.horaFin,
            },
            {
              dias: bloque.dia,
              horaInicio: bloque.horaInicio,
              horaFin: bloque.horaFin,
            },
          ),
      );
      if (conflicto) {
        throw new ConflictException(
          `${conflicto.docente.nombre} ya tiene ${conflicto.materia.nombre} el ${bloque.dia} en ese horario.`,
        );
      }
      const aulaNormalizada = bloque.aulaDetectada
        ?.trim()
        .toLocaleLowerCase('es-MX');
      if (!aulaNormalizada) continue;
      const conflictoAula = existentes.find(
        (existente) =>
          existente.aula?.nombre.trim().toLocaleLowerCase('es-MX') ===
            aulaNormalizada &&
          hayConflictoHorario(
            {
              dias: existente.dias,
              horaInicio: existente.horaInicio,
              horaFin: existente.horaFin,
            },
            {
              dias: bloque.dia,
              horaInicio: bloque.horaInicio,
              horaFin: bloque.horaFin,
            },
          ),
      );
      if (conflictoAula) {
        throw new ConflictException(
          `El aula ${bloque.aulaDetectada} ya está ocupada por ${conflictoAula.materia.nombre} el ${bloque.dia} en ese horario.`,
        );
      }
    }
  }

  private async marcarComoReutilizada(
    importacion: Awaited<
      ReturnType<HorarioImportacionesService['obtenerInterna']>
    >,
    grupoId: number,
    revisorId: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: importacion.alumnoId },
        data: { grupoId },
      });
      await tx.importacionHorario.update({
        where: { id: importacion.id },
        data: {
          estado: EstadoImportacionHorario.APROBADA,
          grupoId,
          revisorId,
          revisadoAt: new Date(),
          imagenContenido: null,
          imagenRuta: null,
          codigoErrorProcesamiento: null,
          errorProcesamiento: null,
          observaciones:
            'Se reutilizó el horario oficial que ya existía para el grupo.',
        },
      });
      await tx.notificacion.create({
        data: {
          usuarioId: importacion.alumnoId,
          tipo: TipoNotificacion.HORARIO_APROBADO,
          titulo: 'Horario asignado',
          mensaje:
            'Tu cuenta fue vinculada con el horario oficial de tu grupo.',
          referenciaId: importacion.id,
          referenciaTipo: 'ImportacionHorario',
        },
      });
    });
  }

  private async notificarAdministradores(importacionId: number) {
    const administradores = await this.prisma.usuario.findMany({
      where: { rol: Rol.ADMIN, activo: true },
      select: { id: true },
    });
    if (!administradores.length) return;
    await this.prisma.notificacion.createMany({
      data: administradores.map((admin) => ({
        usuarioId: admin.id,
        tipo: TipoNotificacion.HORARIO_IMPORTADO,
        titulo: 'Horario por revisar',
        mensaje: 'Un alumno registró una fotografía de horario.',
        referenciaId: importacionId,
        referenciaTipo: 'ImportacionHorario',
      })),
    });
  }

  private horaValida(value: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private aMinutos(value: string) {
    const [hora, minuto] = value.split(':').map(Number);
    return hora * 60 + minuto;
  }
}
