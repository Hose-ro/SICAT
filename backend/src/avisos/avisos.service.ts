import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Aviso, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { asegurarAccesoMateria } from '../common/materia-ownership';
import { alumnosDeClase } from '../common/alumnos-clase';
import {
  horarioAplicaEnFecha,
  parsearFechaClave,
} from '../clases/clases.utils';
import {
  CrearAvisoDto,
  EditarAvisoDto,
  GuardarWhatsappDto,
} from './dto/aviso.dto';

type Actor = { id: number; rol: string };

const AUTOR = { select: { id: true, nombre: true } } as const;

/** "lunes 6 de octubre" a partir de "2026-10-06". */
function fechaLarga(clave: string) {
  const fecha = parsearFechaClave(clave);
  return fecha
    ? fecha
        .toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
        .replace(',', '')
    : clave;
}

/**
 * Deja el enlace de invitación como `https://chat.whatsapp.com/<código>`, sin
 * parámetros. Acepta lo que el docente pega de WhatsApp (con o sin https).
 * Devuelve null si no es un enlace de grupo.
 */
export function normalizarEnlaceWhatsapp(valor: string): string | null {
  const limpio = valor.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  const match =
    /^(?:https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,40})$/i.exec(
      limpio,
    );
  return match ? `https://chat.whatsapp.com/${match[1]}` : null;
}

@Injectable()
export class AvisosService {
  private readonly logger = new Logger(AvisosService.name);

  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  /** Publica el aviso y lo notifica al grupo, o sólo al alumno si se indica. */
  async crear(actor: Actor, dto: CrearAvisoDto) {
    await asegurarAccesoMateria(this.prisma, actor, dto.materiaId, dto.grupoId);
    const materia = await this.materiaDelGrupo(dto.materiaId, dto.grupoId);

    let destinatarios = (
      await alumnosDeClase(this.prisma, dto.materiaId, dto.grupoId)
    ).map((alumno) => alumno.id);
    if (dto.alumnoId) {
      if (!destinatarios.includes(dto.alumnoId)) {
        throw new BadRequestException(
          'El alumno no está inscrito en este grupo',
        );
      }
      destinatarios = [dto.alumnoId];
    }

    const aviso = await this.prisma.aviso.create({
      data: {
        materiaId: dto.materiaId,
        grupoId: dto.grupoId,
        alumnoId: dto.alumnoId ?? null,
        docenteId: actor.id,
        titulo: dto.titulo.trim(),
        cuerpo: dto.cuerpo.trim(),
        // Fijar sólo tiene sentido en el tablero del grupo.
        fijado: dto.alumnoId ? false : dto.fijado === true,
      },
      include: { docente: AUTOR, alumno: AUTOR },
    });
    await this.notificar(aviso, materia.nombre, destinatarios);
    return { ...aviso, destinatarios: destinatarios.length };
  }

  /**
   * Avisos de una clase para el docente. Sin alumno, los del grupo; con
   * alumno, los que se le mandaron sólo a él.
   */
  async listarDocente(
    actor: Actor,
    filtros: { materiaId: number; grupoId: number; alumnoId?: number },
  ) {
    await asegurarAccesoMateria(
      this.prisma,
      actor,
      filtros.materiaId,
      filtros.grupoId,
    );
    return this.prisma.aviso.findMany({
      where: {
        materiaId: filtros.materiaId,
        grupoId: filtros.grupoId,
        alumnoId: filtros.alumnoId ?? null,
      },
      include: { docente: AUTOR, alumno: AUTOR },
      orderBy: [{ fijado: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  /** Enlace del grupo de WhatsApp de la clase, si el docente lo guardó. */
  async obtenerWhatsapp(actor: Actor, materiaId: number, grupoId: number) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const guardado = await this.prisma.grupoWhatsapp.findUnique({
      where: { materiaId_grupoId: { materiaId, grupoId } },
    });
    return { enlace: guardado?.enlace ?? null };
  }

  /** Guarda el enlace del grupo de WhatsApp; vacío lo quita. */
  async guardarWhatsapp(actor: Actor, dto: GuardarWhatsappDto) {
    const { materiaId, grupoId } = dto;
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const id = { materiaId_grupoId: { materiaId, grupoId } };
    if (!dto.enlace.trim()) {
      await this.prisma.grupoWhatsapp.deleteMany({
        where: { materiaId, grupoId },
      });
      return { enlace: null };
    }
    const enlace = normalizarEnlaceWhatsapp(dto.enlace);
    if (!enlace) {
      throw new BadRequestException(
        'Pega el enlace de invitación del grupo (https://chat.whatsapp.com/…)',
      );
    }
    await this.prisma.grupoWhatsapp.upsert({
      where: id,
      create: { materiaId, grupoId, enlace },
      update: { enlace },
    });
    return { enlace };
  }

  /** Lo que ve el alumno en la materia: avisos de su grupo y los suyos. */
  async listarAlumno(alumnoId: number, materiaId: number) {
    const [usuario, inscripciones] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: alumnoId },
        select: { grupoId: true },
      }),
      this.prisma.inscripcion.findMany({
        where: { alumnoId, materiaId, estado: 'ACEPTADA' },
        select: { grupoId: true },
      }),
    ]);
    if (!inscripciones.length) return [];
    const grupoIds = [
      ...new Set(
        [usuario?.grupoId, ...inscripciones.map((item) => item.grupoId)].filter(
          (id): id is number => typeof id === 'number',
        ),
      ),
    ];
    if (!grupoIds.length) return [];

