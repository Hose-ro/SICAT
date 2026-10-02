import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoTarea, ModalidadGrupo, Prisma, Tarea } from '@prisma/client';
import { randomUUID } from 'crypto';
import { copyFile } from 'fs/promises';
import { extname } from 'path';
import { PrismaService } from '../prisma.service';
import {
  asegurarAccesoMateria,
  docenteResponsableDeMateria,
} from '../common/materia-ownership';
import { buildUploadUrl, getUploadAbsolutePath } from './tareas.storage';

type Actor = { id: number; rol: string };

const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA_MS = 7 * DIA_MS;

type TareaConArchivos = Tarea & {
  archivos: { nombre: string; url: string; tipoArchivo: string }[];
};

/**
 * Duplicar una tarea e importar las de un grupo anterior. La materia no tiene
 * periodo (unidades, ponderación y categorías ya se conservan de un semestre a
 * otro); lo que cambia es el grupo, así que copiar el curso es copiar tareas
 * de un grupo a otro de la misma materia. Las copias siempre nacen en borrador.
 */
@Injectable()
export class TareasCopiaService {
  constructor(private prisma: PrismaService) {}

  async duplicar(
    tareaId: number,
    actor: Actor,
    opciones: { grupoId?: number; conFechas?: boolean } = {},
  ) {
    const origen = await this.obtenerOrigen(tareaId, actor);
    const grupoId = opciones.grupoId ?? origen.grupoId;
    if (!grupoId) {
      throw new BadRequestException('Elige el grupo de la copia');
    }
    await this.validarDestino(actor, origen.materiaId, grupoId);

    const mismoGrupo = grupoId === origen.grupoId;
    const { tarea, adjuntosOmitidos } = await this.copiar(origen, actor, {
      grupoId,
      titulo: mismoGrupo ? this.tituloCopia(origen.titulo) : origen.titulo,
      fechaLimite: opciones.conFechas === false ? null : origen.fechaLimite,
    });
    return { id: tarea.id, titulo: tarea.titulo, adjuntosOmitidos };
  }

  /**
   * Grupos de la misma materia de los que el docente puede traer tareas, con
   * la fecha que tendría cada una si se desplaza al periodo del grupo destino.
   */
  async listarImportables(
    actor: Actor,
    materiaId: number,
    grupoDestinoId: number,
  ) {
    const destino = await this.validarDestino(actor, materiaId, grupoDestinoId);
    const tareas = await this.prisma.tarea.findMany({
      where: {
        materiaId,
        grupoId: { not: grupoDestinoId },
        ...(actor.rol === 'ADMIN' ? {} : { docenteId: actor.id }),
      },
      select: {
        id: true,
        titulo: true,
        grupoId: true,
        estado: true,
        tipoEntrega: true,
        tieneFechaLimite: true,
        fechaLimite: true,
        unidadRef: { select: { id: true, nombre: true, orden: true } },
        categoria: { select: { id: true, nombre: true } },
        grupo: {
          select: { id: true, nombre: true, periodo: true, modalidad: true },
        },
      },
      orderBy: [{ unidad: 'asc' }, { fechaLimite: 'asc' }, { id: 'asc' }],
    });

    const grupos = new Map<
      number,
      {
        grupo: NonNullable<(typeof tareas)[number]['grupo']>;
        desplazamientoDias: number | null;
        tareas: Array<
          Omit<(typeof tareas)[number], 'grupo'> & {
            fechaSugerida: Date | null;
          }
        >;
      }
    >();
    for (const { grupo, ...tarea } of tareas) {
      if (!grupo) continue;
      let entrada = grupos.get(grupo.id);
      if (!entrada) {
        const desplazamiento = await this.desplazamiento(grupo, destino);
        entrada = {
          grupo,
          desplazamientoDias:
            desplazamiento == null ? null : desplazamiento / DIA_MS,
          tareas: [],
        };
        grupos.set(grupo.id, entrada);
      }
      entrada.tareas.push({
        ...tarea,
        fechaSugerida: this.desplazar(
          tarea.fechaLimite,
          entrada.desplazamientoDias == null
            ? null
            : entrada.desplazamientoDias * DIA_MS,
        ),
      });
    }

    // El periodo más reciente primero: es casi siempre el que se quiere copiar.
    return [...grupos.values()].sort((a, b) =>
      b.grupo.periodo.localeCompare(a.grupo.periodo, 'es', { numeric: true }),
    );
  }

