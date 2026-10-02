import {
  Controller,
  ForbiddenException,
  Post,
  Body,
  Get,
  Req,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PublicStudentRegisterDto } from './dto/public-student-register.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthenticatedRequest, AuthRequestContext } from './auth.types';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieClearOptions,
  getAuthCookieOptions,
} from './auth-cookie';
import { JwtAuthGuard } from './jwt-auth.guard';
import { horarioFotoUploadOptions } from '../horario-importaciones/horario-importaciones.storage';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @UseInterceptors(FileInterceptor('fotoHorario', horarioFotoUploadOptions))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  register(
    @Body() dto: PublicStudentRegisterDto,
    @Req() request: ExpressRequest,
    @UploadedFile() fotoHorario?: Express.Multer.File,
  ) {
    // La escuela da de alta a los alumnos: el autoregistro sólo vuelve si se
    // habilita a propósito, para que nadie cree perfiles duplicados.
    if (this.config.get<string>('REGISTRO_PUBLICO_HABILITADO') !== 'true') {
      throw new ForbiddenException(
        'El registro está cerrado. Tu escuela crea tu cuenta: actívala con tu número de control y tu código.',
      );
    }
    return this.auth.register(
      dto,
      this.getRequestContext(request),
      fotoHorario,
    );
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Iniciar sesión (username o número de control)',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto, this.getRequestContext(request));
    response.cookie(
      AUTH_COOKIE_NAME,
      result.accessToken,
      getAuthCookieOptions(this.config),
    );
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  me(@Req() req: AuthenticatedRequest) {
    return {
      id: req.user.id,
      nombre: req.user.nombre,
      email: req.user.email,
      numeroControl: req.user.numeroControl,
      username: req.user.username,
      rol: req.user.rol,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión de este dispositivo' })
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      await this.auth.logout(
        req.user.id,
        req.user.sid,
        this.getRequestContext(req),
      );
    } finally {
      response.clearCookie(
        AUTH_COOKIE_NAME,
        getAuthCookieClearOptions(this.config),
      );
    }
    return { message: 'Sesión cerrada correctamente' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.changePassword(
      req.user.id,
      req.user.sid,
      body.currentPassword,
      body.newPassword,
      this.getRequestContext(req),
    );
    response.cookie(
      AUTH_COOKIE_NAME,
      result.accessToken,
      getAuthCookieOptions(this.config),
    );
    return { message: result.message };
  }

  @Post('request-email-verification')
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Reenviar verificación de correo' })
  requestEmailVerification(
    @Body() body: RequestEmailVerificationDto,
    @Req() request: ExpressRequest,
  ) {
    return this.auth.requestEmailVerification(
      body.email,
      this.getRequestContext(request),
    );
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Verificar correo con token de un solo uso' })
  verifyEmail(@Body() body: VerifyEmailDto, @Req() request: ExpressRequest) {
    return this.auth.verifyEmail(body.token, this.getRequestContext(request));
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  forgotPassword(
    @Body() body: ForgotPasswordDto,
    @Req() request: ExpressRequest,
  ) {
    return this.auth.forgotPassword(
      body.identifier,
      this.getRequestContext(request),
    );
  }

  @Post('activar')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({
    summary: 'Activar la cuenta del alumno con su número de control y código',
  })
  activar(@Body() dto: ActivarCuentaDto, @Req() request: ExpressRequest) {
    return this.auth.activarCuenta(dto, this.getRequestContext(request));
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Restablecer contraseña con token de un solo uso' })
  resetPassword(
    @Body() body: ResetPasswordDto,
    @Req() request: ExpressRequest,
  ) {
    return this.auth.resetPassword(
      body.token,
      body.newPassword,
      this.getRequestContext(request),
    );
  }

  private getRequestContext(request: ExpressRequest): AuthRequestContext {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
