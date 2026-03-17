import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.email) {
      const exists = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException('El correo ya está registrado');
    }
    if (dto.numeroControl) {
      const exists = await this.prisma.usuario.findUnique({ where: { numeroControl: dto.numeroControl } });
      if (exists) throw new ConflictException('El número de control ya está registrado');
    }
    if (dto.username) {
      const exists = await this.prisma.usuario.findUnique({ where: { username: dto.username } });
      if (exists) throw new ConflictException('El usuario ya está en uso');
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        numeroControl: dto.numeroControl,
        username: dto.username,
        password: hash,
        rol: dto.rol,
        telefono: dto.telefono,
        carreraId: dto.carreraId ? Number(dto.carreraId) : undefined,
        semestre: dto.semestre ? Number(dto.semestre) : undefined,
      },
      select: { id: true, nombre: true, email: true, numeroControl: true, username: true, rol: true, createdAt: true },
    });
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

    const payload = { sub: user.id, rol: user.rol };
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

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('La contraseña actual es incorrecta');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.usuario.update({ where: { id: userId }, data: { password: hash } });
    return { message: 'Contraseña actualizada correctamente' };
  }
}
