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
        carrera: true,
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
        carrera: true,
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
      email: dto.email ? normalizeEmail(dto.email) : undefined,
      numeroControl: dto.numeroControl
        ? normalizeControlNumber(dto.numeroControl)
        : undefined,
      username: dto.username ? normalizeUsername(dto.username) : undefined,
      telefono: dto.telefono ? normalizePhone(dto.telefono) : undefined,
    };
    const password = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.usuario.findUnique({
            where: { id },
            select: { id: true, email: true, rol: true, activo: true },
          });
          if (!current) throw new NotFoundException('Usuario no encontrado');

          await this.ensureActiveAdminRemains(tx, current, {
            rol: normalized.rol,
            activo: normalized.activo,
          });
          await this.ensureIdentifiersAvailable(tx, normalized, id);

          const roleChanged =
            normalized.rol !== undefined && normalized.rol !== current.rol;
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
              carreraId: normalized.carreraId,
              semestre: normalized.semestre,
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
              activo: true,
              registroAprobado: true,
              carrera: true,
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
          metadata: { adminUserId },
        },
      });
      return updated;
    });
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

  private async validarCarrerasJefe(carreraIds: number[]) {
    if (!carreraIds.length) {
      throw new ConflictException('Selecciona al menos una carrera');
    }
    const total = await this.prisma.carrera.count({
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException(
        'El estado de los administradores cambió; actualiza la lista e intenta nuevamente',
      );
    }
    throw error;
  }

  private async ensureIdentifiersAvailable(
    tx: Prisma.TransactionClient,
    input: {
      email?: string;
      numeroControl?: string;
      username?: string;
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
