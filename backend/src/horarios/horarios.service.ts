import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
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

type HorarioInput = {
  materiaId: number;
  docenteId: number;
  aulaId: number;
  grupoId?: number | null;
  dias: string[];
  horaInicio: string;
  horaFin: string;
  semestre?: number | null;
};

type ConflictoHorario = {
  tipo: 'docente' | 'aula' | 'grupo';
  mensaje: string;
  horario: any;
};

@Injectable()
export class HorariosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateHorarioDto) {
    const payload = await this.prepararHorario(dto);
    const validacion = await this.validarConflictoInterno(payload);
    if (!validacion.ok) throw new ConflictException(validacion.message);

    const creado = await this.prisma.$transaction(async (tx) => {
      const horario = await tx.horarioMateria.create({
        data: {
          materiaId: payload.materiaId,
          docenteId: payload.docenteId,
          aulaId: payload.aulaId,
          grupoId: payload.grupoId ?? null,
          dias: payload.dias,
          horaInicio: payload.horaInicio,
          horaFin: payload.horaFin,
          semestre: payload.semestre ?? null,
        },
        include: HORARIO_INCLUDE,
      });

      await this.sincronizarMateriaGrupos(tx, payload.materiaId);
      await this.sincronizarMateriaLegacy(tx, payload.materiaId);
      return horario;
    });

