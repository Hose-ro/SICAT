import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoAlertaCarrera } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import { formatearFechaClave, parsearFechaClave } from '../clases/clases.utils';
import { RegistrarSeguimientoDto } from './dto/seguimiento.dto';
import {
  fechaSupervision,
  filtroGrupoVigente,
  grupoPerteneceAPeriodo,
  huellaSeguimiento,
  leerHuella,
  periodoSupervision,
  type ReferenciaSeguimiento,
} from './supervision.utils';

type Consulta = { carreraId: number; periodo?: string };

const seguimientoInclude = {
  responsable: { select: { id: true, nombre: true } },
  notas: {
    orderBy: { createdAt: 'asc' },
    include: { autor: { select: { id: true, nombre: true } } },
  },
} satisfies Prisma.AlertaCarreraInclude;

type SeguimientoDb = Prisma.AlertaCarreraGetPayload<{
  include: typeof seguimientoInclude;
}>;

type Caso = {
  ref: ReferenciaSeguimiento;
  titulo: string;
  mensaje: string;
  referenciaTipo: string;
  referenciaId: number;
  responsableId: number | null;
};

const fechaLegible = (clave: string) =>
  parsearFechaClave(clave)!.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/**
 * Seguimientos de jefatura: un caso detectado (lista sin captura, alumno en
 * riesgo, calificaciones pendientes o un docente) con su historial de notas.
 * Leer nunca escribe; solo registrar una nota crea o actualiza el caso.
 */
@Injectable()
export class SeguimientosService {
  constructor(private prisma: PrismaService) {}

  private async alcance(usuarioId: number, carreraId: number) {
    const asignacion = await this.prisma.jefeCarreraAsignacion.findFirst({
      where: { usuarioId, carreraId, activa: true },
      select: { id: true },
    });
    if (!asignacion)
      throw new ForbiddenException('Carrera fuera de tu alcance');
  }

  private async grupoIdsDelPeriodo(carreraId: number, periodo: string) {
    const grupos = await this.prisma.grupo.findMany({
      where: { carreraId, ...filtroGrupoVigente(periodo) },
      select: { id: true, periodo: true, createdAt: true },
    });
    return grupos
      .filter((grupo) => grupoPerteneceAPeriodo(grupo, periodo))
      .map((grupo) => grupo.id);
  }

