import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CrearTareaDto } from './dto/crear-tarea.dto';
import { EntregarTareaDto } from './dto/entregar-tarea.dto';
import { RevisarEntregaDto } from './dto/revisar-entrega.dto';
import { CalificarEntregaDto } from './dto/calificar-entrega.dto';
import { TipoNotificacion } from '@prisma/client';

@Injectable()
export class TareasService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  async crear(docenteId: number, dto: CrearTareaDto, archivosUrls?: string) {
    const materia = await this.prisma.materia.findUnique({ where: { id: dto.materiaId } });
    if (!materia || materia.docenteId !== docenteId) throw new ForbiddenException('No eres docente de esta materia');

    const tarea = await this.prisma.tarea.create({
      data: {
        materiaId: dto.materiaId,
        docenteId,
        titulo: dto.titulo,
        instrucciones: dto.instrucciones,
        unidad: dto.unidad,
        tipoEntrega: dto.tipoEntrega,
        fechaLimite: new Date(dto.fechaLimite),
        archivosAdjuntos: archivosUrls,
      },
    });

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { materiaId: dto.materiaId, estado: 'ACEPTADA' },
      select: { alumnoId: true },
    });
    const alumnoIds = inscripciones.map((i) => i.alumnoId);
    if (alumnoIds.length) {
      await this.notificaciones.crearParaVarios(alumnoIds, {
        tipo: TipoNotificacion.TAREA_NUEVA,
        titulo: `Nueva tarea: ${dto.titulo}`,
        mensaje: `Se publicó una nueva tarea en ${materia.nombre}: ${dto.titulo}`,
        referenciaId: tarea.id,
        referenciaTipo: 'Tarea',
      });
    }

    return tarea;
  }

  async obtenerPorMateria(materiaId: number, docenteId: number) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia || materia.docenteId !== docenteId) throw new ForbiddenException();

    return this.prisma.tarea.findMany({
      where: { materiaId },
      orderBy: [{ unidad: 'asc' }, { fechaPublicacion: 'asc' }],
      include: { _count: { select: { entregas: true } } },
    });
  }

  async obtenerDetalle(tareaId: number) {
    return this.prisma.tarea.findUnique({
      where: { id: tareaId },
      include: {
        materia: true,
        docente: { select: { id: true, nombre: true } },
        _count: { select: { entregas: true } },
      },
    });
  }

  async editar(tareaId: number, docenteId: number, dto: Partial<CrearTareaDto>) {
    const tarea = await this.prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea || tarea.docenteId !== docenteId) throw new ForbiddenException();

    return this.prisma.tarea.update({
      where: { id: tareaId },
      data: {
        ...(dto.titulo && { titulo: dto.titulo }),
        ...(dto.instrucciones && { instrucciones: dto.instrucciones }),
        ...(dto.unidad && { unidad: dto.unidad }),
        ...(dto.tipoEntrega && { tipoEntrega: dto.tipoEntrega }),
        ...(dto.fechaLimite && { fechaLimite: new Date(dto.fechaLimite) }),
      },
    });
  }

  async desactivar(tareaId: number, docenteId: number) {
    const tarea = await this.prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea || tarea.docenteId !== docenteId) throw new ForbiddenException();
    return this.prisma.tarea.update({ where: { id: tareaId }, data: { activa: false } });
  }

  async entregar(tareaId: number, alumnoId: number, dto: EntregarTareaDto, archivoUrl?: string, firmaUrl?: string) {
    const tarea = await this.prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea || !tarea.activa) throw new NotFoundException('Tarea no encontrada o inactiva');

    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: { alumnoId, materiaId: tarea.materiaId, estado: 'ACEPTADA' },
    });
    if (!inscripcion) throw new ForbiddenException('No estás inscrito en esta materia');

    const entrega = await this.prisma.entregaTarea.upsert({
      where: { tareaId_alumnoId: { tareaId, alumnoId } },
      create: {
        tareaId,
        alumnoId,
        archivoUrl,
        firmaUrl,
        comentarioAlumno: dto.comentario,
      },
      update: {
        archivoUrl,
        firmaUrl,
        comentarioAlumno: dto.comentario,
        estadoRevision: 'PENDIENTE',
        fechaEntrega: new Date(),
      },
    });

    await this.notificaciones.crear({
      usuarioId: tarea.docenteId,
      tipo: TipoNotificacion.ENTREGA_RECIBIDA,
      titulo: `Nueva entrega: ${tarea.titulo}`,
      mensaje: `Un alumno entregó la tarea "${tarea.titulo}"`,
      referenciaId: entrega.id,
      referenciaTipo: 'EntregaTarea',
    });

    return entrega;
  }

  async marcarEntregaPresencial(tareaId: number, docenteId: number, alumnoId: number) {
    const tarea = await this.prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea || tarea.docenteId !== docenteId) throw new ForbiddenException();
    if (tarea.tipoEntrega !== 'PRESENCIAL') throw new ConflictException('La tarea no es de tipo presencial');

    return this.prisma.entregaTarea.upsert({
      where: { tareaId_alumnoId: { tareaId, alumnoId } },
      create: { tareaId, alumnoId },
      update: { fechaEntrega: new Date() },
    });
  }

  async obtenerEntregas(tareaId: number, docenteId: number) {
    const tarea = await this.prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea || tarea.docenteId !== docenteId) throw new ForbiddenException();

    const entregas = await this.prisma.entregaTarea.findMany({
      where: { tareaId },
      include: { alumno: { select: { id: true, nombre: true, numeroControl: true } } },
    });

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { materiaId: tarea.materiaId, estado: 'ACEPTADA' },
      include: { alumno: { select: { id: true, nombre: true, numeroControl: true } } },
    });

    const idsConEntrega = new Set(entregas.map((e) => e.alumnoId));
    const noEntregaron = inscripciones
      .map((i) => i.alumno)
      .filter((a) => !idsConEntrega.has(a.id));

    return { entregas, noEntregaron };
  }

  async revisar(entregaId: number, docenteId: number, dto: RevisarEntregaDto) {
    const entrega = await this.prisma.entregaTarea.findUnique({
      where: { id: entregaId },
      include: { tarea: true },
    });
    if (!entrega || entrega.tarea.docenteId !== docenteId) throw new ForbiddenException();

    const updated = await this.prisma.entregaTarea.update({
      where: { id: entregaId },
      data: { estadoRevision: 'REVISADA', observacion: dto.observacion, fechaRevision: new Date() },
    });

    await this.notificaciones.crear({
      usuarioId: entrega.alumnoId,
      tipo: TipoNotificacion.TAREA_REVISADA,
      titulo: `Tarea revisada: ${entrega.tarea.titulo}`,
      mensaje: dto.observacion ?? 'Tu entrega fue revisada',
      referenciaId: entregaId,
      referenciaTipo: 'EntregaTarea',
    });

    return updated;
  }

  async calificar(entregaId: number, docenteId: number, dto: CalificarEntregaDto) {
    const entrega = await this.prisma.entregaTarea.findUnique({
      where: { id: entregaId },
      include: { tarea: true },
    });
    if (!entrega || entrega.tarea.docenteId !== docenteId) throw new ForbiddenException();

    const updated = await this.prisma.entregaTarea.update({
      where: { id: entregaId },
      data: {
        estadoRevision: 'CALIFICADA',
        calificacion: dto.calificacion,
        observacion: dto.observacion,
        fechaRevision: new Date(),
      },
    });

    await this.notificaciones.crear({
      usuarioId: entrega.alumnoId,
      tipo: TipoNotificacion.TAREA_CALIFICADA,
      titulo: `Tarea calificada: ${entrega.tarea.titulo}`,
      mensaje: `Obtuviste ${dto.calificacion}/100 en "${entrega.tarea.titulo}"`,
      referenciaId: entregaId,
      referenciaTipo: 'EntregaTarea',
    });

    return updated;
  }

  async marcarIncorrecta(entregaId: number, docenteId: number, observacion: string) {
    const entrega = await this.prisma.entregaTarea.findUnique({
      where: { id: entregaId },
      include: { tarea: true },
    });
    if (!entrega || entrega.tarea.docenteId !== docenteId) throw new ForbiddenException();

    const updated = await this.prisma.entregaTarea.update({
      where: { id: entregaId },
      data: { estadoRevision: 'INCORRECTA', observacion },
    });

    await this.notificaciones.crear({
      usuarioId: entrega.alumnoId,
      tipo: TipoNotificacion.TAREA_REVISADA,
      titulo: `Entrega incorrecta: ${entrega.tarea.titulo}`,
      mensaje: observacion ?? 'Tu entrega fue marcada como incorrecta',
      referenciaId: entregaId,
      referenciaTipo: 'EntregaTarea',
    });

    return updated;
  }

  async obtenerMisTareas(alumnoId: number, materiaId: number) {
    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: { alumnoId, materiaId, estado: 'ACEPTADA' },
    });
    if (!inscripcion) throw new ForbiddenException('No estás inscrito en esta materia');

    const tareas = await this.prisma.tarea.findMany({
      where: { materiaId, activa: true },
      orderBy: [{ unidad: 'asc' }, { fechaPublicacion: 'asc' }],
    });

    const entregas = await this.prisma.entregaTarea.findMany({
      where: { alumnoId, tareaId: { in: tareas.map((t) => t.id) } },
    });
    const mapaEntregas = new Map(entregas.map((e) => [e.tareaId, e]));

    return tareas.map((tarea) => ({ tarea, miEntrega: mapaEntregas.get(tarea.id) ?? null }));
  }

  async obtenerResumenMateria(materiaId: number, unidad?: number) {
    const tareas = await this.prisma.tarea.findMany({
      where: { materiaId, ...(unidad && { unidad }) },
      include: { _count: { select: { entregas: true } } },
    });

    const resultado: any[] = [];
    for (const tarea of tareas) {
      const entregadas = await this.prisma.entregaTarea.count({ where: { tareaId: tarea.id } });
      const calificadas = await this.prisma.entregaTarea.count({
        where: { tareaId: tarea.id, estadoRevision: 'CALIFICADA' },
      });
      const promedioResult = await this.prisma.entregaTarea.aggregate({
        where: { tareaId: tarea.id, calificacion: { not: null } },
        _avg: { calificacion: true },
      });
      resultado.push({
        tarea,
        entregadas,
        calificadas,
        promedio: promedioResult._avg.calificacion,
      });
    }
    return resultado;
  }
}