    return creado;
  }

  async findAll(filters: {
    materiaId?: number;
    docenteId?: number;
    aulaId?: number;
    grupoId?: number;
    activo?: boolean;
  } = {}) {
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

  async update(id: number, dto: UpdateHorarioDto) {
    const actual = await this.prisma.horarioMateria.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Horario no encontrado');

    const payload = await this.prepararHorario({
      materiaId: dto.materiaId ?? actual.materiaId,
      docenteId: dto.docenteId ?? actual.docenteId,
      aulaId: dto.aulaId ?? actual.aulaId,
      grupoId: dto.grupoId === undefined ? actual.grupoId : dto.grupoId,
      dias: dto.dias ?? actual.dias.split(',').map((dia) => dia.trim()),
      horaInicio: dto.horaInicio ?? actual.horaInicio,
      horaFin: dto.horaFin ?? actual.horaFin,
      semestre: dto.semestre ?? actual.semestre ?? undefined,
    });

    const validacion = await this.validarConflictoInterno(payload, id);
    if (!validacion.ok) throw new ConflictException(validacion.message);

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const horario = await tx.horarioMateria.update({
        where: { id },
        data: {
          materiaId: payload.materiaId,
          docenteId: payload.docenteId,
          aulaId: payload.aulaId,
          grupoId: payload.grupoId ?? null,
          dias: payload.dias,
          horaInicio: payload.horaInicio,
          horaFin: payload.horaFin,
          semestre: payload.semestre ?? null,
        },
        include: HORARIO_INCLUDE,
      });

      await this.sincronizarMateriaGrupos(tx, actual.materiaId);
      await this.sincronizarMateriaLegacy(tx, actual.materiaId);
      if (payload.materiaId !== actual.materiaId) {
        await this.sincronizarMateriaGrupos(tx, payload.materiaId);
        await this.sincronizarMateriaLegacy(tx, payload.materiaId);
      }

      return horario;
    });

    return actualizado;
  }

  async remove(id: number) {
    const horario = await this.prisma.horarioMateria.findUnique({ where: { id } });
    if (!horario) throw new NotFoundException('Horario no encontrado');

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

  async validarConflicto(dto: ValidarConflictoHorarioDto) {
    const payload = await this.prepararHorario(dto);
    return this.validarConflictoInterno(payload, dto.horarioId);
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
    return { docente, horarios };
  }

  async obtenerHorarioAula(aulaId: number) {
    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula) throw new NotFoundException('Aula no encontrada');

    const horarios = await this.findAll({ aulaId });
    return { aula, horarios };
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
    return { grupo, horarios };
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
      const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
      if (!materia) throw new NotFoundException('Materia no encontrada');

      await this.validarDocenteMateria(materiaId, docenteId);
      return this.prisma.materia.update({
        where: { id: materiaId },
        data: { docenteId },
        include: { docente: { select: { id: true, nombre: true, email: true } }, aula: true },
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

    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
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
      const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
      if (!materia) throw new NotFoundException('Materia no encontrada');

      await this.validarAula(aulaId);
      return this.prisma.materia.update({
        where: { id: materiaId },
        data: { aulaId },
        include: { docente: { select: { id: true, nombre: true } }, aula: true },
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

  async quitarAula(materiaId: number) {
    const horariosActivos = await this.prisma.horarioMateria.count({
      where: { materiaId, activo: true },
    });
    if (horariosActivos > 0) {
      throw new BadRequestException(
        'La materia tiene horarios activos. Edita o elimina los horarios desde el módulo de horarios.',
      );
    }

    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    return this.prisma.materia.update({
      where: { id: materiaId },
      data: { aulaId: null },
      include: { docente: { select: { id: true, nombre: true } }, aula: true },
    });
  }

  private async prepararHorario(input: HorarioInput | ValidarConflictoHorarioDto) {
    this.validarHoras(input.horaInicio, input.horaFin);

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

    return {
      materiaId: materia.id,
      docenteId: docente.id,
      aulaId: aula.id,
      grupoId: grupo?.id ?? null,
      dias: this.normalizarDias(input.dias),
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      semestre: input.semestre ?? grupo?.semestre ?? materia.semestre ?? null,
    };
  }

  private async validarConflictoInterno(
    payload: {
      materiaId: number;
      docenteId: number;
      aulaId: number;
      grupoId?: number | null;
      dias: string;
      horaInicio: string;
      horaFin: string;
      semestre?: number | null;
    },
    ignorarHorarioId?: number,
  ) {
    const conflictos: ConflictoHorario[] = [];

    const [docenteConflictos, aulaConflictos, grupoConflictos] = await Promise.all([
      this.buscarConflictosPorEntidad('docente', payload.docenteId, payload, ignorarHorarioId),
      this.buscarConflictosPorEntidad('aula', payload.aulaId, payload, ignorarHorarioId),
      payload.grupoId
        ? this.buscarConflictosPorEntidad('grupo', payload.grupoId, payload, ignorarHorarioId)
        : Promise.resolve([]),
    ]);

    conflictos.push(...docenteConflictos, ...aulaConflictos, ...grupoConflictos);

    return {
      ok: conflictos.length === 0,
      message: conflictos[0]?.mensaje ?? 'Sin conflictos',
      conflicts: conflictos,
    };
  }

  private async buscarConflictosPorEntidad(
    tipo: 'docente' | 'aula' | 'grupo',
    entidadId: number,
    payload: { dias: string; horaInicio: string; horaFin: string },
    ignorarHorarioId?: number,
  ) {
    const where: Prisma.HorarioMateriaWhereInput = {
      activo: true,
      ...(ignorarHorarioId ? { id: { not: ignorarHorarioId } } : {}),
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

  private construirMensajeConflicto(tipo: 'docente' | 'aula' | 'grupo', horario: any) {
    if (tipo === 'docente') {
      return `El docente ${horario.docente.nombre} ya tiene asignada la materia ${horario.materia.nombre} en ${horario.dias} de ${horario.horaInicio} a ${horario.horaFin}.`;
    }
    if (tipo === 'aula') {
      return `El aula ${horario.aula.nombre} ya está ocupada por la materia ${horario.materia.nombre} en ${horario.dias} de ${horario.horaInicio} a ${horario.horaFin}.`;
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
      throw new BadRequestException('El usuario no existe o no tiene rol DOCENTE');
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
        const nombresDocente = docente.academias.map((academia) => academia.nombre).join(', ');
        const nombresMateria = materia.academias.map((academia) => academia.nombre).join(', ');
        throw new ConflictException(
          `El docente no pertenece a ninguna academia de esta materia. Academias del docente: [${nombresDocente}]. Academias de la materia: [${nombresMateria}].`,
        );
      }
    }

    return docente;
  }

  private async validarAula(aulaId: number) {
    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula || !aula.activo) throw new NotFoundException('Aula no encontrada o inactiva');
    return aula;
  }

  private async validarGrupo(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo || !grupo.activo) throw new NotFoundException('Grupo no encontrado');
    return grupo;
  }

  private validarHoras(horaInicio: string, horaFin: string) {
    if (horaInicio >= horaFin) {
      throw new BadRequestException('La hora de inicio debe ser menor que la hora de fin');
    }
  }

  private normalizarDias(dias: string[] | string) {
    const lista = Array.isArray(dias)
      ? dias
      : dias.split(',').map((dia) => dia.trim()).filter(Boolean);

    if (lista.length === 0) {
      throw new BadRequestException('Debes seleccionar al menos un día');
    }

    const normalizados = Array.from(
      new Set(
        lista.map((dia) => {
          const clave = dia.trim().toLowerCase();
          const canonico = DIA_CANONICO[clave];
          if (!canonico) {
            throw new BadRequestException(`Día inválido: ${dia}`);
          }
          return canonico;
        }),
      ),
    );

    normalizados.sort((a, b) => {
      const ordenA = ORDEN_DIAS[a.toLowerCase()] ?? 99;
      const ordenB = ORDEN_DIAS[b.toLowerCase()] ?? 99;
      return ordenA - ordenB;
    });

    return normalizados.join(',');
  }

  private ordenarHorarios<T extends { dias: string; horaInicio: string }>(horarios: T[]) {
    return [...horarios].sort((a, b) => {
      const primerDiaA = ORDEN_DIAS[a.dias.split(',')[0].trim().toLowerCase()] ?? 99;
      const primerDiaB = ORDEN_DIAS[b.dias.split(',')[0].trim().toLowerCase()] ?? 99;
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
      new Set(horariosActivos.map((horario) => horario.grupoId).filter((grupoId): grupoId is number => grupoId !== null)),
    );
    const gruposActuales = materia.grupos.map((grupo) => grupo.id);
    const conectar = gruposObjetivo.filter((grupoId) => !gruposActuales.includes(grupoId));
    const desconectar = gruposActuales.filter((grupoId) => !gruposObjetivo.includes(grupoId));

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
