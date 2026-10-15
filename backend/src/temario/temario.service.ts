import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { asegurarAccesoMateria } from '../common/materia-ownership';
import { PeriodosService } from '../periodos/periodos.service';
import {
  estadoTema,
  resumirAvance,
  semanaDelCurso,
  semanasDelCurso,
  type EstadoTema,
} from './temario.util';
import { GuardarTemasDto } from './dto/guardar-temas.dto';
import { GuardarBitacoraDto } from './dto/guardar-bitacora.dto';

type Actor = { id: number; rol: string };

export type TemaConAvance = {
  id: number;
  orden: number;
  nombre: string;
  semana: number | null;
  vistoEn: Date | null;
  estado: EstadoTema;
};

@Injectable()
export class TemarioService {
  constructor(
    private prisma: PrismaService,
    private periodos: PeriodosService,
  ) {}

  /**
   * El temario de la materia por unidad. Con grupo, además, el avance de ese
   * grupo: cuándo se vio cada tema y cuáles van atrasados.
   */
  async obtener(actor: Actor, materiaId: number, grupoId?: number) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: {
        id: true,
        nombre: true,
        clave: true,
        docente: { select: { nombre: true } },
        grupos: grupoId
          ? {
              where: { id: grupoId },
              select: { id: true, nombre: true, modalidad: true },
            }
          : { select: { id: true, nombre: true, modalidad: true } },
        unidades: {
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            nombre: true,
            orden: true,
            status: true,
            temas: {
              orderBy: { orden: 'asc' },
              select: { id: true, orden: true, nombre: true, semana: true },
            },
          },
        },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    const grupo = grupoId ? (materia.grupos[0] ?? null) : null;
    if (grupoId && !grupo) {
      throw new BadRequestException(
        'El grupo no esta vinculado a la materia seleccionada',
      );
    }

    // Primera clase del grupo en que se vio cada tema.
    const vistos = grupo
      ? await this.prisma.temaVisto.findMany({
          where: {
            tema: { unidad: { materiaId } },
            sesion: { grupoId: grupo.id },
          },
          select: { temaId: true, sesion: { select: { fecha: true } } },
        })
      : [];
    const vistoEn = new Map<number, Date>();
    for (const visto of vistos) {
      const previo = vistoEn.get(visto.temaId);
      if (!previo || visto.sesion.fecha < previo) {
        vistoEn.set(visto.temaId, visto.sesion.fecha);
      }
    }

    const hoy = new Date();
    const rango = grupo
      ? await this.periodos.obtenerRangoActual(hoy, grupo.modalidad)
      : null;
    const semanaActual = rango
      ? semanaDelCurso(rango.inicio, rango.fin, hoy)
      : 0;

    const unidades = materia.unidades.map((unidad) => {
      const temas: TemaConAvance[] = unidad.temas.map((tema) => {
        const fecha = vistoEn.get(tema.id) ?? null;
        return {
          ...tema,
          vistoEn: fecha,
          estado: grupo ? estadoTema(tema, fecha, semanaActual) : 'PENDIENTE',
        };
      });
      return {
        id: unidad.id,
        nombre: unidad.nombre,
        orden: unidad.orden,
        status: unidad.status,
        temas,
        avance: grupo ? resumirAvance(temas, semanaActual) : null,
      };
    });

