import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Rol } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
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

    return this.usuarios.create({
      ...dto,
      rol: Rol.ALUMNO,
      username: undefined,
      academiaId: undefined,
    });
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
