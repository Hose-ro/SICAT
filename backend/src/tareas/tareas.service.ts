import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoRevision,
  EstadoTarea,
  TipoCalificacion,
  TipoEntrega,
  TipoEvaluacion,
  TipoNotificacion,
} from '@prisma/client';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CrearTareaDto } from './dto/crear-tarea.dto';
import { EntregarTareaDto } from './dto/entregar-tarea.dto';
import { RevisarEntregaDto } from './dto/revisar-entrega.dto';
import { CalificarEntregaDto } from './dto/calificar-entrega.dto';
import { DevolverEntregaDto } from './dto/devolver-entrega.dto';
import { BulkRevisarEntregasDto } from './dto/bulk-revisar-entregas.dto';
import {
  buildPublicUploadUrl,
  fileTypeFromName,
  getUploadAbsolutePath,
  isImageFile,
} from './tareas.storage';

type Actor = {
  id: number;
  rol: string;
};

type TareaFiltros = {
  materiaId?: number;
  grupoId?: number;
  unidadId?: number;
  estado?: EstadoTarea;
  fecha?: string;
  alumnoId?: number;
  docenteId?: number;
};

const ESTADOS_CON_ENTREGA = new Set<EstadoRevision>([
  EstadoRevision.PENDIENTE,
  EstadoRevision.ENTREGADA,
  EstadoRevision.REVISADA,
  EstadoRevision.CALIFICADA,
  EstadoRevision.INCORRECTA,
]);

const ESTADOS_PENDIENTES_REVISION = new Set<EstadoRevision>([
  EstadoRevision.PENDIENTE,
  EstadoRevision.ENTREGADA,
]);