  async importar(
    actor: Actor,
    dto: {
      materiaId: number;
      grupoDestinoId: number;
      tareaIds: number[];
      ajustarFechas?: boolean;
    },
  ) {
    const destino = await this.validarDestino(
      actor,
      dto.materiaId,
      dto.grupoDestinoId,
    );
    const origenes = await this.prisma.tarea.findMany({
      where: { id: { in: dto.tareaIds } },
      include: {
        archivos: { select: { nombre: true, url: true, tipoArchivo: true } },
        grupo: { select: { id: true, periodo: true, modalidad: true } },
      },
      orderBy: [{ unidad: 'asc' }, { fechaLimite: 'asc' }, { id: 'asc' }],
    });
    if (origenes.length !== dto.tareaIds.length) {
      throw new NotFoundException('Alguna de las tareas ya no existe');
    }
    for (const origen of origenes) {
      if (origen.materiaId !== dto.materiaId) {
        throw new BadRequestException(
          'Sólo se pueden importar tareas de la misma materia',
        );
      }
      this.asegurarAutor(origen, actor);
    }

    const desplazamientos = new Map<number, number | null>();
    let adjuntosOmitidos = 0;
    const creadas: { id: number; titulo: string }[] = [];
    for (const origen of origenes) {
      let fechaLimite: Date | null = null;
      if (dto.ajustarFechas !== false && origen.grupo) {
        if (!desplazamientos.has(origen.grupo.id)) {
          desplazamientos.set(
            origen.grupo.id,
            await this.desplazamiento(origen.grupo, destino),
          );
        }
        fechaLimite = this.desplazar(
          origen.fechaLimite,
          desplazamientos.get(origen.grupo.id) ?? null,
        );
      }
      const copia = await this.copiar(origen, actor, {
        grupoId: dto.grupoDestinoId,
        titulo: origen.titulo,
        fechaLimite,
      });
      adjuntosOmitidos += copia.adjuntosOmitidos;
      creadas.push({ id: copia.tarea.id, titulo: copia.tarea.titulo });
    }

    return { creadas, adjuntosOmitidos };
  }

  private async copiar(
    origen: TareaConArchivos,
    actor: Actor,
    destino: { grupoId: number; titulo: string; fechaLimite: Date | null },
  ) {
    // Cada copia tiene su propio archivo: al reemplazar un adjunto se borra
    // del disco y no debe llevarse el de la tarea original.
    const archivos: Prisma.TareaArchivoCreateWithoutTareaInput[] = [];
    let adjuntosOmitidos = 0;
    for (const archivo of origen.archivos) {
      const original = archivo.url.split('/').pop();
      if (!original) {
        adjuntosOmitidos += 1;
        continue;
      }
      const nuevo = `${randomUUID()}${extname(original).toLowerCase()}`;
      try {
        await copyFile(
          getUploadAbsolutePath(original),
          getUploadAbsolutePath(nuevo),
        );
        archivos.push({
          nombre: archivo.nombre,
          url: buildUploadUrl(nuevo),
          tipoArchivo: archivo.tipoArchivo,
        });
      } catch {
        adjuntosOmitidos += 1;
      }
    }

    const docenteId =
      actor.rol === 'ADMIN'
        ? ((await docenteResponsableDeMateria(
            this.prisma,
            origen.materiaId,
            destino.grupoId,
          )) ?? origen.docenteId)
        : actor.id;

    const tarea = await this.prisma.tarea.create({
      data: {
        materiaId: origen.materiaId,
        grupoId: destino.grupoId,
        docenteId,
        titulo: destino.titulo,
        instrucciones: origen.instrucciones,
        unidad: origen.unidad,
        unidadId: origen.unidadId,
        categoriaId: origen.categoriaId,
        tipoEntrega: origen.tipoEntrega,
        tipoEvaluacion: origen.tipoEvaluacion,
        permiteReenvio: origen.permiteReenvio,
        tieneFechaLimite: origen.tieneFechaLimite,
        fechaLimite: origen.tieneFechaLimite ? destino.fechaLimite : null,
        horaLimite: origen.tieneFechaLimite ? origen.horaLimite : null,
        rubricJson: origen.rubricJson,
        estado: EstadoTarea.BORRADOR,
        fechaPublicacion: null,
        activa: true,
        archivosAdjuntos: archivos.length
          ? JSON.stringify(archivos.map((item) => item.url))
          : null,
        archivos: { create: archivos },
      },
      select: { id: true, titulo: true },
    });
    return { tarea, adjuntosOmitidos };
  }