    return {
      materia: {
        id: materia.id,
        nombre: materia.nombre,
        clave: materia.clave,
        docente: materia.docente?.nombre ?? null,
      },
      grupo,
      periodo: rango
        ? {
            clave: rango.clave,
            semanaActual,
            semanas: semanasDelCurso(rango.inicio, rango.fin),
          }
        : null,
      unidades,
      avance: grupo
        ? resumirAvance(
            unidades.flatMap((unidad) => unidad.temas),
            semanaActual,
          )
        : null,
    };
  }

  /**
   * Reemplaza los temas de una unidad: conserva los que traen id (y su
   * avance), crea los nuevos y borra los que ya no vienen.
   */
  async guardarTemas(actor: Actor, unidadId: number, dto: GuardarTemasDto) {
    const unidad = await this.prisma.unidad.findUnique({
      where: { id: unidadId },
      select: { id: true, materiaId: true, temas: { select: { id: true } } },
    });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    await asegurarAccesoMateria(this.prisma, actor, unidad.materiaId);

    const propios = new Set(unidad.temas.map((tema) => tema.id));
    const ajenos = dto.temas.filter(
      (tema) => tema.id != null && !propios.has(tema.id),
    );
    if (ajenos.length) {
      throw new BadRequestException('Un tema no pertenece a esta unidad');
    }
    const conservados = new Set(
      dto.temas.map((tema) => tema.id).filter((id) => id != null),
    );

    await this.prisma.$transaction([
      this.prisma.temaUnidad.deleteMany({
        where: { unidadId, id: { notIn: [...conservados] as number[] } },
      }),
      ...dto.temas.map((tema, indice) => {
        const datos = {
          orden: indice + 1,
          nombre: tema.nombre.trim(),
          semana: tema.semana ?? null,
        };
        return tema.id != null
          ? this.prisma.temaUnidad.update({
              where: { id: tema.id },
              data: datos,
            })
          : this.prisma.temaUnidad.create({ data: { unidadId, ...datos } });
      }),
    ]);
    return this.obtener(actor, unidad.materiaId);
  }

  /**
   * La bitácora de una clase: los temas de la materia (primero los de su
   * unidad), cuáles se marcaron en esta clase y cuáles ya se habían visto
   * antes en el grupo, más la nota.
   */
  async obtenerBitacora(actor: Actor, sesionId: number) {
    const sesion = await this.sesionPropia(actor, sesionId);
    const [temario, marcados] = await Promise.all([
      this.obtener(actor, sesion.materiaId, sesion.grupoId ?? undefined),
      this.prisma.temaVisto.findMany({
        where: { claseSesionId: sesionId },
        select: { temaId: true },
      }),
    ]);
    const enEsta = new Set(marcados.map((item) => item.temaId));
    // La unidad de la clase va primero: es la que casi siempre se marca.
    const unidades = [...temario.unidades].sort(
      (a, b) =>
        Number(b.id === sesion.unidadId) - Number(a.id === sesion.unidadId) ||
        a.orden - b.orden,
    );
    return {
      sesion: {
        id: sesion.id,
        fecha: sesion.fecha,
        unidadId: sesion.unidadId,
        activa: sesion.activa,
        nota: sesion.bitacora,
      },
      materia: temario.materia,
      unidades: unidades.map((unidad) => ({
        id: unidad.id,
        nombre: unidad.nombre,
        temas: unidad.temas.map((tema) => ({
          id: tema.id,
          nombre: tema.nombre,
          semana: tema.semana,
          enEstaClase: enEsta.has(tema.id),
          // Visto en otra clase del grupo (no en esta).
          vistoAntes:
            !enEsta.has(tema.id) && tema.vistoEn ? tema.vistoEn : null,
        })),
      })),
    };
  }

  async guardarBitacora(
    actor: Actor,
    sesionId: number,
    dto: GuardarBitacoraDto,
  ) {
    const sesion = await this.sesionPropia(actor, sesionId);
    const temaIds = [...new Set(dto.temaIds)];
    if (temaIds.length) {
      const validos = await this.prisma.temaUnidad.count({
        where: { id: { in: temaIds }, unidad: { materiaId: sesion.materiaId } },
      });
      if (validos !== temaIds.length) {
        throw new BadRequestException('Un tema no pertenece a esta materia');
      }
    }
    await this.prisma.$transaction([
      this.prisma.temaVisto.deleteMany({ where: { claseSesionId: sesionId } }),
      this.prisma.temaVisto.createMany({
        data: temaIds.map((temaId) => ({ claseSesionId: sesionId, temaId })),
      }),
      this.prisma.claseSesion.update({
        where: { id: sesionId },
        data: { bitacora: dto.nota?.trim() || null },
        select: { id: true },
      }),
    ]);
    return this.obtenerBitacora(actor, sesionId);
  }

  /** Sólo el docente de la clase (o un admin) escribe su bitácora. */
  private async sesionPropia(actor: Actor, sesionId: number) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: sesionId },
      select: {
        id: true,
        docenteId: true,
        materiaId: true,
        grupoId: true,
        unidadId: true,
        fecha: true,
        activa: true,
        bitacora: true,
      },
    });
    if (!sesion) throw new NotFoundException('Clase no encontrada');
    if (actor.rol !== 'ADMIN' && sesion.docenteId !== actor.id) {
      throw new ForbiddenException('Esta clase no es tuya');
    }
    return sesion;
  }
}
