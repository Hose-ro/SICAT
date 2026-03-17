import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { IniciarClaseDto } from './dto/iniciar-clase.dto';
import { TipoNotificacion } from '@prisma/client';

@Injectable()
export class ClasesService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  async iniciar(docenteId: number, dto: IniciarClaseDto) {
    const materia = await this.prisma.materia.findUnique({ where: { id: dto.materiaId } });
    if (!materia || materia.docenteId !== docenteId) throw new ForbiddenException('No eres docente de esta materia');

    const activa = await this.prisma.claseSesion.findFirst({
      where: { docenteId, activa: true },
    });
    if (activa) throw new ConflictException('Ya tienes una clase activa');

    const sesion = await this.prisma.claseSesion.create({
      data: {
        materiaId: dto.materiaId,
        docenteId,
        horaInicio: new Date(),
        unidad: dto.unidad,
      },
    });

    // Notify enrolled students
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { materiaId: dto.materiaId, estado: 'ACEPTADA' },
      select: { alumnoId: true },
    });
    const alumnoIds = inscripciones.map((i) => i.alumnoId);
    if (alumnoIds.length) {
      await this.notificaciones.crearParaVarios(alumnoIds, {
        tipo: TipoNotificacion.CLASE_INICIADA,
        titulo: `Clase iniciada: ${materia.nombre}`,
        mensaje: `Se ha iniciado la clase de la unidad ${dto.unidad}`,
        referenciaId: sesion.id,
        referenciaTipo: 'ClaseSesion',
      });
    }

    return sesion;
  }

  async finalizar(sesionId: number, docenteId: number) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: sesionId },
      include: { materia: true },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    if (sesion.docenteId !== docenteId) throw new ForbiddenException();
    if (!sesion.activa) throw new ConflictException('La clase ya está finalizada');

    // Get enrolled students
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { materiaId: sesion.materiaId, estado: 'ACEPTADA' },
      select: { alumnoId: true },
    });
    const alumnoIds = inscripciones.map((i) => i.alumnoId);

    // Students who already have attendance
    const conAsistencia = await this.prisma.asistencia.findMany({
      where: { claseSesionId: sesionId },
      select: { alumnoId: true },
    });
    const idsConAsistencia = new Set(conAsistencia.map((a) => a.alumnoId));

    // Create FALTA for those without attendance
    const sinAsistencia = alumnoIds.filter((id) => !idsConAsistencia.has(id));
    if (sinAsistencia.length) {
      await this.prisma.asistencia.createMany({
        data: sinAsistencia.map((alumnoId) => ({
          claseSesionId: sesionId,
          alumnoId,
          estado: 'FALTA' as const,
        })),
        skipDuplicates: true,
      });
    }

    const updated = await this.prisma.claseSesion.update({
      where: { id: sesionId },
      data: { horaFin: new Date(), activa: false },
    });

    // Notify students
    if (alumnoIds.length) {
      await this.notificaciones.crearParaVarios(alumnoIds, {
        tipo: TipoNotificacion.CLASE_FINALIZADA,
        titulo: `Clase finalizada: ${sesion.materia.nombre}`,
        mensaje: `La clase de la unidad ${sesion.unidad} ha finalizado`,
        referenciaId: sesionId,
        referenciaTipo: 'ClaseSesion',
      });
    }

    return updated;
  }

  async obtenerActiva(materiaId: number, docenteId: number) {
    return this.prisma.claseSesion.findFirst({
      where: { materiaId, docenteId, activa: true },
    });
  }

  async obtenerHistorial(materiaId: number) {
    return this.prisma.claseSesion.findMany({
      where: { materiaId },
      orderBy: { fecha: 'desc' },
      include: { _count: { select: { asistencias: true } } },
    });
  }

  async obtenerClasesActivasAlumno(alumnoId: number) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { alumnoId, estado: 'ACEPTADA' },
      select: { materiaId: true },
    });
    const materiaIds = inscripciones.map((i) => i.materiaId);
    if (!materiaIds.length) return [];

    return this.prisma.claseSesion.findMany({
      where: { materiaId: { in: materiaIds }, activa: true },
      include: { materia: true, docente: { select: { id: true, nombre: true } } },
    });
  }
}
