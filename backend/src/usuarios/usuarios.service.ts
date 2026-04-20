import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Rol, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  async create(dto: RegisterDto) {
    if (dto.email) {
      const exists = await this.prisma.usuario.findUnique({
        where: { email: dto.email },
      });
      if (exists) throw new ConflictException('El correo ya está registrado');
    }

    if (dto.numeroControl) {
      const exists = await this.prisma.usuario.findUnique({
        where: { numeroControl: dto.numeroControl },
      });
      if (exists) {
        throw new ConflictException('El número de control ya está registrado');
      }
    }

    if (dto.username) {
      const exists = await this.prisma.usuario.findUnique({
        where: { username: dto.username },
      });
      if (exists) throw new ConflictException('El usuario ya está en uso');
    }

    if (dto.rol === Rol.DOCENTE && dto.academiaId) {
      const academia = await this.prisma.academia.findFirst({
        where: { id: Number(dto.academiaId), activo: true },
      });
      if (!academia) throw new NotFoundException('Academia no encontrada');
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const usuario = await this.prisma.usuario.create({
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
        academias:
          dto.rol === Rol.DOCENTE && dto.academiaId
            ? { connect: [{ id: Number(dto.academiaId) }] }
            : undefined,
      },
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
        carrera: true,
        createdAt: true,
      },
    });

    await this.notificaciones.crearParaAdmins(
      {
        tipo: TipoNotificacion.NUEVO_USUARIO,
        titulo: 'Nuevo usuario registrado',
        mensaje: `Se registró ${usuario.nombre} en el sistema.`,
        referenciaId: usuario.id,
        referenciaTipo: 'Usuario',
      },
      usuario.rol === Rol.ADMIN ? [usuario.id] : [],
    );

    return usuario;
  }

  findAll(rol?: string) {
    return this.prisma.usuario.findMany({
      where: rol ? { rol: rol as any } : undefined,
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
        carrera: true,
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
        carrera: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.prisma.usuario.update({
      where: { id },
      data,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        telefono: true,
        semestre: true,
        academias: { select: { id: true, nombre: true } },
        activo: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });
  }
}