@Injectable()
export class TareasService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  async crear(
    docenteId: number,
    dto: CrearTareaDto,
    archivos: Express.Multer.File[] = [],
    rol = 'DOCENTE',
  ) {
    const actor: Actor = { id: docenteId, rol };
    const contexto = await this.validarContextoTarea(actor, dto);
    const archivosAdjuntos = this.mapUploadedFiles(archivos);
    this.validarArchivosEntrega(dto.tipoEntrega, archivosAdjuntos, true);

    const data: any = this.buildTareaData(dto, contexto);
    const tarea = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tarea.create({
        data: {
          ...data,
          docenteId:
            actor.rol === 'ADMIN'
              ? (contexto.materia.docenteId ?? actor.id)
              : actor.id,
          archivosAdjuntos: archivosAdjuntos.length
            ? JSON.stringify(archivosAdjuntos.map((item) => item.url))
            : null,
          archivos: {
            create: archivosAdjuntos,
          },
        },
        include: this.taskInclude(),
      });
      return created;
    });

    if (this.esEstadoPublicada(tarea.estado)) {
      await this.notificarNuevaTarea(tarea);
    }

    return this.enrichTask(tarea);
  }

  async editar(
    tareaId: number,
    docenteId: number,
    dto: Partial<CrearTareaDto>,
    archivos: Express.Multer.File[] = [],
    rol = 'DOCENTE',
  ) {
    const actor: Actor = { id: docenteId, rol };
    const tarea = await this.obtenerTareaDocente(tareaId, actor);
    const mergedInput = {
      materiaId: dto.materiaId ?? tarea.materiaId,
      grupoId: dto.grupoId ?? tarea.grupoId ?? undefined,
      unidadId: dto.unidadId ?? tarea.unidadId ?? undefined,
      titulo: dto.titulo ?? tarea.titulo,
      instrucciones: dto.instrucciones ?? tarea.instrucciones,
      tipoEntrega: dto.tipoEntrega ?? tarea.tipoEntrega,
      tipoEvaluacion: dto.tipoEvaluacion ?? tarea.tipoEvaluacion,
      permiteReenvio: dto.permiteReenvio ?? tarea.permiteReenvio,
      tieneFechaLimite: dto.tieneFechaLimite ?? tarea.tieneFechaLimite,
      fechaLimite: dto.fechaLimite ?? tarea.fechaLimite?.toISOString(),
      horaLimite: dto.horaLimite ?? tarea.horaLimite ?? undefined,
      estado: dto.estado ?? tarea.estado,
      rubricJson: dto.rubricJson ?? tarea.rubricJson ?? undefined,
      removerArchivoIds: dto.removerArchivoIds,
    } satisfies Partial<CrearTareaDto>;

    const contexto = await this.validarContextoTarea(
      actor,
      mergedInput as CrearTareaDto,
    );
    const archivosAdjuntos = this.mapUploadedFiles(archivos);
    this.validarArchivosEntrega(
      mergedInput.tipoEntrega,
      archivosAdjuntos,
      true,
    );
    const removeIds = this.parseIdList(dto.removerArchivoIds);
    const shouldNotify =
      !this.esEstadoPublicada(tarea.estado) &&
      this.esEstadoPublicada(mergedInput.estado ?? tarea.estado);

    const updated = await this.prisma.$transaction(async (tx) => {
      const actuales = await tx.tareaArchivo.findMany({
        where: { tareaId },
      });
      const actualesPorId = new Map(actuales.map((item) => [item.id, item]));

      await this.eliminarArchivosPorIds(
        tx.tareaArchivo,
        removeIds,
        actualesPorId,
      );

      const baseData: any = this.buildTareaData(
        mergedInput as CrearTareaDto,
        contexto,
      );
      const tareaActualizada = await tx.tarea.update({
        where: { id: tareaId },
        data: {
          ...baseData,
          archivosAdjuntos: JSON.stringify([
            ...actuales
              .filter((item) => !removeIds.includes(item.id))
              .map((item) => item.url),
            ...archivosAdjuntos.map((item) => item.url),
          ]),
          archivos: archivosAdjuntos.length
            ? {
                create: archivosAdjuntos,
              }
            : undefined,
        },
        include: this.taskInclude(),
      });
      return tareaActualizada;
    });

    if (shouldNotify) {
      await this.notificarNuevaTarea(updated);
    }

    return this.enrichTask(updated);
  }

  async publicar(tareaId: number, actor: Actor) {
    const tarea = await this.obtenerTareaDocente(tareaId, actor);
    const estado = this.resolverEstadoPublico(
      tarea.fechaLimite,
      tarea.tieneFechaLimite,
    );
    const updated = await this.prisma.tarea.update({
      where: { id: tareaId },
      data: {
        estado,
        activa: true,
        fechaPublicacion: tarea.fechaPublicacion ?? new Date(),
      },
      include: this.taskInclude(),
    });
    await this.notificarNuevaTarea(updated);
    return this.enrichTask(updated);
  }

  async cerrar(tareaId: number, actor: Actor) {
    const tarea = await this.obtenerTareaDocente(tareaId, actor);
    const updated = await this.prisma.tarea.update({
      where: { id: tareaId },
      data: {
        estado: EstadoTarea.CERRADA,
        activa: false,
      },
      include: this.taskInclude(),
    });
    return this.enrichTask(updated);
  }

  async reabrir(tareaId: number, actor: Actor) {
    const tarea = await this.obtenerTareaDocente(tareaId, actor);
    const updated = await this.prisma.tarea.update({
      where: { id: tareaId },
      data: {
        estado: this.resolverEstadoPublico(
          tarea.fechaLimite,
          tarea.tieneFechaLimite,
        ),
        activa: true,
        fechaPublicacion: tarea.fechaPublicacion ?? new Date(),
      },
      include: this.taskInclude(),
    });
    return this.enrichTask(updated);
  }

  async obtenerPorMateria(
    materiaId: number,
    docenteId: number,
    rol = 'DOCENTE',
  ) {
    const resultado = await this.listarDocente(
      { id: docenteId, rol },
      { materiaId },
    );
    return resultado.items;
  }

  async listarDocente(actor: Actor, filtros: TareaFiltros = {}) {
    await this.sincronizarTareasVencidas();

    const where: Record<string, unknown> = {};
    if (actor.rol !== 'ADMIN') {
      where.docenteId = actor.id;
    } else if (filtros.docenteId) {
      where.docenteId = filtros.docenteId;
    }
    if (filtros.materiaId) where.materiaId = filtros.materiaId;
    if (filtros.grupoId) where.grupoId = filtros.grupoId;
    if (filtros.unidadId) where.unidadId = filtros.unidadId;
    if (filtros.estado) where.estado = filtros.estado;
    const dateWhere = this.buildDateWhere(filtros.fecha);
    if (dateWhere) Object.assign(where, dateWhere);

    const tareas = await this.prisma.tarea.findMany({
      where,
      include: this.taskInclude(),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    const items = await this.enrichTasks(tareas);
    return {
      items,
      stats: this.buildDashboardStats(items),
    };
  }

  async obtenerDetalle(tareaId: number, actor: Actor) {
    await this.sincronizarTareaVencida(tareaId);
    const tarea = await this.prisma.tarea.findUnique({
      where: { id: tareaId },
      include: this.taskInclude(),
    });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');

    if (actor.rol === 'ALUMNO') {
      await this.validarAccesoAlumno(actor.id, tarea);
    } else {
      this.validarAccesoDocente(actor, tarea.docenteId);
    }

    const enriched = await this.enrichTask(tarea);
    if (actor.rol !== 'ALUMNO') return enriched;

    const miEntrega = await this.prisma.entregaTarea.findUnique({
      where: {
        tareaId_alumnoId: {
          tareaId,
          alumnoId: actor.id,
        },
      },
      include: {
        archivos: true,
      },
    });

    return {
      ...enriched,
      miEntrega,
      estadoAlumno:
        miEntrega?.estadoRevision ?? this.obtenerEstadoSinEntrega(tarea),
      puedeEditarEntrega: this.puedeEditarEntrega(tarea, miEntrega),
    };
  }

  async desactivar(tareaId: number, docenteId: number, rol = 'DOCENTE') {
    return this.cerrar(tareaId, { id: docenteId, rol });
  }

  async entregar(
    tareaId: number,
    alumnoId: number,
    dto: EntregarTareaDto,
    archivos: Express.Multer.File[] = [],
  ) {
    return this.guardarEntrega(tareaId, alumnoId, dto, archivos);
  }

  async editarEntrega(
    tareaId: number,
    alumnoId: number,
    dto: EntregarTareaDto,
    archivos: Express.Multer.File[] = [],
  ) {
    return this.guardarEntrega(tareaId, alumnoId, dto, archivos);
  }

  async marcarEntregaPresencial(
    tareaId: number,
    docenteId: number,
    alumnoId: number,
    rol = 'DOCENTE',
  ) {
    const actor: Actor = { id: docenteId, rol };
    const tarea = await this.obtenerTareaDocente(tareaId, actor);
    if (tarea.tipoEntrega !== TipoEntrega.PRESENCIAL) {
      throw new ConflictException('La tarea no es de tipo presencial');
    }
    await this.validarAlumnoEnTarea(alumnoId, tarea);

    const entrega = await this.prisma.entregaTarea.upsert({
      where: {
        tareaId_alumnoId: { tareaId, alumnoId },
      },
      create: {
        tareaId,
        alumnoId,
        estadoRevision: EstadoRevision.ENTREGADA,
        fechaEntrega: new Date(),
        versionEntrega: 1,
      },
      update: {
        estadoRevision: EstadoRevision.ENTREGADA,
        fechaEntrega: new Date(),
        versionEntrega: { increment: 1 },
        permiteCorreccion: false,
      },
      include: {
        alumno: { select: { id: true, nombre: true, numeroControl: true } },
        archivos: true,
      },
    });

    return entrega;
  }

  async obtenerEntregas(
    tareaId: number,
    actor: Actor,
    filtros: {
      estado?: string;
      tardia?: boolean;
      q?: string;
    } = {},
  ) {
    await this.sincronizarTareaVencida(tareaId);
    const tarea = await this.obtenerTareaDocente(tareaId, actor);
    const alumnos = await this.obtenerAlumnosDeTarea(tarea);
    const entregas = await this.prisma.entregaTarea.findMany({
      where: {
        tareaId,
        alumnoId: { in: alumnos.map((item) => item.id) },
      },
      include: {
        alumno: { select: { id: true, nombre: true, numeroControl: true } },
        archivos: true,
      },
      orderBy: [{ fechaEntrega: 'desc' }, { id: 'desc' }],
    });

    const entregaMap = new Map(entregas.map((item) => [item.alumnoId, item]));
    const cards = alumnos.map((alumno) => {
      const entrega = entregaMap.get(alumno.id);
      if (!entrega) {
        return {
          id: `sin-entrega-${alumno.id}`,
          alumno,
          estadoRevision: this.obtenerEstadoSinEntrega(tarea),
          fechaEntrega: null,
          fueTardia: false,
          comentarioAlumno: null,
          observacion: null,
          calificacion: null,
          calificacionTipo: null,
          archivos: [],
          permiteCorreccion: false,
          versionEntrega: 0,
          esSintetica: true,
        };
      }
      return {
        ...entrega,
        esSintetica: false,
      };
    });

    const filtered = cards.filter((item) =>
      this.matchesEntregaFilter(item, filtros),
    );
    return {
      tarea: await this.enrichTask(tarea),
      entregas: filtered,
      stats: this.buildEntregaStats(cards),
      noEntregaron: cards
        .filter((item) => item.esSintetica)
        .map((item) => item.alumno),
    };
  }

  async revisar(
    entregaId: number,
    docenteId: number,
    dto: RevisarEntregaDto,
    rol = 'DOCENTE',
  ) {
    const entrega = await this.obtenerEntregaDocente(entregaId, {
      id: docenteId,
      rol,
    });
    const updated = await this.prisma.entregaTarea.update({
      where: { id: entregaId },
      data: {
        estadoRevision: EstadoRevision.REVISADA,
        observacion: dto.observacion ?? entrega.observacion,
        fechaRevision: new Date(),
        permiteCorreccion: false,
      },
      include: {
        tarea: true,
        alumno: { select: { id: true, nombre: true } },
        archivos: true,
      },
    });

    await this.notificaciones.crear({
      usuarioId: entrega.alumnoId,
      tipo: TipoNotificacion.TAREA_REVISADA,
      titulo: `Entrega revisada: ${entrega.tarea.titulo}`,
      mensaje: dto.observacion ?? 'Tu entrega fue revisada',
      referenciaId: entregaId,
      referenciaTipo: 'EntregaTarea',
    });

    return updated;
  }

  async calificar(
    entregaId: number,
    docenteId: number,
    dto: CalificarEntregaDto,
    rol = 'DOCENTE',
  ) {
    const entrega = await this.obtenerEntregaDocente(entregaId, {
      id: docenteId,
      rol,
    });
    if (
      dto.calificacionTipo === TipoCalificacion.NUMERICA &&
      dto.calificacion == null
    ) {
      throw new BadRequestException(
        'La calificación numérica es obligatoria para este tipo',
      );
    }

    const updated = await this.prisma.entregaTarea.update({
      where: { id: entregaId },
      data: {
        estadoRevision: EstadoRevision.CALIFICADA,
        calificacion: dto.calificacion ?? null,
        calificacionTipo: dto.calificacionTipo,
        observacion: dto.observacion ?? entrega.observacion,
        fechaRevision: new Date(),
        permiteCorreccion: false,
      },
      include: {
        tarea: true,
        alumno: { select: { id: true, nombre: true } },
        archivos: true,
      },
    });

    await this.notificaciones.crear({
      usuarioId: entrega.alumnoId,
      tipo: TipoNotificacion.TAREA_CALIFICADA,
      titulo: `Tarea calificada: ${entrega.tarea.titulo}`,
      mensaje:
        dto.calificacionTipo === TipoCalificacion.NUMERICA
          ? `Obtuviste ${dto.calificacion}/100 en "${entrega.tarea.titulo}"`
          : (dto.observacion ?? 'Tu tarea fue evaluada'),
      referenciaId: entregaId,
      referenciaTipo: 'EntregaTarea',
    });

    return updated;
  }

  async marcarIncorrecta(
    entregaId: number,
    docenteId: number,
    observacion: string,
    rol = 'DOCENTE',
  ) {
    const entrega = await this.obtenerEntregaDocente(entregaId, {
      id: docenteId,
      rol,
    });
    const updated = await this.prisma.entregaTarea.update({
      where: { id: entregaId },
      data: {
        estadoRevision: EstadoRevision.INCORRECTA,
        observacion,
        permiteCorreccion: false,
        fechaRevision: new Date(),
      },
      include: {
        tarea: true,
        archivos: true,
      },
    });

    await this.notificaciones.crear({
      usuarioId: entrega.alumnoId,
      tipo: TipoNotificacion.TAREA_REVISADA,
      titulo: `Entrega incorrecta: ${entrega.tarea.titulo}`,
      mensaje: observacion || 'Tu entrega fue marcada como incorrecta',
      referenciaId: entregaId,
      referenciaTipo: 'EntregaTarea',
    });

    return updated;
  }

  async devolverParaCorreccion(
    entregaId: number,
    docenteId: number,
    dto: DevolverEntregaDto,
    rol = 'DOCENTE',
  ) {
    const entrega = await this.obtenerEntregaDocente(entregaId, {
      id: docenteId,
      rol,
    });
    const updated = await this.prisma.entregaTarea.update({
      where: { id: entregaId },
      data: {
        estadoRevision: EstadoRevision.INCORRECTA,
        observacion: dto.observacion ?? entrega.observacion,
        permiteCorreccion: dto.permiteCorreccion,
        fechaRevision: new Date(),
      },
      include: {
        tarea: true,
        alumno: { select: { id: true, nombre: true } },
        archivos: true,
      },
    });

    await this.notificaciones.crear({
      usuarioId: entrega.alumnoId,
      tipo: TipoNotificacion.TAREA_REVISADA,
      titulo: `Corrección solicitada: ${entrega.tarea.titulo}`,
      mensaje: dto.observacion ?? 'Tu entrega fue devuelta para corrección',
      referenciaId: entregaId,
      referenciaTipo: 'EntregaTarea',
    });

    return updated;
  }

  async revisarMasivo(
    tareaId: number,
    docenteId: number,
    dto: BulkRevisarEntregasDto,
    rol = 'DOCENTE',
  ) {
    await this.obtenerTareaDocente(tareaId, { id: docenteId, rol });
    const entregas = await this.prisma.entregaTarea.findMany({
      where: {
        tareaId,
        id: { in: dto.entregaIds },
      },
      include: {
        tarea: { select: { id: true, titulo: true } },
      },
    });
    if (entregas.length !== dto.entregaIds.length) {
      throw new NotFoundException(
        'Una o más entregas no pertenecen a la tarea indicada',
      );
    }

    await this.prisma.entregaTarea.updateMany({
      where: { id: { in: dto.entregaIds } },
      data: {
        estadoRevision: EstadoRevision.REVISADA,
        observacion: dto.observacion ?? undefined,
        fechaRevision: new Date(),
        permiteCorreccion: false,
      },
    });

    await this.notificaciones.crearParaVarios(
      entregas.map((item) => item.alumnoId),
      {
        tipo: TipoNotificacion.TAREA_REVISADA,
        titulo: `Entregas revisadas: ${entregas[0]?.tarea.titulo ?? 'Tarea'}`,
        mensaje: dto.observacion ?? 'Tu entrega fue revisada',
        referenciaTipo: 'EntregaTarea',
      },
    );

    return { revisadas: entregas.length };
  }

  async obtenerMisTareas(alumnoId: number, materiaId?: number) {
    await this.sincronizarTareasVencidas();
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { grupoId: true },
    });
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        alumnoId,
        estado: 'ACEPTADA',
        ...(materiaId ? { materiaId } : {}),
      },
      select: { materiaId: true },
    });
    if (!inscripciones.length) return [];

    const materiaIds = inscripciones.map((item) => item.materiaId);
    const tareas = (
      await this.prisma.tarea.findMany({
        where: {
          materiaId: { in: materiaIds },
          estado: {
            in: [
              EstadoTarea.PUBLICADA,
              EstadoTarea.VENCIDA,
              EstadoTarea.CERRADA,
            ],
          },
        },
        include: this.taskInclude(),
        orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'desc' }],
      })
    ).filter((item) => !item.grupoId || item.grupoId === alumno?.grupoId);

    const entregas = await this.prisma.entregaTarea.findMany({
      where: {
        alumnoId,
        tareaId: { in: tareas.map((item) => item.id) },
      },
      include: { archivos: true },
    });
    const entregaMap = new Map(entregas.map((item) => [item.tareaId, item]));
    const enriched = await this.enrichTasks(tareas);
    const enrichedMap = new Map(enriched.map((item) => [item.id, item]));

    return tareas.map((tarea) => {
      const miEntrega = entregaMap.get(tarea.id) ?? null;
      return {
        tarea: enrichedMap.get(tarea.id) ?? tarea,
        miEntrega,
        estadoAlumno:
          miEntrega?.estadoRevision ?? this.obtenerEstadoSinEntrega(tarea),
        puedeEditarEntrega: this.puedeEditarEntrega(tarea, miEntrega),
      };
    });
  }

  async obtenerResumenMateria(
    materiaId: number,
    actor: Actor,
    unidadId?: number,
  ) {
    const reporte = await this.obtenerDatosReporteDocente(actor, {
      materiaId,
      unidadId,
    });
    return reporte.tasks.map((item) => ({
      tarea: item.raw,
      entregadas: item.entregadas,
      calificadas: item.calificadas,
      promedio: item.promedio,
    }));
  }

  async obtenerDatosReporteDocente(actor: Actor, filtros: TareaFiltros = {}) {
    const { items } = await this.listarDocente(actor, filtros);
    const taskIds = items.map((item) => item.id);
    if (!taskIds.length) {
      return {
        generatedAt: new Date().toISOString(),
        filters: filtros,
        metrics: {
          porcentajeEntrega: 0,
          tareasVencidas: 0,
          entregasTardias: 0,
          pendientesRevision: 0,
        },
        tasks: [],
        students: [],
        alumnosConMasPendientes: [],
      };
    }

    const entregas = await this.prisma.entregaTarea.findMany({
      where: {
        tareaId: { in: taskIds },
        ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
      },
      include: {
        alumno: { select: { id: true, nombre: true, numeroControl: true } },
      },
    });

    const taskMap = new Map(items.map((item) => [item.id, item]));
    const expectedEntries: Array<{
      tareaId: number;
      alumno: any;
      entrega: any | null;
    }> = [];
    for (const task of items) {
      const alumnos = await this.obtenerAlumnosDeTarea(task);
      for (const alumno of alumnos) {
        if (filtros.alumnoId && alumno.id !== filtros.alumnoId) continue;
        const entrega =
          entregas.find(
            (item) => item.tareaId === task.id && item.alumnoId === alumno.id,
          ) ?? null;
        expectedEntries.push({ tareaId: task.id, alumno, entrega });
      }
    }

    const studentsMap = new Map<number, any>();
    for (const entry of expectedEntries) {
      const task = taskMap.get(entry.tareaId);
      if (!task) continue;
      const current = studentsMap.get(entry.alumno.id) ?? {
        id: entry.alumno.id,
        nombre: entry.alumno.nombre,
        numeroControl: entry.alumno.numeroControl,
        pendientes: 0,
        entregadas: 0,
        tardias: 0,
        promedio: null,
        tasks: [],
      };

      const estado =
        entry.entrega?.estadoRevision ?? this.obtenerEstadoSinEntrega(task);
      if (
        entry.entrega &&
        ESTADOS_CON_ENTREGA.has(entry.entrega.estadoRevision)
      )
        current.entregadas += 1;
      if (!entry.entrega || estado === EstadoRevision.NO_ENTREGADA)
        current.pendientes += 1;
      if (entry.entrega?.fueTardia) current.tardias += 1;

      current.tasks.push({
        tareaId: task.id,
        titulo: task.titulo,
        materia: task.materia,
        grupo: task.grupo,
        unidad: task.unidadRef,
        estado,
        fueTardia: entry.entrega?.fueTardia ?? false,
        calificacion: entry.entrega?.calificacion ?? null,
      });
      studentsMap.set(entry.alumno.id, current);
    }

    for (const student of studentsMap.values()) {
      const calificaciones = student.tasks
        .map((task) => task.calificacion)
        .filter((value) => typeof value === 'number');
      student.promedio = calificaciones.length
        ? Number(
            (
              calificaciones.reduce((sum, value) => sum + value, 0) /
              calificaciones.length
            ).toFixed(2),
          )
        : null;
    }

    const students = Array.from(studentsMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
    const expectedTotal = expectedEntries.length;
    const entregadas = expectedEntries.filter(
      (entry) =>
        entry.entrega && ESTADOS_CON_ENTREGA.has(entry.entrega.estadoRevision),
    ).length;
    const entregasTardias = expectedEntries.filter(
      (entry) => entry.entrega?.fueTardia,
    ).length;
    const pendientesRevision = expectedEntries.filter(
      (entry) =>
        entry.entrega &&
        ESTADOS_PENDIENTES_REVISION.has(entry.entrega.estadoRevision),
    ).length;
    const tareasVencidas = items.filter(
      (item) => item.estado === EstadoTarea.VENCIDA,
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      filters: filtros,
      metrics: {
        porcentajeEntrega: expectedTotal
          ? Number(((entregadas / expectedTotal) * 100).toFixed(2))
          : 0,
        tareasVencidas,
        entregasTardias,
        pendientesRevision,
      },
      tasks: items.map((item) => ({
        ...item,
        raw: item,
      })),
      students,
      alumnosConMasPendientes: [...students]
        .sort(
          (a, b) =>
            b.pendientes - a.pendientes ||
            a.nombre.localeCompare(b.nombre, 'es'),
        )
        .slice(0, 5),
    };
  }

  async obtenerDatosReporteTarea(actor: Actor, tareaId: number) {
    const tarea = await this.obtenerDetalle(tareaId, actor);
    const entregas = await this.obtenerEntregas(tareaId, actor);
    const students = entregas.entregas.map((item) => ({
      id: item.alumno.id,
      nombre: item.alumno.nombre,
      numeroControl: item.alumno.numeroControl,
      pendientes: item.esSintetica ? 1 : 0,
      entregadas: item.esSintetica ? 0 : 1,
      tardias: item.fueTardia ? 1 : 0,
      promedio: item.calificacion ?? null,
      tasks: [
        {
          tareaId,
          titulo: tarea.titulo,
          materia: tarea.materia,
          grupo: tarea.grupo,
          unidad: tarea.unidadRef,
          estado: item.estadoRevision,
          fueTardia: item.fueTardia,
          calificacion: item.calificacion,
        },
      ],
    }));

    return {
      generatedAt: new Date().toISOString(),
      filters: { tareaId },
      metrics: {
        porcentajeEntrega: tarea.porcentajeEntrega,
        tareasVencidas: tarea.estado === EstadoTarea.VENCIDA ? 1 : 0,
        entregasTardias: tarea.entregasTardias,
        pendientesRevision: tarea.pendientesRevision,
      },
      tasks: [{ ...tarea, raw: tarea }],
      students,
      alumnosConMasPendientes: [...students]
        .sort(
          (a, b) =>
            b.pendientes - a.pendientes ||
            a.nombre.localeCompare(b.nombre, 'es'),
        )
        .slice(0, 5),
    };
  }

  async obtenerDatosCierreUnidad(actor: Actor, unidadId: number) {
    const unidad = await this.prisma.unidad.findUnique({
      where: { id: unidadId },
      include: {
        materia: {
          select: { id: true, nombre: true, clave: true, docenteId: true },
        },
      },
    });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    if (actor.rol !== 'ADMIN' && unidad.materia.docenteId !== actor.id) {
      throw new ForbiddenException('No tienes permisos para esta unidad');
    }

    const reporte = await this.obtenerDatosReporteDocente(actor, { unidadId });
    const evidencias = await this.prisma.entregaArchivo.findMany({
      where: {
        entrega: {
          tarea: { unidadId },
        },
      },
      include: {
        entrega: {
          include: {
            alumno: { select: { id: true, nombre: true, numeroControl: true } },
            tarea: { select: { id: true, titulo: true } },
          },
        },
      },
    });

    return {
      unidad,
      reporte,
      evidencias,
    };
  }

  private async guardarEntrega(
    tareaId: number,
    alumnoId: number,
    dto: EntregarTareaDto,
    archivos: Express.Multer.File[],
  ) {
    await this.sincronizarTareaVencida(tareaId);
    const tarea = await this.prisma.tarea.findUnique({
      where: { id: tareaId },
      include: this.taskInclude(),
    });
    if (!tarea || !tarea.activa)
      throw new NotFoundException('Tarea no encontrada');
    await this.validarAccesoAlumno(alumnoId, tarea);

    if (tarea.tipoEntrega === TipoEntrega.PRESENCIAL) {
      throw new ConflictException(
        'Esta tarea se registra como presencial por el docente',
      );
    }
    if (tarea.estado === EstadoTarea.CERRADA) {
      throw new ConflictException(
        'La tarea está cerrada y ya no acepta entregas',
      );
    }

    const entregaActual = await this.prisma.entregaTarea.findUnique({
      where: {
        tareaId_alumnoId: { tareaId, alumnoId },
      },
      include: { archivos: true },
    });
    if (!this.puedeEditarEntrega(tarea, entregaActual)) {
      throw new ConflictException('Ya no puedes editar esta entrega');
    }

    const uploaded = this.mapUploadedFiles(archivos);
    this.validarArchivosEntrega(tarea.tipoEntrega, uploaded);
    const removeIds = this.parseIdList(dto.removerArchivoIds);
    const replaceAll = dto.reemplazarArchivos === true;
    const archivosRestantes = [
      ...(entregaActual?.archivos ?? []).filter(
        (item) => !replaceAll && !removeIds.includes(item.id),
      ),
      ...uploaded,
    ];
    this.validarPayloadEntrega(tarea, archivosRestantes, dto.comentario);

    const fueTardia = this.esEntregaTardia(tarea);
    const versionEntrega = (entregaActual?.versionEntrega ?? 0) + 1;
    const archivoUrl =
      archivosRestantes.find((item) => item.tipoArchivo !== 'IMAGEN')?.url ??
      archivosRestantes[0]?.url ??
      null;
    const firmaUrl =
      archivosRestantes.find((item) => item.tipoArchivo === 'IMAGEN')?.url ??
      null;

    const entrega = await this.prisma.$transaction(async (tx) => {
      if (entregaActual) {
        const actualesPorId = new Map(
          (entregaActual.archivos ?? []).map((item) => [item.id, item]),
        );
        if (replaceAll) {
          await this.eliminarArchivosPorIds(
            tx.entregaArchivo,
            entregaActual.archivos.map((item) => item.id),
            actualesPorId,
          );
        } else {
          await this.eliminarArchivosPorIds(
            tx.entregaArchivo,
            removeIds,
            actualesPorId,
          );
        }
      }

      const persisted = await tx.entregaTarea.upsert({
        where: {
          tareaId_alumnoId: { tareaId, alumnoId },
        },
        create: {
          tareaId,
          alumnoId,
          archivoUrl,
          firmaUrl,
          comentarioAlumno: dto.comentario,
          estadoRevision: EstadoRevision.ENTREGADA,
          fechaEntrega: new Date(),
          fueTardia,
          versionEntrega,
          permiteCorreccion: false,
          archivos: {
            create: uploaded,
          },
        },
        update: {
          archivoUrl,
          firmaUrl,
          comentarioAlumno: dto.comentario,
          estadoRevision: EstadoRevision.ENTREGADA,
          fechaEntrega: new Date(),
          fueTardia,
          versionEntrega,
          permiteCorreccion: false,
          calificacion: null,
          calificacionTipo: null,
          observacion: null,
          archivos: uploaded.length
            ? {
                create: uploaded,
              }
            : undefined,
        },
        include: {
          tarea: true,
          alumno: { select: { id: true, nombre: true, numeroControl: true } },
          archivos: true,
        },
      });

      return persisted;
    });

    await this.notificaciones.crear({
      usuarioId: tarea.docenteId,
      tipo: TipoNotificacion.ENTREGA_RECIBIDA,
      titulo: fueTardia
        ? `Entrega tardía: ${tarea.titulo}`
        : `Nueva entrega: ${tarea.titulo}`,
      mensaje: fueTardia
        ? `Un alumno entregó tarde la tarea "${tarea.titulo}"`
        : `Un alumno entregó la tarea "${tarea.titulo}"`,
      referenciaId: entrega.id,
      referenciaTipo: 'EntregaTarea',
    });

    return entrega;
  }

  private async validarContextoTarea(
    actor: Actor,
    dto: Partial<CrearTareaDto>,
  ) {
    if (!dto.materiaId)
      throw new BadRequestException('La materia es obligatoria');
    if (!dto.grupoId) throw new BadRequestException('El grupo es obligatorio');
    const materia = await this.prisma.materia.findUnique({
      where: { id: dto.materiaId },
      include: {
        grupos: { select: { id: true, nombre: true } },
        unidades: { select: { id: true, orden: true, nombre: true } },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    this.validarAccesoDocente(actor, materia.docenteId ?? undefined);

    const grupo = await this.prisma.grupo.findUnique({
      where: { id: dto.grupoId },
      select: { id: true, nombre: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const grupoValido = materia.grupos.some((item) => item.id === dto.grupoId);
    if (!grupoValido) {
      throw new BadRequestException(
        'El grupo no está vinculado a la materia seleccionada',
      );
    }

    const unidad = dto.unidadId
      ? materia.unidades.find((item) => item.id === dto.unidadId)
      : null;
    if (dto.unidadId && !unidad) {
      throw new BadRequestException(
        'La unidad no pertenece a la materia seleccionada',
      );
    }

    return { materia, grupo, unidad };
  }

  private buildTareaData(dto: Partial<CrearTareaDto>, contexto: any): any {
    const tieneFechaLimite = dto.tieneFechaLimite !== false;
    const fechaLimite = this.resolverFechaLimite(
      tieneFechaLimite,
      dto.fechaLimite,
      dto.horaLimite,
    );
    const estadoInicial = dto.estado ?? EstadoTarea.BORRADOR;
    const estado = this.esEstadoPublicada(estadoInicial)
      ? this.resolverEstadoPublico(fechaLimite, tieneFechaLimite)
      : estadoInicial;

    return {
      materiaId: contexto.materia.id,
      grupoId: contexto.grupo.id,
      unidadId: dto.unidadId ?? null,
      unidad: contexto.unidad?.orden ?? null,
      titulo: dto.titulo?.trim(),
      instrucciones: dto.instrucciones?.trim(),
      tipoEntrega: dto.tipoEntrega,
      tipoEvaluacion: dto.tipoEvaluacion ?? TipoEvaluacion.DIRECTA,
      permiteReenvio: dto.permiteReenvio === true,
      tieneFechaLimite,
      fechaLimite,
      horaLimite: tieneFechaLimite
        ? (dto.horaLimite ?? this.formatHora(fechaLimite))
        : null,
      fechaPublicacion: this.esEstadoPublicada(estado) ? new Date() : null,
      estado,
      rubricJson: this.normalizarRubrica(dto.rubricJson),
      activa: estado !== EstadoTarea.CERRADA,
    };
  }

  private taskInclude() {
    return {
      materia: { select: { id: true, nombre: true, clave: true } },
      grupo: {
        select: { id: true, nombre: true, semestre: true, seccion: true },
      },
      unidadRef: {
        select: { id: true, nombre: true, orden: true, status: true },
      },
      archivos: true,
    };
  }

  private buildDateWhere(fecha?: string) {
    if (!fecha) return null;
    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(`${fecha}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return null;
    return {
      OR: [
        { fechaPublicacion: { gte: start, lte: end } },
        { fechaLimite: { gte: start, lte: end } },
      ],
    };
  }

  private async enrichTasks(tareas: any[]) {
    const alumnosCache = new Map<string, any[]>();
    const entregas = tareas.length
      ? await this.prisma.entregaTarea.findMany({
          where: { tareaId: { in: tareas.map((item) => item.id) } },
          select: {
            id: true,
            tareaId: true,
            estadoRevision: true,
            calificacion: true,
            fueTardia: true,
          },
        })
      : [];
    const entregasPorTarea = new Map<number, any[]>();
    for (const entrega of entregas) {
      const items = entregasPorTarea.get(entrega.tareaId) ?? [];
      items.push(entrega);
      entregasPorTarea.set(entrega.tareaId, items);
    }

    return Promise.all(
      tareas.map((tarea) =>
        this.enrichTask(
          tarea,
          alumnosCache,
          entregasPorTarea.get(tarea.id) ?? [],
        ),
      ),
    );
  }

  private async enrichTask(
    tarea: any,
    alumnosCache?: Map<string, any[]>,
    entregas?: any[],
  ) {
    const alumnos = await this.obtenerAlumnosDeTarea(tarea, alumnosCache);
    const items =
      entregas ??
      (await this.prisma.entregaTarea.findMany({
        where: { tareaId: tarea.id },
        select: {
          id: true,
          tareaId: true,
          estadoRevision: true,
          calificacion: true,
          fueTardia: true,
        },
      }));

    const totalAlumnos = alumnos.length;
    const entregadas = items.filter((item) =>
      ESTADOS_CON_ENTREGA.has(item.estadoRevision),
    ).length;
    const pendientesRevision = items.filter((item) =>
      ESTADOS_PENDIENTES_REVISION.has(item.estadoRevision),
    ).length;
    const entregasTardias = items.filter((item) => item.fueTardia).length;
    const calificadas = items.filter(
      (item) => item.estadoRevision === EstadoRevision.CALIFICADA,
    ).length;
    const promedioItems = items
      .map((item) => item.calificacion)
      .filter((value) => typeof value === 'number');
    const promedio = promedioItems.length
      ? Number(
          (
            promedioItems.reduce((sum, value) => sum + value, 0) /
            promedioItems.length
          ).toFixed(2),
        )
      : null;

    return {
      ...tarea,
      totalAlumnos,
      entregadas,
      noEntregadas: Math.max(totalAlumnos - entregadas, 0),
      pendientesRevision,
      entregasTardias,
      calificadas,
      promedio,
      porcentajeEntrega: totalAlumnos
        ? Number(((entregadas / totalAlumnos) * 100).toFixed(2))
        : 0,
    };
  }

  private buildDashboardStats(items: any[]) {
    return {
      tareasActivas: items.filter((item) =>
        [EstadoTarea.PUBLICADA, EstadoTarea.BORRADOR].includes(item.estado),
      ).length,
      pendientesRevision: items.reduce(
        (sum, item) => sum + item.pendientesRevision,
        0,
      ),
      vencidas: items.filter((item) => item.estado === EstadoTarea.VENCIDA)
        .length,
      entregasTardias: items.reduce(
        (sum, item) => sum + item.entregasTardias,
        0,
      ),
    };
  }

  private buildEntregaStats(cards: any[]) {
    return {
      pendientes: cards.filter((item) =>
        this.esPendienteRevision(item.estadoRevision),
      ).length,
      revisadas: cards.filter(
        (item) => item.estadoRevision === EstadoRevision.REVISADA,
      ).length,
      incorrectas: cards.filter(
        (item) => item.estadoRevision === EstadoRevision.INCORRECTA,
      ).length,
      tardias: cards.filter((item) => item.fueTardia).length,
      noEntregadas: cards.filter(
        (item) => item.estadoRevision === EstadoRevision.NO_ENTREGADA,
      ).length,
    };
  }

  private async obtenerAlumnosDeTarea(
    tarea: any,
    cache = new Map<string, any[]>(),
  ) {
    const key = `${tarea.materiaId}:${tarea.grupoId ?? 'all'}`;
    if (cache.has(key)) return cache.get(key)!;

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        materiaId: tarea.materiaId,
        estado: 'ACEPTADA',
        alumno: {
          rol: 'ALUMNO',
          activo: true,
          ...(tarea.grupoId ? { grupoId: tarea.grupoId } : {}),
        },
      },
      select: {
        alumno: {
          select: {
            id: true,
            nombre: true,
            numeroControl: true,
            grupoId: true,
          },
        },
      },
      orderBy: { alumno: { nombre: 'asc' } },
    });
    const alumnos = inscripciones.map((item) => item.alumno);
    cache.set(key, alumnos);
    return alumnos;
  }

  private async validarAccesoAlumno(alumnoId: number, tarea: any) {
    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: {
        alumnoId,
        materiaId: tarea.materiaId,
        estado: 'ACEPTADA',
        ...(tarea.grupoId ? { alumno: { grupoId: tarea.grupoId } } : {}),
      },
    });
    if (!inscripcion) {
      throw new ForbiddenException('No tienes acceso a esta tarea');
    }
  }

  private async validarAlumnoEnTarea(alumnoId: number, tarea: any) {
    const alumnos = await this.obtenerAlumnosDeTarea(tarea);
    if (!alumnos.some((item) => item.id === alumnoId)) {
      throw new BadRequestException(
        'El alumno no pertenece al grupo/materia de la tarea',
      );
    }
  }

  private async obtenerTareaDocente(tareaId: number, actor: Actor) {
    const tarea = await this.prisma.tarea.findUnique({
      where: { id: tareaId },
      include: this.taskInclude(),
    });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');
    this.validarAccesoDocente(actor, tarea.docenteId);
    return tarea;
  }

  private async obtenerEntregaDocente(entregaId: number, actor: Actor) {
    const entrega = await this.prisma.entregaTarea.findUnique({
      where: { id: entregaId },
      include: {
        tarea: true,
        archivos: true,
      },
    });
    if (!entrega) throw new NotFoundException('Entrega no encontrada');
    this.validarAccesoDocente(actor, entrega.tarea.docenteId);
    return entrega;
  }

  private validarAccesoDocente(actor: Actor, docenteId?: number | null) {
    if (actor.rol === 'ADMIN') return;
    if (!docenteId || docenteId !== actor.id) {
      throw new ForbiddenException('No tienes permisos sobre este recurso');
    }
  }

  private resolverFechaLimite(
    tieneFechaLimite: boolean,
    fecha?: string,
    hora?: string,
  ) {
    if (!tieneFechaLimite) return null;
    if (!fecha) throw new BadRequestException('La fecha límite es obligatoria');
    const limite = new Date(fecha);
    if (Number.isNaN(limite.getTime())) {
      throw new BadRequestException('La fecha límite no es válida');
    }
    if (hora && /^\d{2}:\d{2}$/.test(hora)) {
      const [hours, minutes] = hora.split(':').map((value) => Number(value));
      limite.setHours(hours, minutes, 0, 0);
    }
    if (hora && !/^\d{2}:\d{2}$/.test(hora)) {
      throw new BadRequestException('La hora límite debe usar formato HH:mm');
    }
    return limite;
  }

  private resolverEstadoPublico(
    fechaLimite: Date | null | undefined,
    tieneFechaLimite: boolean,
  ) {
    if (!tieneFechaLimite || !fechaLimite) return EstadoTarea.PUBLICADA;
    return fechaLimite.getTime() < Date.now()
      ? EstadoTarea.VENCIDA
      : EstadoTarea.PUBLICADA;
  }

  private esEstadoPublicada(estado?: EstadoTarea | null) {
    return estado === EstadoTarea.PUBLICADA || estado === EstadoTarea.VENCIDA;
  }

  private normalizarRubrica(rubricJson?: string) {
    if (!rubricJson) return null;
    try {
      return JSON.stringify(JSON.parse(rubricJson));
    } catch {
      throw new BadRequestException('La rúbrica debe ser un JSON válido');
    }
  }

  private parseIdList(value?: string | null) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed.map((item) => Number(item)).filter(Number.isFinite);
    } catch {
      return value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter(Number.isFinite);
    }
    return [];
  }

  private formatHora(date?: Date | null) {
    if (!date) return null;
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private mapUploadedFiles(files: Express.Multer.File[]) {
    return files.map((file) => ({
      nombre: file.originalname,
      url: buildPublicUploadUrl(file.filename),
      tipoArchivo: fileTypeFromName(file.originalname),
    }));
  }

  private validarArchivosEntrega(
    tipoEntrega: TipoEntrega,
    archivos: Array<{ nombre: string; tipoArchivo: string }>,
    tarea = false,
  ) {
    if (tarea || archivos.length === 0) return;
    if (
      tipoEntrega === TipoEntrega.FIRMA &&
      archivos.some((item) => item.tipoArchivo !== 'IMAGEN')
    ) {
      throw new BadRequestException(
        'La entrega con foto de firma solo acepta imágenes',
      );
    }
  }

  private validarPayloadEntrega(
    tarea: any,
    archivos: Array<{ nombre?: string; tipoArchivo: string }>,
    comentario?: string,
  ) {
    if (tarea.tipoEntrega === TipoEntrega.EN_LINEA && archivos.length === 0) {
      throw new BadRequestException(
        'La entrega con archivo requiere al menos un archivo',
      );
    }
    if (tarea.tipoEntrega === TipoEntrega.FIRMA && archivos.length === 0) {
      throw new BadRequestException(
        'La entrega con foto de firma requiere al menos una imagen',
      );
    }
    if (
      tarea.tipoEntrega === TipoEntrega.REVISION_EN_LINEA &&
      archivos.length === 0 &&
      !comentario?.trim()
    ) {
      throw new BadRequestException(
        'La revisión en línea requiere comentario o archivos adjuntos',
      );
    }
  }

  private puedeEditarEntrega(tarea: any, entrega: any | null) {
    if (tarea.estado === EstadoTarea.CERRADA) return false;
    if (!entrega) return true;
    if (!tarea.tieneFechaLimite || !tarea.fechaLimite) return true;
    const beforeDeadline =
      new Date().getTime() <= new Date(tarea.fechaLimite).getTime();
    if (beforeDeadline) return true;
    return tarea.permiteReenvio || entrega.permiteCorreccion;
  }

  private esEntregaTardia(tarea: any) {
    if (!tarea.tieneFechaLimite || !tarea.fechaLimite) return false;
    return new Date().getTime() > new Date(tarea.fechaLimite).getTime();
  }

  private obtenerEstadoSinEntrega(tarea: any) {
    if (tarea.estado === EstadoTarea.CERRADA)
      return EstadoRevision.NO_ENTREGADA;
    if (
      tarea.tieneFechaLimite &&
      tarea.fechaLimite &&
      new Date(tarea.fechaLimite).getTime() < Date.now()
    ) {
      return EstadoRevision.NO_ENTREGADA;
    }
    return EstadoRevision.PENDIENTE;
  }

  private esPendienteRevision(estado: EstadoRevision) {
    return (
      estado === EstadoRevision.PENDIENTE || estado === EstadoRevision.ENTREGADA
    );
  }

  private matchesEntregaFilter(
    item: any,
    filtros: { estado?: string; tardia?: boolean; q?: string },
  ) {
    if (filtros.tardia && !item.fueTardia) return false;
    if (filtros.q) {
      const query = filtros.q.toLowerCase();
      const hayMatch =
        item.alumno.nombre.toLowerCase().includes(query) ||
        (item.alumno.numeroControl ?? '').toLowerCase().includes(query);
      if (!hayMatch) return false;
    }
    if (!filtros.estado) return true;
    const estado = filtros.estado.toUpperCase();
    if (estado === 'PENDIENTES')
      return this.esPendienteRevision(item.estadoRevision);
    if (estado === 'TARDIAS') return item.fueTardia;
    if (estado === 'NO_ENTREGADAS')
      return item.estadoRevision === EstadoRevision.NO_ENTREGADA;
    return item.estadoRevision === estado;
  }

  private async sincronizarTareasVencidas() {
    await this.prisma.tarea.updateMany({
      where: {
        estado: EstadoTarea.PUBLICADA,
        tieneFechaLimite: true,
        fechaLimite: { lt: new Date() },
      },
      data: { estado: EstadoTarea.VENCIDA },
    });
  }

  private async sincronizarTareaVencida(tareaId: number) {
    await this.prisma.tarea.updateMany({
      where: {
        id: tareaId,
        estado: EstadoTarea.PUBLICADA,
        tieneFechaLimite: true,
        fechaLimite: { lt: new Date() },
      },
      data: { estado: EstadoTarea.VENCIDA },
    });
  }

  private async notificarNuevaTarea(tarea: any) {
    const alumnos = await this.obtenerAlumnosDeTarea(tarea);
    const alumnoIds = alumnos.map((item) => item.id);
    if (!alumnoIds.length) return;
    await this.notificaciones.crearParaVarios(alumnoIds, {
      tipo: TipoNotificacion.TAREA_NUEVA,
      titulo: `Nueva tarea: ${tarea.titulo}`,
      mensaje: `Se publicó una nueva tarea en ${tarea.materia.nombre}: ${tarea.titulo}`,
      referenciaId: tarea.id,
      referenciaTipo: 'Tarea',
    });
  }

  private async eliminarArchivosPorIds(
    model: any,
    ids: number[],
    existing: Map<number, any>,
  ) {
    if (!ids.length) return;
    const records = ids.map((id) => existing.get(id)).filter(Boolean);
    await model.deleteMany({
      where: { id: { in: ids } },
    });
    await Promise.all(
      records.map((record) => this.eliminarArchivoFisico(record.url)),
    );
  }

  private async eliminarArchivoFisico(url?: string | null) {
    if (!url) return;
    const filename = url.split('/').pop();
    if (!filename) return;
    await unlink(getUploadAbsolutePath(filename)).catch(() => undefined);
  }
}