    return this.prisma.aviso.findMany({
      where: {
        materiaId,
        grupoId: { in: grupoIds },
        OR: [{ alumnoId: null }, { alumnoId }],
      },
      select: {
        id: true,
        titulo: true,
        cuerpo: true,
        fijado: true,
        alumnoId: true,
        createdAt: true,
        updatedAt: true,
        docente: AUTOR,
      },
      orderBy: [{ fijado: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });
  }

  /** Corrige el texto o lo fija; no vuelve a notificar. */
  async editar(actor: Actor, id: number, dto: EditarAvisoDto) {
    const aviso = await this.obtenerPropio(actor, id);
    return this.prisma.aviso.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.cuerpo !== undefined ? { cuerpo: dto.cuerpo.trim() } : {}),
        ...(dto.fijado !== undefined && !aviso.alumnoId
          ? { fijado: dto.fijado }
          : {}),
      },
      include: { docente: AUTOR, alumno: AUTOR },
    });
  }

  async eliminar(actor: Actor, id: number) {
    await this.obtenerPropio(actor, id);
    await this.prisma.aviso.delete({ where: { id } });
    return { id };
  }

  /**
   * Al suspender un día, avisa "no hay clase" a cada grupo que el docente
   * tenía ese día. Si la suspensión ya existía sólo se actualiza el motivo,
   * sin volver a notificar. Un fallo aquí no debe deshacer la suspensión.
   */
  async avisarSuspensiones(
    docenteId: number,
    fechas: string[],
    motivo: string,
  ) {
    try {
      const horarios = await this.prisma.horarioMateria.findMany({
        where: { docenteId, activo: true, grupoId: { not: null } },
        select: {
          dias: true,
          materiaId: true,
          grupoId: true,
          materia: { select: { nombre: true } },
        },
      });
      for (const fecha of fechas) {
        const dia = parsearFechaClave(fecha);
        if (!dia) continue;
        const clases = new Map<string, (typeof horarios)[number]>();
        for (const horario of horarios) {
          if (horarioAplicaEnFecha(horario.dias, dia)) {
            clases.set(`${horario.materiaId}:${horario.grupoId}`, horario);
          }
        }
        for (const clase of clases.values()) {
          const grupoId = clase.grupoId as number;
          const existente = await this.prisma.aviso.findFirst({
            where: {
              docenteId,
              materiaId: clase.materiaId,
              grupoId,
              suspensionFecha: fecha,
            },
            select: { id: true },
          });
          if (existente) {
            await this.prisma.aviso.update({
              where: { id: existente.id },
              data: { cuerpo: motivo },
            });
            continue;
          }
          const aviso = await this.prisma.aviso.create({
            data: {
              materiaId: clase.materiaId,
              grupoId,
              docenteId,
              titulo: `No hay clase el ${fechaLarga(fecha)}`,
              cuerpo: motivo,
              suspensionFecha: fecha,
            },
          });
          const alumnos = await alumnosDeClase(
            this.prisma,
            clase.materiaId,
            grupoId,
          );
          await this.notificar(
            aviso,
            clase.materia.nombre,
            alumnos.map((alumno) => alumno.id),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `No se pudo avisar la suspensión del docente ${docenteId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Si el docente quita la suspensión, avisa que siempre sí hay clase. */
  async retirarAvisosDeSuspension(docenteId: number, fecha: string) {
    try {
      const avisos = await this.prisma.aviso.findMany({
        where: { docenteId, suspensionFecha: fecha },
        include: { materia: { select: { nombre: true } } },
      });
      for (const aviso of avisos) {
        const alumnos = await alumnosDeClase(
          this.prisma,
          aviso.materiaId,
          aviso.grupoId,
        );
        await this.notificaciones.crearParaVarios(
          alumnos.map((alumno) => alumno.id),
          {
            tipo: TipoNotificacion.AVISO_DOCENTE,
            titulo: `${aviso.materia.nombre}: sí hay clase el ${fechaLarga(fecha)}`,
            mensaje: 'Se canceló la suspensión; la clase sigue como siempre.',
            referenciaId: aviso.materiaId,
            referenciaTipo: 'Materia',
          },
        );
      }
      if (avisos.length) {
        await this.prisma.aviso.deleteMany({
          where: { id: { in: avisos.map((aviso) => aviso.id) } },
        });
      }
    } catch (error) {
      this.logger.error(
        `No se pudo retirar el aviso de suspensión del docente ${docenteId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async notificar(
    aviso: Aviso,
    materiaNombre: string,
    destinatarios: number[],
  ) {
    await this.notificaciones.crearParaVarios(destinatarios, {
      tipo: TipoNotificacion.AVISO_DOCENTE,
      titulo: `${materiaNombre}: ${aviso.titulo}`,
      mensaje: aviso.cuerpo.slice(0, 280),
      // La notificación lleva a la materia, donde está el tablero de avisos.
      referenciaId: aviso.materiaId,
      referenciaTipo: 'Materia',
    });
  }

  private async materiaDelGrupo(materiaId: number, grupoId: number) {
    const materia = await this.prisma.materia.findFirst({
      where: { id: materiaId, grupos: { some: { id: grupoId } } },
      select: { id: true, nombre: true },
    });
    if (!materia) {
      throw new BadRequestException(
        'El grupo no está vinculado a la materia seleccionada',
      );
    }
    return materia;
  }

  private async obtenerPropio(actor: Actor, id: number) {
    const aviso = await this.prisma.aviso.findUnique({ where: { id } });
    if (!aviso) throw new NotFoundException('Aviso no encontrado');
    if (actor.rol !== 'ADMIN' && aviso.docenteId !== actor.id) {
      throw new ForbiddenException('Sólo puedes cambiar tus propios avisos');
    }
    return aviso;
  }
}
