import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActualizarClaseDto } from './dto/actualizar-clase.dto';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';
import { ValidarConflictoHorarioDto } from './dto/validar-conflicto-horario.dto';
import { hayConflictoHorario } from './utils/conflicto-horario.util';

const ORDEN_DIAS: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

const DIA_CANONICO: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miercoles',
  miércoles: 'Miercoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sabado',
  sábado: 'Sabado',
};

const HORARIO_INCLUDE = {
  materia: {
    select: {
      id: true,
      nombre: true,
      clave: true,
      carrera: { select: { id: true, nombre: true } },
      semestre: true,
    },
  },
  docente: {
    select: { id: true, nombre: true, email: true },
  },
  aula: {
    select: { id: true, nombre: true, edificio: true, capacidad: true },
  },
  grupo: {
    select: {
      id: true,
      nombre: true,
      semestre: true,
      periodo: true,
      carrera: { select: { id: true, nombre: true, codigo: true } },
    },
  },
} satisfies Prisma.HorarioMateriaInclude;

type Tx = Prisma.TransactionClient;

type HorarioConRelaciones = Prisma.HorarioMateriaGetPayload<{
  include: typeof HORARIO_INCLUDE;
}>;

type BloqueClase = {
  horarioId: number;
  dia: string;
  horaInicio: string;
  horaFin: string;
  aulaId: number | null;
  aula: HorarioConRelaciones['aula'];
};

type HorarioInput = {
  materiaId: number;
  docenteId: number;
  aulaId?: number | null;
  grupoId?: number | null;
  dias?: string[];
  horaInicio?: string;
  horaFin?: string;
  bloques?: Array<{
    dia: string;
    horaInicio: string;
    horaFin: string;
  }>;
  semestre?: number | null;
};

/** Quien ejecuta la acción: el admin programa para cualquiera, el docente para sí. */
type ActorHorario = { id: number; rol: string };

type ConflictoHorario = {
  tipo: 'docente' | 'aula' | 'grupo' | 'materia-grupo';
  mensaje: string;
  horario: any;
};

@Injectable()
export class HorariosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateHorarioDto, actor?: ActorHorario) {
    const payloads = await this.prepararHorarios(
      this.aplicarActorDocente(actor, dto),
    );
    const validacion = await this.validarConflictos(payloads);
    if (!validacion.ok) throw new ConflictException(validacion.message);

    const creados = await this.prisma.$transaction(async (tx) => {
      await this.asegurarTitularidadEnTransaccion(tx, payloads[0]);

      const horarios: any[] = [];
      for (const payload of payloads) {
        horarios.push(
          await tx.horarioMateria.create({
            data: {
              materiaId: payload.materiaId,
              docenteId: payload.docenteId,
              aulaId: payload.aulaId ?? null,
              grupoId: payload.grupoId ?? null,
              dias: payload.dias,
              horaInicio: payload.horaInicio,
              horaFin: payload.horaFin,
              semestre: payload.semestre ?? null,
            },
            include: HORARIO_INCLUDE,
          }),
        );
      }

      await this.sincronizarMateriaGrupos(tx, payloads[0].materiaId);
      await this.sincronizarMateriaLegacy(tx, payloads[0].materiaId);
      return horarios;
    });

