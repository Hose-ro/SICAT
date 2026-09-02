import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Rol, TipoEventoAuth, TipoTokenAuth } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { PublicStudentRegisterDto } from './dto/public-student-register.dto';
import { AuthMailService } from './auth-mail.service';
import { HorarioImportacionesService } from '../horario-importaciones/horario-importaciones.service';
import type { AuthenticatedUser, AuthRequestContext } from './auth.types';
import { normalizeEmail } from '../common/identity-normalization';

const DUMMY_PASSWORD_HASH =
  '$2b$12$uVYO5z6fujxGJDT3UpVGd.exDoCLdQodzlaGh/L27ja9Midx1/ete';
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
const VERIFICATION_TOKEN_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private usuarios: UsuariosService,
    private mail: AuthMailService,
    private horarioImportaciones: HorarioImportacionesService,
  ) {}

  async register(
    dto: PublicStudentRegisterDto,
    context: AuthRequestContext = {},
    fotoHorario?: Express.Multer.File,
  ) {
    const emailEnabled = this.mail.isEmailEnabled();
    if (emailEnabled) {
      this.mail.assertAvailableForPublicRegistration();
    }
    const { periodo, seccion, usarHorarioExistente, ...datosUsuario } = dto;
    const user = await this.usuarios.create(
      {
        ...datosUsuario,
        rol: Rol.ALUMNO,
      },
      { publicRegistration: true },
    );
    if (emailEnabled && !user.email) {
      throw new BadRequestException('El registro requiere un correo válido');
    }
    await this.audit(TipoEventoAuth.REGISTRO, context, {
      userId: user.id,
      identifier: user.numeroControl ?? user.email ?? undefined,
    });

    let delivery: Awaited<ReturnType<AuthMailService['sendVerification']>> = {
      sent: false,
    };
    if (emailEnabled && user.email) {
      const token = await this.createAuthToken(
        user.id,
        TipoTokenAuth.VERIFICACION_CORREO,
        VERIFICATION_TOKEN_MS,
        user.email,
      );
      try {
        delivery = await this.mail.sendVerification(
          user.email,
          user.nombre,
          token,
        );
      } catch (error) {
        this.logMailFailure('verificación de registro', error);
      }
    }

    let horario: Record<string, unknown> = { estado: 'NO_SOLICITADO' };
    try {
      horario = await this.horarioImportaciones.registrarDesdeRegistro(
        {
          id: user.id,
          carreraId: user.carrera?.id ?? null,
          semestre: user.semestre,
        },
        { periodo, seccion, usarHorarioExistente },
        fotoHorario,
      );
    } catch (error: unknown) {
      this.logger.error(
        `No se pudo registrar el horario del alumno ${user.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      horario = {
        estado: 'ERROR',
        mensaje:
          'Recibimos tu fotografía. El horario quedó pendiente de revisión.',
      };
    }

    return {
      message: emailEnabled
        ? 'Registro recibido. Verifica tu correo y espera la aprobación administrativa.'
        : 'Registro recibido. Espera la aprobación administrativa.',
      emailSent: delivery.sent,
      developmentVerificationUrl: delivery.developmentUrl,
      horario,
    };
  }

  async login(dto: LoginDto, context: AuthRequestContext = {}) {
    const users = await this.findUsersByIdentifier(dto.identifier);
    if (users.length !== 1) {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      await this.audit(TipoEventoAuth.LOGIN_FALLIDO, context, {
        identifier: dto.identifier,
        metadata: {
          reason: users.length > 1 ? 'ambiguous_identifier' : 'unknown',
        },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const user = users[0];
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit(TipoEventoAuth.LOGIN_FALLIDO, context, {
        userId: user.id,
        identifier: dto.identifier,
        metadata: { reason: 'locked' },
      });
      throw new HttpException(
        'Cuenta temporalmente bloqueada. Intenta nuevamente más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.recordFailedLogin(
        user.id,
        dto.identifier,
        context,
        Boolean(user.lockedUntil),
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.activo) {
      await this.audit(TipoEventoAuth.LOGIN_FALLIDO, context, {
        userId: user.id,
        identifier: dto.identifier,
        metadata: { reason: 'inactive' },
      });
      throw new ForbiddenException('La cuenta está desactivada');
    }
    if (this.mail.isEmailEnabled() && user.email && !user.emailVerificadoAt) {
      await this.audit(TipoEventoAuth.LOGIN_FALLIDO, context, {
        userId: user.id,
        identifier: dto.identifier,
        metadata: { reason: 'email_unverified' },
      });
      throw new ForbiddenException('Debes verificar tu correo electrónico');
    }
    if (!user.registroAprobado) {
      await this.audit(TipoEventoAuth.LOGIN_FALLIDO, context, {
        userId: user.id,
        identifier: dto.identifier,
        metadata: { reason: 'approval_pending' },
      });
      throw new ForbiddenException(
        'El registro aún está pendiente de aprobación administrativa',
      );
    }

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.audit(TipoEventoAuth.LOGIN_EXITOSO, context, {
      userId: user.id,
      identifier: dto.identifier,
    });
    return {
      accessToken: this.signAccessToken(user),
      user: this.toAuthUser(user),
    };
  }

  async logout(userId: number, context: AuthRequestContext = {}) {
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
      await tx.authAudit.create({
        data: {
          usuarioId: userId,
          tipo: TipoEventoAuth.LOGOUT,
          ip: context.ip,
          userAgent: context.userAgent,
        },
      });
    });
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    context: AuthRequestContext = {},
  ) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const updated = await this.prisma.$transaction(async (tx) => {
      const account = await tx.usuario.update({
        where: { id: userId },
        data: {
          password: hash,
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          numeroControl: true,
          username: true,
          rol: true,
          tokenVersion: true,
        },
      });
      await tx.authToken.updateMany({
        where: {
          usuarioId: userId,
          tipo: TipoTokenAuth.RECUPERACION_PASSWORD,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      await tx.authAudit.create({
        data: {
          usuarioId: userId,
          tipo: TipoEventoAuth.CAMBIO_PASSWORD,
          ip: context.ip,
          userAgent: context.userAgent,
        },
      });
      return account;
    });

    return {
      message: 'Contraseña actualizada correctamente',
      accessToken: this.signAccessToken(updated),
    };
  }

  async requestEmailVerification(
    email: string,
    context: AuthRequestContext = {},
  ) {
    this.mail.assertAvailableForPublicRegistration();
    const user = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, activo: true },
      select: { id: true, nombre: true, email: true, emailVerificadoAt: true },
    });
    if (!user?.email || user.emailVerificadoAt) {
      return {
        message: 'Si el correo requiere verificación, enviaremos un enlace.',
      };
    }

    const token = await this.createAuthToken(
      user.id,
      TipoTokenAuth.VERIFICACION_CORREO,
      VERIFICATION_TOKEN_MS,
      user.email,
    );
    let developmentVerificationUrl: string | undefined;
    try {
      const delivery = await this.mail.sendVerification(
        user.email,
        user.nombre,
        token,
      );
      developmentVerificationUrl = delivery.developmentUrl;
    } catch (error) {
      this.logMailFailure('reenvío de verificación', error);
    }
    await this.audit(TipoEventoAuth.REGISTRO, context, {
      userId: user.id,
      identifier: user.email,
      metadata: { action: 'verification_resent' },
    });
    return {
      message: 'Si el correo requiere verificación, enviaremos un enlace.',
      developmentVerificationUrl,
    };
  }

  async verifyEmail(token: string, context: AuthRequestContext = {}) {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        usuarioId: true,
        tipo: true,
        targetHash: true,
        expiresAt: true,
        usedAt: true,
      },
    });
    if (
      !record ||
      record.tipo !== TipoTokenAuth.VERIFICACION_CORREO ||
      record.usedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new BadRequestException('El enlace es inválido o ya expiró');
    }

    const verified = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.authToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('El enlace ya fue utilizado');
      }
      const user = await tx.usuario.findUnique({
        where: { id: record.usuarioId },
        select: { email: true, activo: true },
      });
      if (!this.tokenMatchesIdentity(record.targetHash, user)) {
        return false;
      }
      await tx.usuario.update({
        where: { id: record.usuarioId },
        data: { emailVerificadoAt: new Date(), tokenVersion: { increment: 1 } },
      });
      await tx.authAudit.create({
        data: {
          usuarioId: record.usuarioId,
          tipo: TipoEventoAuth.CORREO_VERIFICADO,
          ip: context.ip,
          userAgent: context.userAgent,
        },
      });
      return true;
    });

    if (!verified) {
      throw new BadRequestException('El enlace es inválido o ya expiró');
    }

    return {
      message:
        'Correo verificado. Tu cuenta queda pendiente de aprobación administrativa.',
    };
  }

  async forgotPassword(identifier: string, context: AuthRequestContext = {}) {
    this.mail.assertAvailableForPublicRegistration();
    const users = await this.findUsersByIdentifier(identifier);
    const user = users.length === 1 ? users[0] : null;
    let developmentResetUrl: string | undefined;

    if (user?.activo && user.email && user.emailVerificadoAt) {
      const token = await this.createAuthToken(
        user.id,
        TipoTokenAuth.RECUPERACION_PASSWORD,
        PASSWORD_RESET_TOKEN_MS,
        user.email,
      );
      try {
        const delivery = await this.mail.sendPasswordReset(
          user.email,
          user.nombre,
          token,
        );
        developmentResetUrl = delivery.developmentUrl;
      } catch (error) {
        this.logMailFailure('recuperación de contraseña', error);
      }
    }

    await this.audit(TipoEventoAuth.SOLICITUD_RECUPERACION, context, {
      userId: user?.id,
      identifier,
    });
    return {
      message:
        'Si la cuenta existe y tiene un correo verificado, enviaremos un enlace.',
      developmentResetUrl,
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    context: AuthRequestContext = {},
  ) {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        usuarioId: true,
        tipo: true,
        targetHash: true,
        expiresAt: true,
        usedAt: true,
      },
    });
    if (
      !record ||
      record.tipo !== TipoTokenAuth.RECUPERACION_PASSWORD ||
      record.usedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new BadRequestException('El enlace es inválido o ya expiró');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const reset = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.authToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('El enlace ya fue utilizado');
      }
      const user = await tx.usuario.findUnique({
        where: { id: record.usuarioId },
        select: { email: true, activo: true },
      });
      if (!this.tokenMatchesIdentity(record.targetHash, user)) {
        return false;
      }
      await tx.usuario.update({
        where: { id: record.usuarioId },
        data: {
          password: hash,
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.authAudit.create({
        data: {
          usuarioId: record.usuarioId,
          tipo: TipoEventoAuth.PASSWORD_RESTABLECIDA,
          ip: context.ip,
          userAgent: context.userAgent,
        },
      });
      return true;
    });

    if (!reset) {
      throw new BadRequestException('El enlace es inválido o ya expiró');
    }

    return { message: 'Contraseña restablecida correctamente' };
  }

  private async recordFailedLogin(
    userId: number,
    identifier: string,
    context: AuthRequestContext,
    resetExpiredLock: boolean,
  ) {
    const account = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: resetExpiredLock ? 1 : { increment: 1 },
        lockedUntil: null,
      },
      select: { failedLoginAttempts: true },
    });
    const attempts = account.failedLoginAttempts;
    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.prisma.usuario.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_MS) },
      });
    }
    await this.audit(TipoEventoAuth.LOGIN_FALLIDO, context, {
      userId,
      identifier,
      metadata: { attempts },
    });
  }

  private findUsersByIdentifier(identifier: string) {
    const normalized = identifier.trim();
    const identityFilters: Prisma.UsuarioWhereInput[] = [
      { numeroControl: { equals: normalized, mode: 'insensitive' } },
      { username: { equals: normalized, mode: 'insensitive' } },
    ];
    if (this.mail.isEmailEnabled()) {
      identityFilters.push({
        email: { equals: normalized, mode: 'insensitive' },
      });
    }
    return this.prisma.usuario.findMany({
      where: {
        OR: identityFilters,
      },
      take: 2,
    });
  }

  private async createAuthToken(
    userId: number,
    type: TipoTokenAuth,
    ttlMs: number,
    target: string,
  ) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({
        where: { usuarioId: userId, tipo: type, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.authToken.create({
        data: {
          usuarioId: userId,
          tipo: type,
          tokenHash,
          targetHash: this.hashIdentity(target),
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      }),
    ]);
    return token;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashIdentity(identity: string) {
    return createHash('sha256').update(normalizeEmail(identity)).digest('hex');
  }

  private tokenMatchesIdentity(
    targetHash: string | null,
    user: { email: string | null; activo: boolean } | null,
  ) {
    return Boolean(
      targetHash &&
      user?.activo &&
      user.email &&
      targetHash === this.hashIdentity(user.email),
    );
  }

  private signAccessToken(user: { id: number; tokenVersion: number }) {
    return this.jwt.sign({ sub: user.id, ver: user.tokenVersion });
  }

  private toAuthUser(user: {
    id: number;
    nombre: string;
    email: string | null;
    numeroControl: string | null;
    username: string | null;
    rol: AuthenticatedUser['rol'];
    tokenVersion: number;
  }): AuthenticatedUser {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      numeroControl: user.numeroControl,
      username: user.username,
      rol: user.rol,
      tokenVersion: user.tokenVersion,
    };
  }

  private async audit(
    type: TipoEventoAuth,
    context: AuthRequestContext,
    data: {
      userId?: number;
      identifier?: string;
      metadata?: Prisma.InputJsonValue;
    } = {},
  ) {
    try {
      await this.prisma.authAudit.create({
        data: {
          usuarioId: data.userId,
          tipo: type,
          identifier: data.identifier,
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(
        `No se pudo escribir la bitácora de autenticación: ${detail}`,
      );
    }
  }

  private logMailFailure(action: string, error: unknown) {
    const detail = error instanceof Error ? error.message : 'error desconocido';
    this.logger.error(`Falló el correo de ${action}: ${detail}`);
  }
}
