import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Rol, TipoEventoAuth, TipoNotificacion } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import {
  normalizeControlNumber,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeUsername,
} from '../common/identity-normalization';

interface CreateUserOptions {
  publicRegistration?: boolean;
}

/** `undefined` deja el valor actual; `null` lo limpia. */
function normalizeNullable(
  value: string | null | undefined,
  normalizer: (input: string) => string,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  return normalizer(value);
}

function resolveNextValue<T>(
  patch: T | null | undefined,
  current: T | null,
): T | null {
  return patch === undefined ? current : patch;
}

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(dto: RegisterDto, options: CreateUserOptions = {}) {
    const normalized: RegisterDto = {
      ...dto,
      nombre: normalizeName(dto.nombre),
      email: dto.email ? normalizeEmail(dto.email) : undefined,
      numeroControl: dto.numeroControl
        ? normalizeControlNumber(dto.numeroControl)
        : undefined,
      username: dto.username ? normalizeUsername(dto.username) : undefined,
      telefono: dto.telefono ? normalizePhone(dto.telefono) : undefined,
    };

    if (
      normalized.rol === Rol.ALUMNO &&
      (!normalized.numeroControl ||
        !normalized.carreraId ||
        !normalized.semestre)
    ) {
      throw new BadRequestException(
        'Un alumno requiere número de control, carrera y semestre',
      );
    }

    if (
      !normalized.email &&
      !normalized.numeroControl &&
      !normalized.username
    ) {
      throw new BadRequestException(
        'El usuario requiere correo, número de control o nombre de usuario',
      );
    }

    if (normalized.rol === Rol.DOCENTE && normalized.academiaId) {
      const academia = await this.prisma.academia.findFirst({
        where: { id: normalized.academiaId, activo: true },
      });
      if (!academia) throw new NotFoundException('Academia no encontrada');
    }

    if (normalized.rol === Rol.JEFE_CARRERA) {
      await this.validarCarrerasJefe(normalized.carreraIds ?? []);
    }

    const hash = await bcrypt.hash(normalized.password, 12);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.ensureIdentifiersAvailable(tx, normalized);

          const carrera =
            normalized.rol === Rol.ALUMNO
              ? await tx.carrera.findUnique({
                  where: { id: normalized.carreraId },
                  select: { id: true },
                })
              : null;
          if (normalized.rol === Rol.ALUMNO && !carrera) {
            throw new NotFoundException('Carrera no encontrada');
          }

          const usuario = await tx.usuario.create({
            data: {
              nombre: normalized.nombre,
              email: normalized.email,
              emailVerificadoAt:
                options.publicRegistration || !normalized.email
                  ? undefined
                  : new Date(),
              numeroControl: normalized.numeroControl,
              username: normalized.username,
              password: hash,
              rol: normalized.rol,
              telefono: normalized.telefono,
              registroAprobado: !options.publicRegistration,
              carreraId:
                normalized.rol === Rol.ALUMNO
                  ? normalized.carreraId
                  : undefined,
              semestre:
                normalized.rol === Rol.ALUMNO ? normalized.semestre : undefined,
              academias:
                normalized.rol === Rol.DOCENTE && normalized.academiaId
                  ? { connect: [{ id: normalized.academiaId }] }
                  : undefined,
              carrerasJefe:
                normalized.rol === Rol.JEFE_CARRERA
                  ? {
                      create: (normalized.carreraIds ?? []).map(
                        (carreraId) => ({ carreraId }),
                      ),
                    }
                  : undefined,
            },
            select: {
              id: true,
              nombre: true,
              email: true,
              emailVerificadoAt: true,
              numeroControl: true,
              username: true,
              rol: true,
              telefono: true,
              semestre: true,
              academias: { select: { id: true, nombre: true } },
              activo: true,
              registroAprobado: true,
              carrera: true,
              carrerasJefe: {
                where: { activa: true },
                select: {
                  carrera: {
                    select: { id: true, nombre: true, codigo: true },
                  },
                },
              },
              createdAt: true,
            },
          });

          const admins = await tx.usuario.findMany({
            where: {
              rol: Rol.ADMIN,
              activo: true,
              id:
                normalized.rol === Rol.ADMIN ? { not: usuario.id } : undefined,
            },
            select: { id: true },
          });
          if (admins.length) {
            await tx.notificacion.createMany({
              data: admins.map((admin) => ({
                usuarioId: admin.id,
                tipo: TipoNotificacion.NUEVO_USUARIO,
                titulo: 'Nuevo usuario registrado',
                mensaje: `Se registró ${usuario.nombre} en el sistema.`,
                referenciaId: usuario.id,
                referenciaTipo: 'Usuario',
              })),
            });
          }

          return usuario;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El correo, usuario o número de control ya está registrado',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Otro registro se procesó al mismo tiempo; intenta nuevamente',
        );
      }
      throw error;
    }
  }

  findAll(rol?: Rol) {
    return this.prisma.usuario.findMany({
      where: rol ? { rol } : undefined,
      select: {
        id: true,
        nombre: true,
        email: true,
        numeroControl: true,
        username: true,
        rol: true,
        telefono: true,
        semestre: true,
        academias: { select: { id: true, nombre: true } },
        activo: true,
        registroAprobado: true,
        emailVerificadoAt: true,
        // Los identificadores planos los usa el panel para filtrar por carrera
        // y saber si el alumno ya pertenece a un grupo.
        carreraId: true,
        grupoId: true,
        carrera: true,
        grupo: { select: { id: true, nombre: true, semestre: true, periodo: true } },
        carrerasJefe: {
          where: { activa: true },
          select: {
            carrera: { select: { id: true, nombre: true, codigo: true } },
          },
        },
        createdAt: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        numeroControl: true,
        username: true,
        rol: true,
        telefono: true,
        semestre: true,
        academias: { select: { id: true, nombre: true } },
        activo: true,
        registroAprobado: true,
        emailVerificadoAt: true,
        carreraId: true,
        grupoId: true,
        carrera: true,
        grupo: { select: { id: true, nombre: true, semestre: true, periodo: true } },
        carrerasJefe: {
          where: { activa: true },
          select: {
            carrera: { select: { id: true, nombre: true, codigo: true } },
          },
        },
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async findAuthAudit(id: number) {
    await this.findOne(id);
    return this.prisma.authAudit.findMany({
      where: { usuarioId: id },
      select: {
        id: true,
        tipo: true,
        identifier: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateOwnProfile(id: number, dto: UpdateOwnProfileDto) {
    const normalized: UpdateOwnProfileDto = {
      nombre: dto.nombre ? normalizeName(dto.nombre) : undefined,
      email: dto.email ? normalizeEmail(dto.email) : undefined,
      telefono: dto.telefono ? normalizePhone(dto.telefono) : undefined,
    };

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.usuario.findUnique({
        where: { id },
        select: { email: true },
      });
      if (!current) throw new NotFoundException('Usuario no encontrado');

      await this.ensureIdentifiersAvailable(tx, normalized, id);
      const emailChanged =
        normalized.email !== undefined && normalized.email !== current.email;
      if (emailChanged) {
        await tx.authToken.updateMany({
          where: { usuarioId: id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }

      return tx.usuario.update({
        where: { id },
        data: {
          nombre: normalized.nombre,
          email: normalized.email,
          emailVerificadoAt: emailChanged ? null : undefined,
          telefono: normalized.telefono,
          tokenVersion: emailChanged ? { increment: 1 } : undefined,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          emailVerificadoAt: true,
          rol: true,
          telefono: true,
          numeroControl: true,
          semestre: true,
          activo: true,
        },
      });
    });
  }

  async updateByAdmin(
    id: number,
    dto: AdminUpdateUserDto,
    adminUserId: number,
  ) {
    const normalized: AdminUpdateUserDto = {
      ...dto,
      nombre: dto.nombre ? normalizeName(dto.nombre) : undefined,
      email: normalizeNullable(dto.email, normalizeEmail),
      numeroControl: normalizeNullable(
        dto.numeroControl,
        normalizeControlNumber,
      ),
      username: normalizeNullable(dto.username, normalizeUsername),
      telefono: normalizeNullable(dto.telefono, normalizePhone),
    };
    const password = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.usuario.findUnique({
            where: { id },
            select: {
              id: true,
              email: true,
              rol: true,
              activo: true,
              numeroControl: true,
              username: true,
              carreraId: true,
              semestre: true,
            },
          });
          if (!current) throw new NotFoundException('Usuario no encontrado');

          await this.ensureActiveAdminRemains(tx, current, {
            rol: normalized.rol,
            activo: normalized.activo,
          });
          await this.ensureIdentifiersAvailable(tx, normalized, id);

          const nextRol = normalized.rol ?? current.rol;
          const roleChanged =
            normalized.rol !== undefined && normalized.rol !== current.rol;
          const nextNumeroControl = resolveNextValue(
            normalized.numeroControl,
            current.numeroControl,
          );
          const nextEmail = resolveNextValue(normalized.email, current.email);
          const nextUsername = resolveNextValue(
            normalized.username,
            current.username,
          );
          if (!nextEmail && !nextNumeroControl && !nextUsername) {
            throw new BadRequestException(
              'El usuario requiere correo, número de control o nombre de usuario',
            );
          }

          const datosAlumno = await this.resolveDatosAlumno(tx, {
            normalized,
            current,
            nextRol,
            roleChanged,
            nextNumeroControl,
          });
          const academias = await this.resolveAcademias(tx, {
            normalized,
            nextRol,
            roleChanged,
          });
          await this.syncCarrerasJefe(tx, {
            id,
            normalized,
            nextRol,
            roleChanged,
          });

          const activeChanged =
            normalized.activo !== undefined &&
            normalized.activo !== current.activo;
          const emailChanged =
            normalized.email !== undefined &&
            normalized.email !== current.email;
          const invalidateSession =
            normalized.password !== undefined ||
            roleChanged ||
            activeChanged ||
            emailChanged;

          if (emailChanged) {
            await tx.authToken.updateMany({
              where: { usuarioId: id, usedAt: null },
              data: { usedAt: new Date() },
            });
          }
          const updated = await tx.usuario.update({
            where: { id },
            data: {
              nombre: normalized.nombre,
              email: normalized.email,
              emailVerificadoAt: emailChanged ? null : undefined,
              numeroControl: normalized.numeroControl,
              username: normalized.username,
              telefono: normalized.telefono,
              password,
              rol: normalized.rol,
              carreraId: datosAlumno.carreraId,
              semestre: datosAlumno.semestre,
              academias,
              activo: normalized.activo,
              tokenVersion: invalidateSession ? { increment: 1 } : undefined,
            },
            select: {
              id: true,
              nombre: true,
              email: true,
              emailVerificadoAt: true,
              numeroControl: true,
              username: true,
              rol: true,
              telefono: true,
              semestre: true,
              academias: { select: { id: true, nombre: true } },
              activo: true,
              registroAprobado: true,
              carrera: true,
              carrerasJefe: {
                where: { activa: true },
                select: {
                  carrera: { select: { id: true, nombre: true, codigo: true } },
                },
              },
            },
          });
          if (normalized.password !== undefined) {
            await tx.authAudit.create({
              data: {
                usuarioId: id,
                tipo: TipoEventoAuth.CAMBIO_PASSWORD,
                metadata: { adminUserId, source: 'admin' },
              },
            });
          }
          if (roleChanged) {
            await tx.authAudit.create({
              data: {
                usuarioId: id,
                tipo: TipoEventoAuth.ROL_CAMBIADO,
                metadata: {
                  adminUserId,
                  previousRole: current.rol,
                  newRole: normalized.rol,
                },
              },
            });
          }
          if (activeChanged) {
            await tx.authAudit.create({
              data: {
                usuarioId: id,
                tipo: normalized.activo
                  ? TipoEventoAuth.CUENTA_ACTIVADA
                  : TipoEventoAuth.CUENTA_DESACTIVADA,
                metadata: { adminUserId },
              },
            });
          }
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAdminMutationConflict(error);
    }
  }

  /**
   * La carrera y el semestre sólo aplican a un alumno: se validan cuando la
   * edición los toca y se limpian cuando el usuario deja de ser alumno.
   */
  private async resolveDatosAlumno(
    tx: Prisma.TransactionClient,
    params: {
      normalized: AdminUpdateUserDto;
      current: { carreraId: number | null; semestre: number | null };
      nextRol: Rol;
      roleChanged: boolean;
      nextNumeroControl: string | null;
    },
  ): Promise<{ carreraId?: number | null; semestre?: number | null }> {
    const { normalized, current, nextRol, roleChanged, nextNumeroControl } =
      params;

    if (nextRol !== Rol.ALUMNO) {
      return roleChanged ? { carreraId: null, semestre: null } : {};
    }

    const tocaDatosAlumno =
      roleChanged ||
      normalized.numeroControl !== undefined ||
      normalized.carreraId !== undefined ||
      normalized.semestre !== undefined;
    if (tocaDatosAlumno) {
      const nextCarreraId = resolveNextValue(
        normalized.carreraId,
        current.carreraId ?? null,
      );
      const nextSemestre = resolveNextValue(
        normalized.semestre,
        current.semestre ?? null,
      );
      if (!nextNumeroControl || !nextCarreraId || !nextSemestre) {
        throw new BadRequestException(
          'Un alumno requiere número de control, carrera y semestre',
        );
      }
    }

    if (normalized.carreraId) {
      const carrera = await tx.carrera.findUnique({
        where: { id: normalized.carreraId },
        select: { id: true },
      });
      if (!carrera) throw new NotFoundException('Carrera no encontrada');
    }

    return { carreraId: normalized.carreraId, semestre: normalized.semestre };
  }

  private async resolveAcademias(
    tx: Prisma.TransactionClient,
    params: {
      normalized: AdminUpdateUserDto;
      nextRol: Rol;
      roleChanged: boolean;
    },
  ): Promise<Prisma.AcademiaUpdateManyWithoutDocentesNestedInput | undefined> {
    const { normalized, nextRol, roleChanged } = params;

    if (nextRol !== Rol.DOCENTE) {
      return roleChanged ? { set: [] } : undefined;
    }
    if (normalized.academiaId === undefined) return undefined;
    if (normalized.academiaId === null) return { set: [] };

    const academia = await tx.academia.findFirst({
      where: { id: normalized.academiaId, activo: true },
      select: { id: true },
    });
    if (!academia) throw new NotFoundException('Academia no encontrada');
    return { set: [{ id: normalized.academiaId }] };
  }

  private async syncCarrerasJefe(
    tx: Prisma.TransactionClient,
    params: {
      id: number;
      normalized: AdminUpdateUserDto;
      nextRol: Rol;
      roleChanged: boolean;
    },
  ) {
    const { id, normalized, nextRol, roleChanged } = params;

    if (nextRol !== Rol.JEFE_CARRERA) {
      if (roleChanged) {
        await tx.jefeCarreraAsignacion.deleteMany({ where: { usuarioId: id } });
      }
      return;
    }

    if (normalized.carreraIds === undefined) {
      if (!roleChanged) return;
      const asignadas = await tx.jefeCarreraAsignacion.count({
        where: { usuarioId: id },
      });
      if (asignadas) return;
      throw new ConflictException('Selecciona al menos una carrera');
    }

    await this.validarCarrerasJefe(normalized.carreraIds, tx);
    await tx.jefeCarreraAsignacion.deleteMany({ where: { usuarioId: id } });
    await tx.jefeCarreraAsignacion.createMany({
      data: normalized.carreraIds.map((carreraId) => ({
        usuarioId: id,
        carreraId,
      })),
    });
  }

  async approveRegistration(id: number, adminUserId: number) {
    const requireEmailVerification =
      this.config.get<string>('AUTH_EMAIL_ENABLED') === 'true';
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.usuario.findUnique({
        where: { id },
        select: {
          id: true,
          rol: true,
          activo: true,
          email: true,
          emailVerificadoAt: true,
          registroAprobado: true,
          carreraId: true,
          semestre: true,
          grupoId: true,
        },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado');
      if (user.rol !== Rol.ALUMNO) {
        throw new ConflictException('Sólo se aprueban registros de alumnos');
      }
      if (!user.activo) {
        throw new ConflictException('La cuenta está desactivada');
      }
      if (user.registroAprobado) {
        return { id: user.id, registroAprobado: true };
      }
      if (
        requireEmailVerification &&
        (!user.email || !user.emailVerificadoAt)
      ) {
        throw new ConflictException(
          'El alumno debe verificar su correo antes de ser aprobado',
        );
      }

      const approved = await tx.usuario.updateMany({
        where: {
          id,
          rol: Rol.ALUMNO,
          activo: true,
          registroAprobado: false,
          ...(requireEmailVerification
            ? { emailVerificadoAt: { not: null } }
            : {}),
        },
        data: {
          registroAprobado: true,
          tokenVersion: { increment: 1 },
        },
      });
      if (approved.count !== 1) {
        throw new ConflictException(
          'El estado de la cuenta cambió; actualiza la lista e intenta nuevamente',
        );
      }
      const grupo = await this.asignarGrupoDeSuSemestre(tx, user);

      const updated = await tx.usuario.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          nombre: true,
          email: true,
          registroAprobado: true,
        },
      });
      await tx.authAudit.create({
        data: {
          usuarioId: id,
          tipo: TipoEventoAuth.CUENTA_APROBADA,
          metadata: { adminUserId, grupoAsignadoId: grupo?.id ?? null },
        },
      });
      return { ...updated, grupo };
    });
  }

  /**
   * Al aprobar, el alumno entra al grupo de su carrera y semestre. Sólo se hace
   * cuando hay uno solo: con varias secciones la elección es del administrador.
   */
  private async asignarGrupoDeSuSemestre(
    tx: Prisma.TransactionClient,
    user: {
      id: number;
      carreraId: number | null;
      semestre: number | null;
      grupoId: number | null;
    },
  ) {
    if (user.grupoId || !user.carreraId || !user.semestre) return null;

    const candidatos = await tx.grupo.findMany({
      where: {
        carreraId: user.carreraId,
        semestre: user.semestre,
        activo: true,
      },
      select: { id: true, nombre: true, periodo: true },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    if (candidatos.length !== 1) return null;

    await tx.usuario.update({
      where: { id: user.id },
      data: { grupoId: candidatos[0].id },
    });
    return candidatos[0];
  }

  async remove(id: number, adminUserId: number) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.usuario.findUnique({
            where: { id },
            select: { id: true, rol: true, activo: true },
          });
          if (!current) throw new NotFoundException('Usuario no encontrado');

          await this.ensureActiveAdminRemains(tx, current, { activo: false });

          const updated = await tx.usuario.update({
            where: { id },
            data: { activo: false, tokenVersion: { increment: 1 } },
            select: {
              id: true,
              nombre: true,
              rol: true,
              activo: true,
            },
          });
          await tx.authAudit.create({
            data: {
              usuarioId: id,
              tipo: TipoEventoAuth.CUENTA_DESACTIVADA,
              metadata: { adminUserId },
            },
          });
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAdminMutationConflict(error);
    }
  }

  /**
   * Borrado definitivo de la cuenta y de todo su historial académico
   * (inscripciones, asistencias, calificaciones, entregas y, para un docente,
   * sus tareas, sesiones de clase y horarios). Sólo se conservan la propia
   * cuenta de quien elimina y el último administrador activo.
   */
  async removePermanently(id: number, adminUserId: number) {
    if (id === adminUserId) {
      throw new ConflictException('No puedes eliminar tu propia cuenta');
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.usuario.findUnique({
            where: { id },
            select: {
              id: true,
              nombre: true,
              email: true,
              numeroControl: true,
              username: true,
              rol: true,
              activo: true,
            },
          });
          if (!current) throw new NotFoundException('Usuario no encontrado');

          await this.ensureActiveAdminRemains(tx, current, { activo: false });

          const historial = await this.purgarHistorialAcademico(tx, id);

          // Las materias, asistencias de terceros y alertas se conservan: sólo
          // pierden la referencia a la cuenta eliminada.
          await tx.materia.updateMany({
            where: { docenteId: id },
            data: { docenteId: null },
          });
          await tx.asistencia.updateMany({
            where: { editadaPorId: id },
            data: { editadaPorId: null },
          });
          await tx.alertaCarrera.updateMany({
            where: { responsableId: id },
            data: { responsableId: null },
          });

          const eliminado = await tx.usuario.delete({
            where: { id },
            select: { id: true, nombre: true, rol: true },
          });
          await tx.authAudit.create({
            data: {
              tipo: TipoEventoAuth.CUENTA_ELIMINADA,
              identifier:
                current.email ?? current.numeroControl ?? current.username,
              metadata: {
                adminUserId,
                usuarioEliminadoId: id,
                nombre: current.nombre,
                rol: current.rol,
                historial,
              },
            },
          });
          return { ...eliminado, historial };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // Una cuenta con años de historial encadena varios borrados.
          maxWait: 10_000,
          timeout: 30_000,
        },
      );
    } catch (error) {
      this.rethrowAdminMutationConflict(error);
    }
  }

  /**
   * Borra todo lo que cuelga de la cuenta para que pueda eliminarse: primero
   * las filas hijas (asistencias y entregas) y luego las que apuntan directo
   * al usuario. Devuelve el resumen para dejarlo en la bitácora.
   */
  private async purgarHistorialAcademico(
    tx: Prisma.TransactionClient,
    id: number,
  ) {
    const asistenciasAlumno = await tx.asistencia.deleteMany({
      where: { alumnoId: id },
    });
    const asistenciasDeSusClases = await tx.asistencia.deleteMany({
      where: { claseSesion: { docenteId: id } },
    });
    const entregasAlumno = await tx.entregaTarea.deleteMany({
      where: { alumnoId: id },
    });
    const entregasDeSusTareas = await tx.entregaTarea.deleteMany({
      where: { tarea: { docenteId: id } },
    });
    const tareas = await tx.tarea.deleteMany({ where: { docenteId: id } });
    const sesiones = await tx.claseSesion.deleteMany({
      where: { docenteId: id },
    });
    const horarios = await tx.horarioMateria.deleteMany({
      where: { docenteId: id },
    });
    const inscripciones = await tx.inscripcion.deleteMany({
      where: { alumnoId: id },
    });
    const calificaciones = await tx.calificacionUnidad.deleteMany({
      where: { alumnoId: id },
    });
    const importaciones = await tx.importacionHorario.deleteMany({
      where: { alumnoId: id },
    });
    const notificaciones = await tx.notificacion.deleteMany({
      where: { usuarioId: id },
    });

    return {
      asistencias: asistenciasAlumno.count + asistenciasDeSusClases.count,
      entregas: entregasAlumno.count + entregasDeSusTareas.count,
      tareas: tareas.count,
      sesiones: sesiones.count,
      horarios: horarios.count,
      inscripciones: inscripciones.count,
      calificaciones: calificaciones.count,
      importaciones: importaciones.count,
      notificaciones: notificaciones.count,
    };
  }

  async asignarCarrerasJefe(id: number, carreraIds: number[]) {
    const usuario = await this.findOne(id);
    if (usuario.rol !== Rol.JEFE_CARRERA) {
      throw new ConflictException('El usuario no tiene rol de jefe de carrera');
    }
    await this.validarCarrerasJefe(carreraIds);
    await this.prisma.$transaction([
      this.prisma.jefeCarreraAsignacion.deleteMany({
        where: { usuarioId: id },
      }),
      this.prisma.jefeCarreraAsignacion.createMany({
        data: carreraIds.map((carreraId) => ({ usuarioId: id, carreraId })),
      }),
    ]);
    return this.findOne(id);
  }

  private async validarCarrerasJefe(
    carreraIds: number[],
    client: Prisma.TransactionClient = this.prisma,
  ) {
    if (!carreraIds.length) {
      throw new ConflictException('Selecciona al menos una carrera');
    }
    const total = await client.carrera.count({
      where: { id: { in: carreraIds.map(Number) } },
    });
    if (total !== carreraIds.length) {
      throw new NotFoundException('Una o más carreras no existen');
    }
  }

  private async ensureActiveAdminRemains(
    tx: Prisma.TransactionClient,
    current: { id: number; rol: Rol; activo: boolean },
    next: { rol?: Rol; activo?: boolean },
  ) {
    const nextRole = next.rol ?? current.rol;
    const nextActive = next.activo ?? current.activo;
    const removesActiveAdmin =
      current.rol === Rol.ADMIN &&
      current.activo &&
      (nextRole !== Rol.ADMIN || !nextActive);

    if (!removesActiveAdmin) return;

    const otherActiveAdmins = await tx.usuario.count({
      where: {
        rol: Rol.ADMIN,
        activo: true,
        id: { not: current.id },
      },
    });
    if (otherActiveAdmins === 0) {
      throw new ConflictException(
        'Debe permanecer al menos un administrador activo',
      );
    }
  }

  private rethrowAdminMutationConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034') {
        throw new ConflictException(
          'El estado de los administradores cambió; actualiza la lista e intenta nuevamente',
        );
      }
      // Cualquier registro enlazado que no cubra la validación previa debe
      // reportarse como conflicto, no como error interno.
      if (error.code === 'P2003') {
        throw new ConflictException(
          'El usuario tiene información enlazada en el sistema y no puede eliminarse. Desactiva la cuenta para conservar el historial.',
        );
      }
    }
    throw error;
  }

  private async ensureIdentifiersAvailable(
    tx: Prisma.TransactionClient,
    input: {
      email?: string | null;
      numeroControl?: string | null;
      username?: string | null;
    },
    excludeUserId?: number,
  ) {
    const values = [input.email, input.numeroControl, input.username].filter(
      (value): value is string => Boolean(value),
    );
    if (!values.length) return;

    const identityFilters: Prisma.UsuarioWhereInput[] = values.flatMap(
      (value) => [
        { email: { equals: value, mode: 'insensitive' } },
        { numeroControl: { equals: value, mode: 'insensitive' } },
        { username: { equals: value, mode: 'insensitive' } },
      ],
    );
    const existing = await tx.usuario.findFirst({
      where: {
        id: excludeUserId ? { not: excludeUserId } : undefined,
        OR: identityFilters,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'El correo, usuario o número de control ya está registrado',
      );
    }
  }
}
