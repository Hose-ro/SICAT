import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

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
