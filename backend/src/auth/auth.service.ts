import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Rol } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsuariosService } from '../usuarios/usuarios.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private usuarios: UsuariosService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.rol && dto.rol !== Rol.ALUMNO) {
      throw new ForbiddenException(
        'El registro público solo está disponible para alumnos',
      );
    }

    let googleId: string | undefined;
    let avatar: string | undefined;

    if (dto.pendingGoogleToken) {
      let payload: any;
      try {
        payload = this.jwt.verify(dto.pendingGoogleToken);
      } catch {
        throw new UnauthorizedException(
          'El token de Google expiró o es inválido. Vuelve a iniciar sesión con Google.',
        );
      }
      if (payload?.type !== 'google_pending') {
        throw new UnauthorizedException('Token de tipo incorrecto.');
      }
      googleId = payload.googleId as string;
      avatar = payload.avatar as string | undefined;
    }

    if (!dto.password && !googleId) {
      throw new ForbiddenException(
        'Se requiere contraseña para el registro normal.',
      );
    }

    const user = await this.usuarios.create(
      { ...dto, rol: Rol.ALUMNO, username: undefined, academiaId: undefined },
      { googleId, avatar },
    );

    if (googleId) {
      // Auto-login: el usuario no necesita ir a /login de nuevo
      const payload = { sub: user.id, rol: user.rol, email: user.email };
      return {
        access_token: this.jwt.sign(payload),
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          numeroControl: user.numeroControl,
          username: user.username,
          rol: user.rol,
        },
      };
    }

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.usuario.findFirst({
      where: {
        OR: [
          { email: dto.identifier },
          { numeroControl: dto.identifier },
          { username: dto.identifier },
        ],
        activo: true,
      },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const payload = { sub: user.id, rol: user.rol, email: user.email };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        numeroControl: user.numeroControl,
        username: user.username,
        rol: user.rol,
      },
    };
  }

  async googleLogin(googleUser: {
    googleId: string;
    nombre: string;
    email: string;
    avatar?: string;
  }): Promise<
    | { status: 'login'; access_token: string; user: object }
    | { status: 'pending'; pendingToken: string; nombre: string; email: string }
  > {
    const existing = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      },
    });

    if (!existing) {
      const pendingToken = this.jwt.sign(
        {
          googleId: googleUser.googleId,
          avatar: googleUser.avatar,
          nombre: googleUser.nombre,
          email: googleUser.email,
          type: 'google_pending',
        },
        { expiresIn: '15m' },
      );
      return {
        status: 'pending',
        pendingToken,
        nombre: googleUser.nombre,
        email: googleUser.email,
      };
    }

    const user = await this.prisma.usuario.update({
      where: { id: existing.id },
      data: { googleId: googleUser.googleId, avatar: googleUser.avatar },
    });

    const payload = { sub: user.id, rol: user.rol, email: user.email };
    return {
      status: 'login',
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        numeroControl: user.numeroControl,
        username: user.username,
        rol: user.rol,
        avatar: user.avatar,
      },
    };
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid)
      throw new UnauthorizedException('La contraseña actual es incorrecta');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { password: hash },
    });
    return { message: 'Contraseña actualizada correctamente' };
  }
}
