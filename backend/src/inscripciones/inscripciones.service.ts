import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SolicitarInscripcionDto } from './dto/solicitar-inscripcion.dto';
import { TipoNotificacion } from '@prisma/client';

@Injectable()
export class InscripcionesService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  async solicitar(alumnoId: number, dto: SolicitarInscripcionDto) {
    const existe = await this.prisma.inscripcion.findUnique({
      where: {
        alumnoId_materiaId_periodo: {
          alumnoId,
          materiaId: dto.materiaId,
          periodo: dto.periodo,
        },
      },
    });
    if (existe)
      throw new ConflictException(
        'Ya existe una solicitud para esta materia en este periodo',
      );

    const materia = await this.prisma.materia.findUnique({
      where: { id: dto.materiaId },
      include: { docente: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const inscripcion = await this.prisma.inscripcion.create({
      data: { alumnoId, materiaId: dto.materiaId, periodo: dto.periodo },
    });

    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
    });

    if (materia.docenteId) {
      await this.notificaciones.crear({
        usuarioId: materia.docenteId,
        tipo: TipoNotificacion.INSCRIPCION_NUEVA,
        titulo: 'Nueva solicitud de inscripción',
        mensaje: `${alumno?.nombre ?? 'Un alumno'} solicita inscribirse a ${materia.nombre}`,
        referenciaId: inscripcion.id,
        referenciaTipo: 'Inscripcion',
      });
    }

    return inscripcion;
  }

  async obtenerMisSolicitudes(alumnoId: number) {
    return this.prisma.inscripcion.findMany({
      where: { alumnoId },
      include: { materia: { include: { docente: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obtenerPendientes(docenteId: number) {
    return this.prisma.inscripcion.findMany({
      where: { estado: 'PENDIENTE', materia: { docenteId } },
      include: { alumno: true, materia: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async aceptar(id: number, docenteId: number) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: { materia: true },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');
    if (inscripcion.materia.docenteId !== docenteId)
      throw new ForbiddenException();
    if (inscripcion.estado !== 'PENDIENTE')
      throw new ConflictException('La solicitud ya fue procesada');

    const updated = await this.prisma.inscripcion.update({
      where: { id },
      data: { estado: 'ACEPTADA' },
    });

    await this.notificaciones.crear({
      usuarioId: inscripcion.alumnoId,
      tipo: TipoNotificacion.INSCRIPCION_ACEPTADA,
      titulo: 'Inscripción aceptada',
      mensaje: `Tu inscripción a ${inscripcion.materia.nombre} fue aceptada`,
      referenciaId: id,
      referenciaTipo: 'Inscripcion',
    });

    return updated;
  }

  async rechazar(id: number, docenteId: number) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: { materia: true },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');
    if (inscripcion.materia.docenteId !== docenteId)
      throw new ForbiddenException();
    if (inscripcion.estado !== 'PENDIENTE')
      throw new ConflictException('La solicitud ya fue procesada');

    const updated = await this.prisma.inscripcion.update({
      where: { id },
      data: { estado: 'RECHAZADA' },
    });

    await this.notificaciones.crear({
      usuarioId: inscripcion.alumnoId,
      tipo: TipoNotificacion.INSCRIPCION_RECHAZADA,
      titulo: 'Inscripción rechazada',
      mensaje: `Tu inscripción a ${inscripcion.materia.nombre} fue rechazada`,
      referenciaId: id,
      referenciaTipo: 'Inscripcion',
    });

    return updated;
  }

  async obtenerAlumnosMateria(materiaId: number, docenteId: number) {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
    });
    if (!materia || materia.docenteId !== docenteId)
      throw new ForbiddenException();

    return this.prisma.inscripcion.findMany({
      where: { materiaId, estado: 'ACEPTADA' },
      include: { alumno: true },
    });
  }

  async obtenerMisMaterias(alumnoId: number, periodo?: string) {
    return this.prisma.inscripcion.findMany({
      where: { alumnoId, estado: 'ACEPTADA', ...(periodo && { periodo }) },
      include: { materia: { include: { docente: true } } },
    });
  }
}
