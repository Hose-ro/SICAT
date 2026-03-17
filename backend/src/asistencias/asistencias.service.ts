import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PasarListaDto } from './dto/pasar-lista.dto';

@Injectable()
export class AsistenciasService {
  constructor(private prisma: PrismaService) {}

  async pasarLista(docenteId: number, dto: PasarListaDto) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: dto.claseSesionId },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    if (sesion.docenteId !== docenteId) throw new ForbiddenException();
    if (!sesion.activa) throw new ForbiddenException('La clase ya está finalizada');

    let asistencias = 0, faltas = 0, retardos = 0;

    for (const r of dto.registros) {
      await this.prisma.asistencia.upsert({
        where: { claseSesionId_alumnoId: { claseSesionId: dto.claseSesionId, alumnoId: r.alumnoId } },
        create: { claseSesionId: dto.claseSesionId, alumnoId: r.alumnoId, estado: r.estado },
        update: { estado: r.estado },
      });
      if (r.estado === 'ASISTENCIA') asistencias++;
      else if (r.estado === 'FALTA') faltas++;
      else if (r.estado === 'RETARDO') retardos++;
    }

    return { asistencias, faltas, retardos };
  }

  async obtenerListaSesion(claseSesionId: number) {
    return this.prisma.asistencia.findMany({
      where: { claseSesionId },
      include: { alumno: { select: { id: true, nombre: true, numeroControl: true } } },
      orderBy: { alumno: { nombre: 'asc' } },
    });
  }

  async obtenerResumenMateria(materiaId: number, unidad?: number) {
    const sesiones = await this.prisma.claseSesion.findMany({
      where: { materiaId, ...(unidad && { unidad }), activa: false },
      select: { id: true },
    });
    const sesionIds = sesiones.map((s) => s.id);
    if (!sesionIds.length) return [];

    const asistencias = await this.prisma.asistencia.findMany({
      where: { claseSesionId: { in: sesionIds } },
      include: { alumno: { select: { id: true, nombre: true, numeroControl: true } } },
    });

    const mapaAlumnos = new Map<number, any>();
    for (const a of asistencias) {
      if (!mapaAlumnos.has(a.alumnoId)) {
        mapaAlumnos.set(a.alumnoId, {
          alumnoId: a.alumnoId,
          nombre: a.alumno.nombre,
          numControl: a.alumno.numeroControl,
          asistencias: 0, faltas: 0, retardos: 0, justificadas: 0,
        });
      }
      const entry = mapaAlumnos.get(a.alumnoId);
      if (a.estado === 'ASISTENCIA') entry.asistencias++;
      else if (a.estado === 'FALTA') entry.faltas++;
      else if (a.estado === 'RETARDO') entry.retardos++;
      else if (a.estado === 'JUSTIFICADA') entry.justificadas++;
    }

    return Array.from(mapaAlumnos.values()).map((e) => {
      const total = e.asistencias + e.faltas + e.retardos + e.justificadas;
      return { ...e, porcentaje: total > 0 ? Math.round((e.asistencias / total) * 100) : 0 };
    });
  }

  async obtenerAsistenciasAlumno(alumnoId: number, materiaId: number) {
    const sesiones = await this.prisma.claseSesion.findMany({
      where: { materiaId },
      select: { id: true, fecha: true, unidad: true },
    });
    const sesionIds = sesiones.map((s) => s.id);

    const asistencias = await this.prisma.asistencia.findMany({
      where: { alumnoId, claseSesionId: { in: sesionIds } },
    });

    const mapaAsistencias = new Map(asistencias.map((a) => [a.claseSesionId, a.estado]));

    return sesiones.map((s) => ({
      fecha: s.fecha,
      unidad: s.unidad,
      estado: mapaAsistencias.get(s.id) ?? null,
    }));
  }

  async justificarFalta(asistenciaId: number, alumnoId: number, justificacion: string, archivoUrl?: string) {
    const asistencia = await this.prisma.asistencia.findUnique({ where: { id: asistenciaId } });
    if (!asistencia) throw new NotFoundException('Asistencia no encontrada');
    if (asistencia.alumnoId !== alumnoId) throw new ForbiddenException();
    if (asistencia.estado !== 'FALTA') throw new ForbiddenException('Solo se pueden justificar faltas');

    return this.prisma.asistencia.update({
      where: { id: asistenciaId },
      data: { justificacion, archivoJustificacion: archivoUrl, estado: 'JUSTIFICADA' },
    });
  }

  async obtenerDatosReporte(materiaId: number, unidad?: number) {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      include: { docente: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const sesiones = await this.prisma.claseSesion.findMany({
      where: { materiaId, ...(unidad && { unidad }) },
      orderBy: { fecha: 'asc' },
    });

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { materiaId, estado: 'ACEPTADA' },
      include: { alumno: { select: { id: true, nombre: true, numeroControl: true } } },
    });

    const sesionIds = sesiones.map((s) => s.id);
    const asistencias = sesionIds.length
      ? await this.prisma.asistencia.findMany({ where: { claseSesionId: { in: sesionIds } } })
      : [];

    return { materia, sesiones, alumnos: inscripciones.map((i) => i.alumno), asistencias };
  }
}