    return creados.length === 1 ? creados[0] : creados;
  }

  async findAll(
    filters: {
      materiaId?: number;
      docenteId?: number;
      aulaId?: number;
      grupoId?: number;
      activo?: boolean;
    } = {},
  ) {
    const horarios = await this.prisma.horarioMateria.findMany({
      where: {
        ...(filters.materiaId ? { materiaId: filters.materiaId } : {}),
        ...(filters.docenteId ? { docenteId: filters.docenteId } : {}),
        ...(filters.aulaId ? { aulaId: filters.aulaId } : {}),
        ...(filters.grupoId ? { grupoId: filters.grupoId } : {}),
        activo: filters.activo ?? true,
      },
      include: HORARIO_INCLUDE,
    });

    return this.ordenarHorarios(horarios);
  }

  async findOne(id: number) {
    const horario = await this.prisma.horarioMateria.findUnique({
      where: { id },
      include: HORARIO_INCLUDE,
    });
    if (!horario) throw new NotFoundException('Horario no encontrado');
    return horario;
  }

  async update(id: number, dto: UpdateHorarioDto, actor?: ActorHorario) {
    const actual = await this.prisma.horarioMateria.findUnique({
      where: { id },
    });
    if (!actual) throw new NotFoundException('Horario no encontrado');
    await this.asegurarPropiedadHorarios(actor, [id]);

    const payloads = await this.prepararHorarios({
      materiaId: dto.materiaId ?? actual.materiaId,
      docenteId: this.resolverDocenteActor(
        actor,
        dto.docenteId ?? actual.docenteId,
      ),
      aulaId:
        dto.aulaId === undefined
          ? (actual.aulaId ?? undefined)
          : (dto.aulaId ?? undefined),
      grupoId: dto.grupoId === undefined ? actual.grupoId : dto.grupoId,
      dias: dto.bloques
        ? undefined
        : (dto.dias ?? actual.dias.split(',').map((dia) => dia.trim())),
      horaInicio: dto.bloques
        ? undefined
        : (dto.horaInicio ?? actual.horaInicio),
      horaFin: dto.bloques ? undefined : (dto.horaFin ?? actual.horaFin),
      bloques: dto.bloques,
      semestre: dto.semestre ?? actual.semestre ?? undefined,
    });

    const validacion = await this.validarConflictos(payloads, id);
    if (!validacion.ok) throw new ConflictException(validacion.message);

    const actualizados = await this.prisma.$transaction(async (tx) => {
      const [principal, ...extras] = payloads;
      const horarios: any[] = [];

      horarios.push(
        await tx.horarioMateria.update({
          where: { id },
          data: {
            materiaId: principal.materiaId,
            docenteId: principal.docenteId,
            aulaId: principal.aulaId ?? null,
            grupoId: principal.grupoId ?? null,
            dias: principal.dias,
            horaInicio: principal.horaInicio,
            horaFin: principal.horaFin,
            semestre: principal.semestre ?? null,
          },
          include: HORARIO_INCLUDE,
        }),
      );

      for (const extra of extras) {
        horarios.push(
          await tx.horarioMateria.create({
            data: {
              materiaId: extra.materiaId,
              docenteId: extra.docenteId,
              aulaId: extra.aulaId ?? null,
              grupoId: extra.grupoId ?? null,
              dias: extra.dias,
              horaInicio: extra.horaInicio,
              horaFin: extra.horaFin,
              semestre: extra.semestre ?? null,
            },
            include: HORARIO_INCLUDE,
          }),
        );
      }

      await this.sincronizarMateriaGrupos(tx, actual.materiaId);
      await this.sincronizarMateriaLegacy(tx, actual.materiaId);
      if (principal.materiaId !== actual.materiaId) {
        await this.sincronizarMateriaGrupos(tx, principal.materiaId);
        await this.sincronizarMateriaLegacy(tx, principal.materiaId);
      }

      return horarios;
    });

    return actualizados.length === 1 ? actualizados[0] : actualizados;
  }

  async actualizarClase(dto: ActualizarClaseDto, actor?: ActorHorario) {
    const existentes = await this.prisma.horarioMateria.findMany({
      where: { id: { in: dto.horarioIds }, activo: true },
      include: HORARIO_INCLUDE,
    });

    if (existentes.length === 0) {
      throw new NotFoundException('La clase no tiene bloques activos');
    }
    await this.asegurarPropiedadHorarios(actor, dto.horarioIds);

    const identidades = new Set(
      existentes.map(
        (horario) =>
          `${horario.materiaId}-${horario.docenteId}-${horario.grupoId ?? 'sin-grupo'}`,
      ),
    );
    if (identidades.size > 1) {
      throw new BadRequestException(
        'Los bloques enviados pertenecen a clases distintas',
      );
    }

    const payloads = await this.prepararHorarios({
      materiaId: dto.materiaId,
      docenteId: this.resolverDocenteActor(actor, dto.docenteId),
      aulaId: dto.aulaId ?? undefined,
      grupoId: dto.grupoId ?? undefined,
      bloques: dto.bloques,
      semestre: dto.semestre ?? undefined,
    });

    const idsClase = existentes.map((horario) => horario.id);
    const validacion = await this.validarConflictos(payloads, idsClase);
    if (!validacion.ok) throw new ConflictException(validacion.message);

    const materiaAnterior = existentes[0].materiaId;

    await this.prisma.$transaction(async (tx) => {
      await this.asegurarTitularidadEnTransaccion(tx, payloads[0], idsClase);

      const reutilizables = new Map<string, number>();
      for (const fila of existentes) {
        const dias = fila.dias
          .split(',')
          .map((dia) => dia.trim())
          .filter(Boolean);
        if (dias.length === 1 && !reutilizables.has(dias[0])) {
          reutilizables.set(dias[0], fila.id);
        }
      }

      const reutilizados = new Set<number>();

      for (const payload of payloads) {
        const data = {
          materiaId: payload.materiaId,
          docenteId: payload.docenteId,
          aulaId: payload.aulaId ?? null,
          grupoId: payload.grupoId ?? null,
          dias: payload.dias,
          horaInicio: payload.horaInicio,
          horaFin: payload.horaFin,
          semestre: payload.semestre ?? null,
        };

        const filaId = reutilizables.get(payload.dias);
        if (filaId !== undefined) {
          reutilizados.add(filaId);
          await tx.horarioMateria.update({ where: { id: filaId }, data });
        } else {
          await tx.horarioMateria.create({ data });
        }
      }

      const sobrantes = idsClase.filter((id) => !reutilizados.has(id));
      if (sobrantes.length > 0) {
        await tx.horarioMateria.updateMany({
          where: { id: { in: sobrantes } },
          data: { activo: false },
        });
      }

      await this.sincronizarMateriaGrupos(tx, materiaAnterior);
      await this.sincronizarMateriaLegacy(tx, materiaAnterior);
      if (dto.materiaId !== materiaAnterior) {
        await this.sincronizarMateriaGrupos(tx, dto.materiaId);
        await this.sincronizarMateriaLegacy(tx, dto.materiaId);
      }
    });

    const actualizados = await this.prisma.horarioMateria.findMany({
      where: {
        materiaId: dto.materiaId,
        docenteId: dto.docenteId,
        grupoId: dto.grupoId ?? null,
        activo: true,
      },
      include: HORARIO_INCLUDE,
    });

    return this.agruparEnClases(actualizados)[0] ?? null;
  }

  async eliminarClase(horarioIds: number[], actor?: ActorHorario) {
    const existentes = await this.prisma.horarioMateria.findMany({
      where: { id: { in: horarioIds }, activo: true },
      select: { id: true, materiaId: true },
    });

    if (existentes.length === 0) {
      throw new NotFoundException('La clase no tiene bloques activos');
    }
    await this.asegurarPropiedadHorarios(actor, horarioIds);

    const materiaIds = Array.from(
      new Set(existentes.map((horario) => horario.materiaId)),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.horarioMateria.updateMany({
        where: { id: { in: existentes.map((horario) => horario.id) } },
        data: { activo: false },
      });

      for (const materiaId of materiaIds) {
        await this.sincronizarMateriaGrupos(tx, materiaId);
        await this.sincronizarMateriaLegacy(tx, materiaId);
      }
    });

    return { eliminados: existentes.length };
  }

  async remove(id: number, actor?: ActorHorario) {
    const horario = await this.prisma.horarioMateria.findUnique({
      where: { id },
    });
    if (!horario) throw new NotFoundException('Horario no encontrado');
    await this.asegurarPropiedadHorarios(actor, [id]);

    return this.prisma.$transaction(async (tx) => {
      const eliminado = await tx.horarioMateria.update({
        where: { id },
        data: { activo: false },
        include: HORARIO_INCLUDE,
      });
      await this.sincronizarMateriaGrupos(tx, horario.materiaId);
      await this.sincronizarMateriaLegacy(tx, horario.materiaId);
      return eliminado;
    });
  }

  async validarConflicto(dto: ValidarConflictoHorarioDto, actor?: ActorHorario) {
    const payloads = await this.prepararHorarios(
      this.aplicarActorDocente(actor, dto),
    );
    return this.validarConflictos(payloads, dto.horarioIds ?? dto.horarioId);
  }

  /**
   * Un docente sólo programa clases suyas: cualquier docenteId que llegue en la
   * petición se sustituye por el de la sesión. El administrador programa para
   * quien indique.
   */
  private aplicarActorDocente<T extends { docenteId: number }>(
    actor: ActorHorario | undefined,
    input: T,
  ): T {
    if (!actor || actor.rol === 'ADMIN') return input;
    return { ...input, docenteId: actor.id };
  }

  private resolverDocenteActor(
    actor: ActorHorario | undefined,
    docenteId: number,
  ) {
    if (!actor || actor.rol === 'ADMIN') return docenteId;
    return actor.id;
  }

  private async asegurarPropiedadHorarios(
    actor: ActorHorario | undefined,
    horarioIds: number[],
  ) {
    if (!actor || actor.rol === 'ADMIN' || horarioIds.length === 0) return;
    const ajenos = await this.prisma.horarioMateria.count({
      where: { id: { in: horarioIds }, docenteId: { not: actor.id } },
    });
    if (ajenos > 0) {
      throw new ForbiddenException(
        'Sólo puedes modificar las clases que impartes.',
      );
    }
  }

  async obtenerHorarioDocente(docenteId: number) {
    const docente = await this.prisma.usuario.findUnique({
      where: { id: docenteId },
      select: {
        id: true,
        nombre: true,
        email: true,
        academias: { select: { id: true, nombre: true } },
      },
    });
    if (!docente) throw new NotFoundException('Docente no encontrado');

    const horarios = await this.findAll({ docenteId });
    return { docente, horarios, clases: this.agruparEnClases(horarios) };
  }

  async obtenerHorarioAula(aulaId: number) {
    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula) throw new NotFoundException('Aula no encontrada');

    const horarios = await this.findAll({ aulaId });
    return { aula, horarios, clases: this.agruparEnClases(horarios) };
  }

  async obtenerHorarioGrupo(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: {
        id: true,
        nombre: true,
        semestre: true,
        periodo: true,
        carrera: { select: { id: true, nombre: true, codigo: true } },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const horarios = await this.findAll({ grupoId });
    return { grupo, horarios, clases: this.agruparEnClases(horarios) };
  }

  async obtenerHorarioAlumno(alumnoId: number) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { id: true, nombre: true, email: true, grupoId: true },
    });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');

    if (!alumno.grupoId) {
      return { alumno, grupo: null, horarios: [], clases: [] };
    }

    const { grupo, horarios, clases } = await this.obtenerHorarioGrupo(
      alumno.grupoId,
    );
    return { alumno, grupo, horarios, clases };
  }

  obtenerMateriasSinDocente() {
    return this.prisma.materia.findMany({
      where: { horarios: { none: { activo: true } } },
      include: {
        aula: true,
        carrera: { select: { id: true, nombre: true } },
        academias: { select: { id: true, nombre: true } },
        grupos: { select: { id: true, nombre: true } },
      },
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  obtenerMateriasSinAula() {
    return this.prisma.materia.findMany({
      where: { horarios: { none: { activo: true } } },
      include: {
        docente: { select: { id: true, nombre: true } },
        carrera: { select: { id: true, nombre: true } },
      },
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  async obtenerOcupacion(docenteId?: number, aulaId?: number) {
    const horarios = await this.findAll({
      ...(docenteId ? { docenteId } : {}),
      ...(aulaId ? { aulaId } : {}),
    });

    return horarios.map((horario) => ({
      horarioId: horario.id,
      materiaId: horario.materiaId,
      nombre: horario.materia.nombre,
      dias: horario.dias.split(',').map((dia) => dia.trim()),
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
    }));
  }

  async asignarDocente(materiaId: number, docenteId: number) {
    const horariosActivos = await this.prisma.horarioMateria.findMany({
      where: { materiaId, activo: true },
    });

    if (horariosActivos.length === 0) {
      const materia = await this.prisma.materia.findUnique({
        where: { id: materiaId },
      });
      if (!materia) throw new NotFoundException('Materia no encontrada');

      await this.validarDocenteMateria(materiaId, docenteId);
      return this.prisma.materia.update({
        where: { id: materiaId },
        data: { docenteId },
        include: {
          docente: { select: { id: true, nombre: true, email: true } },
          aula: true,
        },
      });
    }

    for (const horario of horariosActivos) {
      const validacion = await this.validarConflictoInterno(
        {
          materiaId,
          docenteId,
          aulaId: horario.aulaId,
          grupoId: horario.grupoId,
          dias: horario.dias,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          semestre: horario.semestre,
        },
        horario.id,
      );
      if (!validacion.ok) throw new ConflictException(validacion.message);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.horarioMateria.updateMany({
        where: { materiaId, activo: true },
        data: { docenteId },
      });
      await this.sincronizarMateriaLegacy(tx, materiaId);
    });

    return this.findAll({ materiaId });
  }

  async quitarDocente(materiaId: number) {
    const horariosActivos = await this.prisma.horarioMateria.count({
      where: { materiaId, activo: true },
    });
    if (horariosActivos > 0) {
      throw new BadRequestException(
        'La materia tiene horarios activos. Edita o elimina los horarios desde el módulo de horarios.',
      );
    }

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    return this.prisma.materia.update({
      where: { id: materiaId },
      data: { docenteId: null },
      include: { docente: { select: { id: true, nombre: true } }, aula: true },
    });
  }

  async asignarAula(materiaId: number, aulaId: number) {
    const horariosActivos = await this.prisma.horarioMateria.findMany({
      where: { materiaId, activo: true },
    });

    if (horariosActivos.length === 0) {
      const materia = await this.prisma.materia.findUnique({
        where: { id: materiaId },
      });
      if (!materia) throw new NotFoundException('Materia no encontrada');

      await this.validarAula(aulaId);
      return this.prisma.materia.update({
        where: { id: materiaId },
        data: { aulaId },
        include: {
          docente: { select: { id: true, nombre: true } },
          aula: true,
        },
      });
    }

    for (const horario of horariosActivos) {
      const validacion = await this.validarConflictoInterno(
        {
          materiaId,
          docenteId: horario.docenteId,
          aulaId,
          grupoId: horario.grupoId,
          dias: horario.dias,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          semestre: horario.semestre,
        },
        horario.id,
      );
      if (!validacion.ok) throw new ConflictException(validacion.message);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.horarioMateria.updateMany({
        where: { materiaId, activo: true },
        data: { aulaId },
      });
      await this.sincronizarMateriaLegacy(tx, materiaId);
    });

    return this.findAll({ materiaId });
  }

  async asignarAulaGrupo(
    grupoId: number,
    aulaId: number | null,
    horarioId?: number,
  ) {
    const grupo = await this.validarGrupo(grupoId);
    const aula = await this.validarAula(aulaId);

    const objetivos = await this.prisma.horarioMateria.findMany({
      where: {
        grupoId,
        activo: true,
        ...(horarioId ? { id: horarioId } : {}),
      },
      include: HORARIO_INCLUDE,
    });

    if (objetivos.length === 0) {
      throw new NotFoundException(
        horarioId
          ? 'El bloque de horario no pertenece a este grupo o está inactivo'
          : `El grupo ${grupo.nombre} no tiene bloques de horario activos. Programa su horario antes de asignar un aula.`,
      );
    }

    if (aula) {
      const idsObjetivo = objetivos.map((horario) => horario.id);
      const ocupados = await this.prisma.horarioMateria.findMany({
        where: {
          aulaId: aula.id,
          activo: true,
          id: { notIn: idsObjetivo },
        },
        include: HORARIO_INCLUDE,
      });

      for (const objetivo of objetivos) {
        const ocupado = ocupados.find((horario) =>
          hayConflictoHorario(objetivo, horario),
        );
        if (ocupado) {
          throw new ConflictException(
            this.construirMensajeConflicto('aula', ocupado),
          );
        }

        const traslape = objetivos.find(
          (otro) =>
            otro.id !== objetivo.id && hayConflictoHorario(objetivo, otro),
        );
        if (traslape) {
          throw new ConflictException(
            `Los bloques de ${objetivo.materia.nombre} y ${traslape.materia.nombre} del grupo ${grupo.nombre} se traslapan, no pueden compartir el aula ${aula.nombre}.`,
          );
        }
      }
    }

    const materiaIds = Array.from(
      new Set(objetivos.map((horario) => horario.materiaId)),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.horarioMateria.updateMany({
        where: { id: { in: objetivos.map((horario) => horario.id) } },
        data: { aulaId: aula?.id ?? null },
      });

      for (const materiaId of materiaIds) {
        await this.sincronizarMateriaLegacy(tx, materiaId);
      }
    });

    return this.obtenerHorarioGrupo(grupoId);
  }

  async quitarAula(materiaId: number) {
    const horariosActivos = await this.prisma.horarioMateria.count({
      where: { materiaId, activo: true },
    });
    if (horariosActivos > 0) {
      throw new BadRequestException(
        'La materia tiene horarios activos. Edita o elimina los horarios desde el módulo de horarios.',
      );
    }

    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    return this.prisma.materia.update({
      where: { id: materiaId },
      data: { aulaId: null },
      include: { docente: { select: { id: true, nombre: true } }, aula: true },
    });
  }

  private agruparEnClases(horarios: HorarioConRelaciones[]) {
    const clases = new Map<
      string,
      {
        clave: string;
        materiaId: number;
        docenteId: number;
        grupoId: number | null;
        semestre: number | null;
        materia: HorarioConRelaciones['materia'];
        docente: HorarioConRelaciones['docente'];
        grupo: HorarioConRelaciones['grupo'];
        aulaId: number | null;
        aula: HorarioConRelaciones['aula'];
        horarioIds: number[];
        bloques: BloqueClase[];
      }
    >();

    for (const horario of this.ordenarHorarios(horarios)) {
      const clave = `${horario.materiaId}-${horario.docenteId}-${horario.grupoId ?? 'sin-grupo'}`;

      let clase = clases.get(clave);
      if (!clase) {
        clase = {
          clave,
          materiaId: horario.materiaId,
          docenteId: horario.docenteId,
          grupoId: horario.grupoId,
          semestre: horario.semestre,
          materia: horario.materia,
          docente: horario.docente,
          grupo: horario.grupo,
          aulaId: null,
          aula: null,
          horarioIds: [],
          bloques: [],
        };
        clases.set(clave, clase);
      }

      clase.horarioIds.push(horario.id);

      const dias = horario.dias
        .split(',')
        .map((dia) => dia.trim())
        .filter(Boolean);

      for (const dia of dias) {
        clase.bloques.push({
          horarioId: horario.id,
          dia,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          aulaId: horario.aulaId,
          aula: horario.aula,
        });
      }
    }

    return [...clases.values()].map((clase) => {
      const aulaIds = new Set(clase.bloques.map((bloque) => bloque.aulaId));
      const aulaComun = aulaIds.size === 1 ? clase.bloques[0] : null;

      clase.bloques.sort(
        (a, b) =>
          (ORDEN_DIAS[a.dia.toLowerCase()] ?? 99) -
          (ORDEN_DIAS[b.dia.toLowerCase()] ?? 99),
      );

      return {
        ...clase,
        aulaId: aulaComun?.aulaId ?? null,
        aula: aulaComun?.aula ?? null,
      };
    });
  }

  private async prepararHorarios(
    input: HorarioInput | ValidarConflictoHorarioDto,
  ) {
    const materia = await this.prisma.materia.findUnique({
      where: { id: input.materiaId },
      include: {
        academias: { select: { id: true, nombre: true } },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const docente = await this.prisma.usuario.findUnique({
      where: { id: input.docenteId },
      include: {
        academias: { select: { id: true, nombre: true } },
      },
    });
    if (!docente || docente.rol !== 'DOCENTE' || !docente.activo) {
      throw new NotFoundException('Docente no encontrado');
    }

    await this.validarDocenteMateria(materia.id, docente.id, materia, docente);
    const aula = await this.validarAula(input.aulaId);
    const grupo = input.grupoId ? await this.validarGrupo(input.grupoId) : null;
    await this.validarSemestreMateriaGrupo(materia, grupo);
    const bloques = this.normalizarBloques(input);

    return bloques.map((bloque) => ({
      materiaId: materia.id,
      docenteId: docente.id,
      aulaId: aula?.id ?? null,
      grupoId: grupo?.id ?? null,
      dias: bloque.dia,
      horaInicio: bloque.horaInicio,
      horaFin: bloque.horaFin,
      semestre: input.semestre ?? grupo?.semestre ?? materia.semestre ?? null,
    }));
  }

  private async validarConflictos(
    payloads: Array<{
      materiaId: number;
      docenteId: number;
      aulaId?: number | null;
      grupoId?: number | null;
      dias: string;
      horaInicio: string;
      horaFin: string;
      semestre?: number | null;
    }>,
    ignorarHorarioId?: number | number[],
  ) {
    const resultados = await Promise.all(
      payloads.map((payload) =>
        this.validarConflictoInterno(payload, ignorarHorarioId),
      ),
    );
    const conflictos: ConflictoHorario[] = resultados.flatMap(
      (resultado) => resultado.conflicts,
    );

    // La titularidad es de la clase completa, no de cada bloque: se revisa una
    // sola vez por petición y se reporta antes que los traslapes de horario.
    const titularidad = payloads[0]
      ? await this.buscarConflictoTitularidad(
          payloads[0],
          this.normalizarIgnorados(ignorarHorarioId),
        )
      : null;
    if (titularidad) conflictos.unshift(titularidad);

    return {
      ok: conflictos.length === 0,
      message: conflictos[0]?.mensaje ?? 'Sin conflictos',
      conflicts: conflictos,
    };
  }

  private async validarConflictoInterno(
    payload: {
      materiaId: number;
      docenteId: number;
      aulaId?: number | null;
      grupoId?: number | null;
      dias: string;
      horaInicio: string;
      horaFin: string;
      semestre?: number | null;
    },
    ignorarHorarioId?: number | number[],
  ) {
    const conflictos: ConflictoHorario[] = [];

    const [docenteConflictos, aulaConflictos, grupoConflictos] =
      await Promise.all([
        this.buscarConflictosPorEntidad(
          'docente',
          payload.docenteId,
          payload,
          ignorarHorarioId,
        ),
        payload.aulaId
          ? this.buscarConflictosPorEntidad(
              'aula',
              payload.aulaId,
              payload,
              ignorarHorarioId,
            )
          : Promise.resolve([]),
        payload.grupoId
          ? this.buscarConflictosPorEntidad(
              'grupo',
              payload.grupoId,
              payload,
              ignorarHorarioId,
            )
          : Promise.resolve([]),
      ]);

    conflictos.push(
      ...docenteConflictos,
      ...aulaConflictos,
      ...grupoConflictos,
    );

    return {
      ok: conflictos.length === 0,
      message: conflictos[0]?.mensaje ?? 'Sin conflictos',
      conflicts: conflictos,
    };
  }

  /**
   * Una clase se programa para el grupo que cursa ese semestre. Cuando la
   * materia no trae semestre propio se consulta la retícula, que es el dato
   * autoritativo; si tampoco está, no hay con qué comparar y se deja pasar.
   */
  private async validarSemestreMateriaGrupo(
    materia: { id: number; nombre: string; clave: string; semestre: number | null; carreraId: number | null },
    grupo: { nombre: string; semestre: number } | null,
  ) {
    if (!grupo) return;

    let semestreMateria = materia.semestre;
    if (semestreMateria == null && materia.carreraId) {
      const reticula = await this.prisma.reticulaMateria.findFirst({
        where: {
          clave: materia.clave,
          carreraId: materia.carreraId,
          activo: true,
        },
        select: { semestre: true },
      });
      semestreMateria = reticula?.semestre ?? null;
    }
    if (semestreMateria == null) return;

    if (semestreMateria !== grupo.semestre) {
      throw new BadRequestException(
        `La materia ${materia.nombre} es de ${semestreMateria}° semestre y el grupo ${grupo.nombre} es de ${grupo.semestre}°. Sólo puedes programar materias del semestre que cursa el grupo.`,
      );
    }
  }

  private normalizarIgnorados(ignorarHorarioId?: number | number[]) {
    if (ignorarHorarioId === undefined) return [];
    return Array.isArray(ignorarHorarioId)
      ? ignorarHorarioId
      : [ignorarHorarioId];
  }

  /**
   * Una materia sólo puede tener un docente por grupo. Sin grupo no hay
   * titularidad que defender, así que los bloques sueltos quedan libres.
   */
  private async buscarConflictoTitularidad(
    payload: { materiaId: number; docenteId: number; grupoId?: number | null },
    ignorados: number[] = [],
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<ConflictoHorario | null> {
    if (!payload.grupoId) return null;

    const ocupante = await client.horarioMateria.findFirst({
      where: {
        materiaId: payload.materiaId,
        grupoId: payload.grupoId,
        activo: true,
        docenteId: { not: payload.docenteId },
        ...(ignorados.length > 0 ? { id: { notIn: ignorados } } : {}),
      },
      include: HORARIO_INCLUDE,
    });
    if (!ocupante) return null;

    return {
      tipo: 'materia-grupo',
      horario: ocupante,
      mensaje: `La materia ${ocupante.materia.nombre} del grupo ${ocupante.grupo?.nombre ?? 'sin grupo'} ya la imparte ${ocupante.docente.nombre}. Una materia sólo puede tener un docente por grupo.`,
    };
  }

  /**
   * Repetición dentro de la transacción: la validación previa corre fuera y dos
   * altas simultáneas podrían pasarla las dos. El bloqueo por (materia, grupo)
   * serializa únicamente a quienes se disputan la misma clase.
   */
  private async asegurarTitularidadEnTransaccion(
    tx: Prisma.TransactionClient,
    payload: { materiaId: number; docenteId: number; grupoId?: number | null },
    ignorados: number[] = [],
  ) {
    if (!payload.grupoId) return;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`materia-grupo:${payload.materiaId}:${payload.grupoId}`}))`;
    const conflicto = await this.buscarConflictoTitularidad(
      payload,
      ignorados,
      tx,
    );
    if (conflicto) throw new ConflictException(conflicto.mensaje);
  }

  private async buscarConflictosPorEntidad(
    tipo: 'docente' | 'aula' | 'grupo',
    entidadId: number,
    payload: { dias: string; horaInicio: string; horaFin: string },
    ignorarHorarioId?: number | number[],
  ) {
    const ignorados =
      ignorarHorarioId === undefined
        ? []
        : Array.isArray(ignorarHorarioId)
          ? ignorarHorarioId
          : [ignorarHorarioId];

    const where: Prisma.HorarioMateriaWhereInput = {
      activo: true,
      ...(ignorados.length > 0 ? { id: { notIn: ignorados } } : {}),
      ...(tipo === 'docente'
        ? { docenteId: entidadId }
        : tipo === 'aula'
          ? { aulaId: entidadId }
          : { grupoId: entidadId }),
    };

    const existentes = await this.prisma.horarioMateria.findMany({
      where,
      include: HORARIO_INCLUDE,
    });

    return existentes
      .filter((horario) => hayConflictoHorario(payload, horario))
      .map((horario) => ({
        tipo,
        horario,
        mensaje: this.construirMensajeConflicto(tipo, horario),
      }));
  }

  private construirMensajeConflicto(
    tipo: 'docente' | 'aula' | 'grupo',
    horario: any,
  ) {
    if (tipo === 'docente') {
      return `El docente ${horario.docente.nombre} ya tiene asignada la materia ${horario.materia.nombre} en ${horario.dias} de ${horario.horaInicio} a ${horario.horaFin}.`;
    }
    if (tipo === 'aula') {
      return `El aula ${horario.aula?.nombre ?? 'sin asignar'} ya está ocupada por la materia ${horario.materia.nombre} en ${horario.dias} de ${horario.horaInicio} a ${horario.horaFin}.`;
    }
    return `El grupo ${horario.grupo.nombre} ya tiene asignada la materia ${horario.materia.nombre} en ${horario.dias} de ${horario.horaInicio} a ${horario.horaFin}.`;
  }

  private async validarDocenteMateria(
    materiaId: number,
    docenteId: number,
    materiaArg?: any,
    docenteArg?: any,
  ) {
    const materia =
      materiaArg ??
      (await this.prisma.materia.findUnique({
        where: { id: materiaId },
        include: { academias: { select: { id: true, nombre: true } } },
      }));
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const docente =
      docenteArg ??
      (await this.prisma.usuario.findUnique({
        where: { id: docenteId },
        include: { academias: { select: { id: true, nombre: true } } },
      }));
    if (!docente || docente.rol !== 'DOCENTE') {
      throw new BadRequestException(
        'El usuario no existe o no tiene rol DOCENTE',
      );
    }

    if (docente.academias.length === 0) {
      throw new BadRequestException(
        'El docente no está asignado a ninguna academia. Asígnelo a una academia antes de asignar horarios.',
      );
    }

    if (materia.academias.length > 0) {
      const idsDocente = docente.academias.map((academia) => academia.id);
      const idsMateria = materia.academias.map((academia) => academia.id);
      const compartidas = idsDocente.filter((id) => idsMateria.includes(id));
      if (compartidas.length === 0) {
        const nombresDocente = docente.academias
          .map((academia) => academia.nombre)
          .join(', ');
        const nombresMateria = materia.academias
          .map((academia) => academia.nombre)
          .join(', ');
        throw new ConflictException(
          `El docente no pertenece a ninguna academia de esta materia. Academias del docente: [${nombresDocente}]. Academias de la materia: [${nombresMateria}].`,
        );
      }
    }

    return docente;
  }

  private async validarAula(aulaId?: number | null) {
    if (!aulaId) return null;
    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula || !aula.activo)
      throw new NotFoundException('Aula no encontrada o inactiva');
    return aula;
  }

  private async validarGrupo(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo || !grupo.activo)
      throw new NotFoundException('Grupo no encontrado');
    return grupo;
  }

  private validarHoras(horaInicio: string, horaFin: string) {
    if (horaInicio >= horaFin) {
      throw new BadRequestException(
        'La hora de inicio debe ser menor que la hora de fin',
      );
    }
  }

  private normalizarBloques(
    input: Pick<HorarioInput, 'dias' | 'horaInicio' | 'horaFin' | 'bloques'>,
  ) {
    const bloquesBase =
      Array.isArray(input.bloques) && input.bloques.length > 0
        ? input.bloques
        : (() => {
            if (!input.dias || !input.horaInicio || !input.horaFin) {
              throw new BadRequestException(
                'Debes enviar al menos un bloque por día o un conjunto de días con hora de inicio y fin.',
              );
            }

            return this.normalizarDias(input.dias)
              .split(',')
              .map((dia) => ({
                dia,
                horaInicio: input.horaInicio as string,
                horaFin: input.horaFin as string,
              }));
          })();

    const dias = new Set<string>();
    const normalizados = bloquesBase.map((bloque) => {
      const dia = this.normalizarDia(bloque.dia);
      if (dias.has(dia)) {
        throw new BadRequestException(
          `El día ${dia} está repetido en el horario.`,
        );
      }
      dias.add(dia);
      this.validarHoras(bloque.horaInicio, bloque.horaFin);
      return {
        dia,
        horaInicio: bloque.horaInicio,
        horaFin: bloque.horaFin,
      };
    });

    normalizados.sort((a, b) => {
      const ordenA = ORDEN_DIAS[a.dia.toLowerCase()] ?? 99;
      const ordenB = ORDEN_DIAS[b.dia.toLowerCase()] ?? 99;
      return ordenA - ordenB;
    });

    return normalizados;
  }

  private normalizarDia(dia: string) {
    const clave = dia.trim().toLowerCase();
    const canonico = DIA_CANONICO[clave];
    if (!canonico) {
      throw new BadRequestException(`Día inválido: ${dia}`);
    }
    return canonico;
  }

  private normalizarDias(dias: string[] | string) {
    const lista = Array.isArray(dias)
      ? dias
      : dias
          .split(',')
          .map((dia) => dia.trim())
          .filter(Boolean);

    if (lista.length === 0) {
      throw new BadRequestException('Debes seleccionar al menos un día');
    }

    const normalizados = Array.from(
      new Set(lista.map((dia) => this.normalizarDia(dia))),
    );

    normalizados.sort((a, b) => {
      const ordenA = ORDEN_DIAS[a.toLowerCase()] ?? 99;
      const ordenB = ORDEN_DIAS[b.toLowerCase()] ?? 99;
      return ordenA - ordenB;
    });

    return normalizados.join(',');
  }

  private ordenarHorarios<T extends { dias: string; horaInicio: string }>(
    horarios: T[],
  ) {
    return [...horarios].sort((a, b) => {
      const primerDiaA =
        ORDEN_DIAS[a.dias.split(',')[0].trim().toLowerCase()] ?? 99;
      const primerDiaB =
        ORDEN_DIAS[b.dias.split(',')[0].trim().toLowerCase()] ?? 99;
      if (primerDiaA !== primerDiaB) return primerDiaA - primerDiaB;
      return a.horaInicio.localeCompare(b.horaInicio);
    });
  }

  private async sincronizarMateriaLegacy(tx: Tx, materiaId: number) {
    const horarios = await tx.horarioMateria.findMany({
      where: { materiaId, activo: true },
      select: {
        id: true,
        dias: true,
        horaInicio: true,
        horaFin: true,
        docenteId: true,
        aulaId: true,
      },
    });

    if (horarios.length === 0) {
      await tx.materia.update({
        where: { id: materiaId },
        data: {
          dias: '',
          horaInicio: '',
          horaFin: '',
          docenteId: null,
          aulaId: null,
        },
      });
      return;
    }

    const principal = this.ordenarHorarios(horarios)[0];
    await tx.materia.update({
      where: { id: materiaId },
      data: {
        dias: principal.dias,
        horaInicio: principal.horaInicio,
        horaFin: principal.horaFin,
        docenteId: principal.docenteId,
        aulaId: principal.aulaId,
      },
    });
  }

  private async sincronizarMateriaGrupos(tx: Tx, materiaId: number) {
    const [materia, horariosActivos] = await Promise.all([
      tx.materia.findUnique({
        where: { id: materiaId },
        select: {
          id: true,
          grupos: { select: { id: true } },
        },
      }),
      tx.horarioMateria.findMany({
        where: {
          materiaId,
          activo: true,
          grupoId: { not: null },
        },
        select: { grupoId: true },
      }),
    ]);

    if (!materia) throw new NotFoundException('Materia no encontrada');

    const gruposObjetivo = Array.from(
      new Set(
        horariosActivos
          .map((horario) => horario.grupoId)
          .filter((grupoId): grupoId is number => grupoId !== null),
      ),
    );
    const gruposActuales = materia.grupos.map((grupo) => grupo.id);
    const conectar = gruposObjetivo.filter(
      (grupoId) => !gruposActuales.includes(grupoId),
    );
    const desconectar = gruposActuales.filter(
      (grupoId) => !gruposObjetivo.includes(grupoId),
    );

    if (conectar.length === 0 && desconectar.length === 0) return;

    await tx.materia.update({
      where: { id: materiaId },
      data: {
        grupos: {
          ...(conectar.length > 0
            ? { connect: conectar.map((id) => ({ id })) }
            : {}),
          ...(desconectar.length > 0
            ? { disconnect: desconectar.map((id) => ({ id })) }
            : {}),
        },
      },
    });
  }
}