  private async obtenerOrigen(tareaId: number, actor: Actor) {
    const origen = await this.prisma.tarea.findUnique({
      where: { id: tareaId },
      include: {
        archivos: { select: { nombre: true, url: true, tipoArchivo: true } },
      },
    });
    if (!origen) throw new NotFoundException('Tarea no encontrada');
    this.asegurarAutor(origen, actor);
    return origen;
  }

  /** Sólo se copian tareas propias: las de un periodo pasado pueden no tener horario activo. */
  private asegurarAutor(tarea: { docenteId: number }, actor: Actor) {
    if (actor.rol !== 'ADMIN' && tarea.docenteId !== actor.id) {
      throw new ForbiddenException('Sólo puedes copiar tus propias tareas');
    }
  }

  private async validarDestino(
    actor: Actor,
    materiaId: number,
    grupoId: number,
  ) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const grupo = await this.prisma.grupo.findFirst({
      where: { id: grupoId, materias: { some: { id: materiaId } } },
      select: { id: true, periodo: true, modalidad: true },
    });
    if (!grupo) {
      throw new BadRequestException(
        'El grupo no está vinculado a la materia seleccionada',
      );
    }
    return grupo;
  }

  /**
   * Distancia entre el inicio del periodo de un grupo y el del otro, en
   * semanas completas para que cada tarea caiga en el mismo día de la semana.
   * `null` si no se puede saber cuándo empieza alguno de los dos.
   */
  private async desplazamiento(
    origen: { periodo: string; modalidad: ModalidadGrupo },
    destino: { periodo: string; modalidad: ModalidadGrupo },
  ) {
    const [inicioOrigen, inicioDestino] = await Promise.all([
      this.inicioDePeriodo(origen.periodo, origen.modalidad),
      this.inicioDePeriodo(destino.periodo, destino.modalidad),
    ]);
    if (!inicioOrigen || !inicioDestino) return null;
    const semanas = Math.round(
      (inicioDestino.getTime() - inicioOrigen.getTime()) / SEMANA_MS,
    );
    return semanas * SEMANA_MS;
  }

  private desplazar(fecha: Date | null, desplazamiento: number | null) {
    if (!fecha || desplazamiento == null) return null;
    return new Date(fecha.getTime() + desplazamiento);
  }

  /**
   * Fecha de inicio capturada para ese periodo y modalidad; si no se capturó
   * y la clave tiene la forma "2026-A", el inicio estimado del semestre.
   */
  private async inicioDePeriodo(clave: string, modalidad: ModalidadGrupo) {
    const guardado = await this.prisma.periodoAcademico.findUnique({
      where: { clave_modalidad: { clave, modalidad } },
      select: { fechaInicio: true },
    });
    if (guardado) return guardado.fechaInicio;
    const match = /^(\d{4})-([AB])$/i.exec(clave.trim());
    if (!match) return null;
    return new Date(
      Number(match[1]),
      match[2].toUpperCase() === 'A' ? 0 : 6,
      1,
    );
  }

  private tituloCopia(titulo: string) {
    const sufijo = ' (copia)';
    return `${titulo.slice(0, 160 - sufijo.length)}${sufijo}`;
  }
}
