import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { extractAuthCookie } from './auth-cookie';
import {
  AUTH_JWT_ALGORITHM,
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
} from './auth-session.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly requireVerifiedEmail: boolean;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractAuthCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: [AUTH_JWT_ALGORITHM],
      audience: AUTH_JWT_AUDIENCE,
      issuer: AUTH_JWT_ISSUER,
    });
    this.requireVerifiedEmail =
      config.get<string>('AUTH_EMAIL_ENABLED') === 'true';
  }

  async validate(payload: { sub?: unknown; ver?: unknown }) {
    if (
      typeof payload?.sub !== 'number' ||
      !Number.isInteger(payload.sub) ||
      payload.sub <= 0 ||
      typeof payload.ver !== 'number' ||
      !Number.isInteger(payload.ver) ||
      payload.ver < 0
    ) {
      throw new UnauthorizedException('La sesión no contiene datos válidos');
    }

    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nombre: true,
        email: true,
        numeroControl: true,
        username: true,
        rol: true,
        activo: true,
        registroAprobado: true,
        emailVerificadoAt: true,
        tokenVersion: true,
      },
    });

    if (
      !user ||
      !user.activo ||
      !user.registroAprobado ||
      (this.requireVerifiedEmail &&
        Boolean(user.email) &&
        !user.emailVerificadoAt) ||
      user.tokenVersion !== payload.ver
    ) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }

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
}