  async listar(usuarioId: number, consulta: Consulta) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    const seguimientos = await this.prisma.alertaCarrera.findMany({
      where: {
        carreraId: consulta.carreraId,
        periodo,
        notas: { some: {} },
      },
      include: seguimientoInclude,
    });
    return seguimientos.map((s) => this.presentar(s)).sort(ordenSeguimientos);
  }

  async registrar(
    usuarioId: number,
    consulta: Consulta,
    dto: RegistrarSeguimientoDto,
  ) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    if (periodo !== getCurrentAcademicPeriod())
      throw new BadRequestException(
        'Los periodos anteriores son de solo consulta',
      );
    const texto = dto.texto.trim();
    if (texto.length < 3)
      throw new BadRequestException('Escribe qué se acordó o revisó');
    const fechaRevision =
      dto.estado === 'CERRADA' || !dto.fechaRevision
        ? null
        : this.fechaRevision(dto.fechaRevision);

    const existente = dto.alertaId
      ? await this.prisma.alertaCarrera.findFirst({
          where: { id: dto.alertaId, carreraId: consulta.carreraId, periodo },
          select: { id: true },
        })
      : null;
    if (dto.alertaId && !existente)
      throw new NotFoundException('Seguimiento fuera de tu carrera o periodo');
    const caso = existente
      ? null
      : await this.caso(consulta.carreraId, periodo, dto);

    const id = await this.prisma.$transaction(async (tx) => {
      const datos = { estado: dto.estado, fechaSeguimiento: fechaRevision };
      const alerta = existente
        ? await tx.alertaCarrera.update({
            where: { id: existente.id },
            data: datos,
          })
        : await tx.alertaCarrera.upsert({
            where: {
              fingerprint: huellaSeguimiento(
                consulta.carreraId,
                periodo,
                caso!.ref,
              ),
            },
            create: {
              fingerprint: huellaSeguimiento(
                consulta.carreraId,
                periodo,
                caso!.ref,
              ),
              tipo: caso!.ref.tipo as TipoAlertaCarrera,
              titulo: caso!.titulo,
              mensaje: caso!.mensaje,
              referenciaTipo: caso!.referenciaTipo,
              referenciaId: caso!.referenciaId,
              responsableId: caso!.responsableId,
              carreraId: consulta.carreraId,
              periodo,
              ...datos,
            },
            update: { titulo: caso!.titulo, mensaje: caso!.mensaje, ...datos },
          });
      await tx.seguimientoNota.create({
        data: {
          alertaId: alerta.id,
          autorId: usuarioId,
          texto,
          estado: dto.estado,
          fechaRevision,
        },
      });
      return alerta.id;
    });
    const guardado = await this.prisma.alertaCarrera.findUniqueOrThrow({
      where: { id },
      include: seguimientoInclude,
    });
    return this.presentar(guardado);
  }

  /** Notas registradas en un intervalo, para el informe del periodo. */
  async notasEnRango(
    carreraId: number,
    periodo: string,
    desde: Date,
    hasta: Date,
  ) {
    const notas = await this.prisma.seguimientoNota.findMany({
      where: {
        alerta: { carreraId, periodo },
        createdAt: { gte: desde, lte: hasta },
      },
      include: {
        autor: { select: { nombre: true } },
        alerta: { select: { titulo: true, mensaje: true, tipo: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return notas.map((n) => ({
      fecha: n.createdAt.toISOString(),
      caso: n.alerta.titulo,
      detalle: n.alerta.mensaje,
      tipo: n.alerta.tipo,
      estado: n.estado,
      autor: n.autor?.nombre ?? 'Registro anterior',
      texto: n.texto,
    }));
  }

  private fechaRevision(value: string) {
    const clave = value.slice(0, 10);
    const fecha = fechaSupervision(clave);
    if (clave < formatearFechaClave(new Date()))
      throw new BadRequestException(
        'La fecha de revisión no puede quedar en el pasado',
      );
    return fecha;
  }

  /** Valida que el caso pertenezca a la carrera y periodo, y arma su descripción. */
  private async caso(
    carreraId: number,
    periodo: string,
    dto: RegistrarSeguimientoDto,
  ): Promise<Caso> {
    const fuera = () =>
      new NotFoundException('El caso no pertenece a tu carrera o periodo');
    const grupoIds = await this.grupoIdsDelPeriodo(carreraId, periodo);
    switch (dto.tipo) {
      case 'ASISTENCIA_SIN_CAPTURA': {
        if (!dto.horarioId || !dto.fecha)
          throw new BadRequestException('Indica la clase y su fecha');
        fechaSupervision(dto.fecha);
        const horario = await this.prisma.horarioMateria.findFirst({
          where: {
            id: dto.horarioId,
            materia: { carreraId },
            grupo: { id: { in: grupoIds }, carreraId },
          },
          include: {
            materia: { select: { nombre: true } },
            grupo: { select: { nombre: true } },
            docente: { select: { id: true, nombre: true } },
          },
        });
        if (!horario) throw fuera();
        return {
          ref: { tipo: dto.tipo, horarioId: horario.id, fecha: dto.fecha },
          titulo: `Lista sin captura · ${horario.materia.nombre} · ${horario.grupo?.nombre ?? 'sin grupo'}`,
          mensaje: `${fechaLegible(dto.fecha)}, ${horario.horaInicio}–${horario.horaFin} · ${horario.docente.nombre}`,
          referenciaTipo: 'Clase',
          referenciaId: horario.id,
          responsableId: horario.docente.id,
        };
      }
      case 'ALUMNO_RIESGO': {
        if (!dto.alumnoId) throw new BadRequestException('Indica el alumno');
        const alumno = await this.prisma.usuario.findFirst({
          where: { id: dto.alumnoId, rol: 'ALUMNO', carreraId },
          select: {
            id: true,
            nombre: true,
            numeroControl: true,
            grupo: { select: { nombre: true } },
          },
        });
        if (!alumno) throw fuera();
        return {
          ref: { tipo: dto.tipo, alumnoId: alumno.id },
          titulo: `Alumno en riesgo · ${alumno.nombre}`,
          mensaje: [
            alumno.numeroControl,
            alumno.grupo ? `Grupo ${alumno.grupo.nombre}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          referenciaTipo: 'Alumno',
          referenciaId: alumno.id,
          responsableId: null,
        };
      }
      case 'CALIFICACIONES_PENDIENTES': {
        if (!dto.materiaId || !dto.grupoId)
          throw new BadRequestException('Indica la materia y el grupo');
        const [materia, grupo] = await Promise.all([
          this.prisma.materia.findFirst({
            where: {
              id: dto.materiaId,
              carreraId,
              grupos: {
                some: {
                  id: { equals: dto.grupoId, in: grupoIds },
                  carreraId,
                },
              },
            },
            select: {
              id: true,
              nombre: true,
              docenteId: true,
              horarios: {
                where: { grupoId: dto.grupoId, activo: true },
                select: { docenteId: true },
                take: 1,
              },
            },
          }),
          this.prisma.grupo.findFirst({
            where: {
              id: { equals: dto.grupoId, in: grupoIds },
              carreraId,
            },
            select: { id: true, nombre: true },
          }),
        ]);
        if (!materia || !grupo) throw fuera();
        return {
          ref: { tipo: dto.tipo, materiaId: materia.id, grupoId: grupo.id },
          titulo: `Calificaciones pendientes · ${materia.nombre} · ${grupo.nombre}`,
          mensaje: 'Unidades cerradas sin calificación capturada',
          referenciaTipo: 'Oferta',
          referenciaId: materia.id,
          responsableId:
            materia.horarios[0]?.docenteId ?? materia.docenteId ?? null,
        };
      }
      case 'SEGUIMIENTO_DOCENTE': {
        if (!dto.docenteId) throw new BadRequestException('Indica el docente');
        const docente = await this.prisma.usuario.findFirst({
          where: {
            id: dto.docenteId,
            rol: 'DOCENTE',
            OR: [
              {
                horariosDocente: {
                  some: {
                    materia: { carreraId },
                    grupo: { id: { in: grupoIds }, carreraId },
                  },
                },
              },
              {
                docenteMaterias: {
                  some: {
                    carreraId,
                    grupos: { some: { id: { in: grupoIds } } },
                  },
                },
              },
            ],
          },
          select: { id: true, nombre: true },
        });
        if (!docente) throw fuera();
        return {
          ref: { tipo: dto.tipo, docenteId: docente.id },
          titulo: `Seguimiento con ${docente.nombre}`,
          mensaje: 'Acuerdos y revisiones con el docente',
          referenciaTipo: 'Docente',
          referenciaId: docente.id,
          responsableId: docente.id,
        };
      }
      default:
        throw new BadRequestException('Indica qué caso se está siguiendo');
    }
  }

  private presentar(s: SeguimientoDb) {
    return {
      id: s.id,
      tipo: s.tipo,
      titulo: s.titulo,
      mensaje: s.mensaje,
      estado: s.estado,
      abierto: s.estado !== 'CERRADA',
      fechaRevision: s.fechaSeguimiento
        ? formatearFechaClave(s.fechaSeguimiento)
        : null,
      responsable: s.responsable,
      referencia: leerHuella(s.fingerprint),
      creadoEn: s.createdAt.toISOString(),
      actualizadoEn: s.updatedAt.toISOString(),
      notas: s.notas.map((n) => ({
        id: n.id,
        texto: n.texto,
        estado: n.estado,
        fechaRevision: n.fechaRevision
          ? formatearFechaClave(n.fechaRevision)
          : null,
        autor: n.autor?.nombre ?? 'Registro anterior',
        creadoEn: n.createdAt.toISOString(),
      })),
    };
  }
}

/** Abiertos primero, por fecha de revisión más próxima; luego lo más reciente. */
export function ordenSeguimientos(
  a: { abierto: boolean; fechaRevision: string | null; actualizadoEn: string },
  b: { abierto: boolean; fechaRevision: string | null; actualizadoEn: string },
) {
  if (a.abierto !== b.abierto) return a.abierto ? -1 : 1;
  if (a.abierto && a.fechaRevision !== b.fechaRevision) {
    if (!a.fechaRevision) return 1;
    if (!b.fechaRevision) return -1;
    return a.fechaRevision.localeCompare(b.fechaRevision);
  }
  return b.actualizadoEn.localeCompare(a.actualizadoEn);
}
