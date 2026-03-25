import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { hayConflictoHorario } from '../horarios/utils/conflicto-horario.util';

const INCLUDE_LIST = {
  carrera: { select: { id: true, nombre: true, codigo: true } },
  _count: { select: { alumnos: true, materias: true } },
};

const INCLUDE_DETAIL = {
  carrera: { select: { id: true, nombre: true, codigo: true } },
  alumnos: {
    select: { id: true, nombre: true, numeroControl: true, email: true },
    where: { activo: true },
  },
  materias: {
    select: {
      id: true,
      nombre: true,
      clave: true,
      dias: true,
      horaInicio: true,
      horaFin: true,
      semestre: true,
      docente: { select: { id: true, nombre: true } },
      aula: { select: { id: true, nombre: true } },
    },
  },
};

@Injectable()
export class GruposService {
  constructor(private prisma: PrismaService) {}

  // ─── Crear grupo ────────────────────────────────────────────────────────────

  async crearGrupo(dto: CreateGrupoDto) {
    const carrera = await this.prisma.carrera.findUnique({
      where: { id: dto.carreraId },
    });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    const nombre = `${dto.semestre}${carrera.codigo}${dto.seccion}`;

    const existe = await this.prisma.grupo.findFirst({
      where: { nombre, periodo: dto.periodo },
    });
    if (existe)
      throw new ConflictException(
        `Ya existe el grupo "${nombre}" en el periodo ${dto.periodo}`,
      );

    // Obtener materias del catálogo de retícula para este semestre/carrera
    const reticulaMaterias = await this.prisma.reticulaMateria.findMany({
      where: { semestre: dto.semestre, carreraId: dto.carreraId, activo: true },
    });

    // Auto-crear Materia records que aún no existan (sin horario ni docente asignados)
    for (const rm of reticulaMaterias) {
      const existente = await this.prisma.materia.findUnique({
        where: { clave: rm.clave },
      });
      if (!existente) {
        const nueva = await this.prisma.materia.create({
          data: {
            nombre: rm.nombre,
            clave: rm.clave,
            semestre: rm.semestre,
            carreraId: dto.carreraId,
            horaInicio: '00:00',
            horaFin: '00:00',
            dias: '',
            numUnidades: 3,
          },
        });
        for (let i = 1; i <= 3; i++) {
          await this.prisma.unidad.create({
            data: { nombre: `Unidad ${i}`, orden: i, materiaId: nueva.id },
          });
        }
      }
    }

    const claves = reticulaMaterias.map((r) => r.clave);
    const secciones = await this.prisma.materia.findMany({
      where: { clave: { in: claves } },
    });

    return this.prisma.grupo.create({
      data: {
        nombre,
        semestre: dto.semestre,
        seccion: dto.seccion,
        carreraId: dto.carreraId,
        periodo: dto.periodo,
        materias: {
          connect: secciones.map((m) => ({ id: m.id })),
        },
      },
      include: INCLUDE_DETAIL,
    });
  }

  // ─── Listar grupos ──────────────────────────────────────────────────────────

  listarGrupos(filtros: {
    carreraId?: number;
    semestre?: number;
    periodo?: string;
  }) {
    return this.prisma.grupo.findMany({
      where: {
        activo: true,
        ...(filtros.carreraId && { carreraId: filtros.carreraId }),
        ...(filtros.semestre && { semestre: filtros.semestre }),
        ...(filtros.periodo && { periodo: filtros.periodo }),
      },
      include: INCLUDE_LIST,
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  // ─── Detalle de grupo ───────────────────────────────────────────────────────

  async obtenerGrupo(id: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id },
      include: INCLUDE_DETAIL,
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo;
  }

  // ─── Editar grupo ───────────────────────────────────────────────────────────

  async editarGrupo(id: number, dto: UpdateGrupoDto) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id },
      include: { carrera: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const nuevoNombre = dto.seccion
      ? `${grupo.semestre}${grupo.carrera.codigo}${dto.seccion}`
      : grupo.nombre;

    const nuevoPeriodo = dto.periodo ?? grupo.periodo;

    if (nuevoNombre !== grupo.nombre || nuevoPeriodo !== grupo.periodo) {
      const existe = await this.prisma.grupo.findFirst({
        where: { nombre: nuevoNombre, periodo: nuevoPeriodo, id: { not: id } },
      });
      if (existe) {
        throw new ConflictException(
          `Ya existe el grupo "${nuevoNombre}" en el periodo ${nuevoPeriodo}`,
        );
      }
    }

    return this.prisma.grupo.update({
      where: { id },
      data: {
        ...(dto.seccion && { seccion: dto.seccion, nombre: nuevoNombre }),
        ...(dto.periodo && { periodo: dto.periodo }),
      },
      include: INCLUDE_DETAIL,
    });
  }

  // ─── Eliminar grupo (soft delete) ──────────────────────────────────────────

  async eliminarGrupo(id: number) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return this.prisma.grupo.update({ where: { id }, data: { activo: false } });
  }

  // ─── Asignar alumnos ────────────────────────────────────────────────────────

  async asignarAlumnos(grupoId: number, alumnoIds: number[]) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const alumnos = await this.prisma.usuario.findMany({
      where: { id: { in: alumnoIds } },
    });

    const noAlumnos = alumnos.filter((a) => a.rol !== 'ALUMNO');
    if (noAlumnos.length > 0) {
      throw new BadRequestException(
        `Los siguientes usuarios no tienen rol ALUMNO: ${noAlumnos.map((a) => a.nombre).join(', ')}`,
      );
    }

    const deOtraCarrera = alumnos.filter(
      (a) => a.carreraId !== grupo.carreraId,
    );
    if (deOtraCarrera.length > 0) {
      throw new BadRequestException(
        `Los siguientes alumnos no pertenecen a la carrera del grupo: ${deOtraCarrera.map((a) => a.nombre).join(', ')}`,
      );
    }

    const yaEnOtroGrupo = alumnos.filter(
      (a) => a.grupoId !== null && a.grupoId !== grupoId,
    );
    if (yaEnOtroGrupo.length > 0) {
      throw new ConflictException(
        `Los siguientes alumnos ya están en otro grupo: ${yaEnOtroGrupo.map((a) => a.nombre).join(', ')}`,
      );
    }

    await this.prisma.usuario.updateMany({
      where: { id: { in: alumnoIds } },
      data: { grupoId },
    });

    return this.obtenerGrupo(grupoId);
  }

  // ─── Quitar alumno ──────────────────────────────────────────────────────────

  async quitarAlumno(grupoId: number, alumnoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
    });
    if (!alumno || alumno.grupoId !== grupoId) {
      throw new NotFoundException('El alumno no pertenece a este grupo');
    }

    await this.prisma.usuario.update({
      where: { id: alumnoId },
      data: { grupoId: null },
    });
    return this.obtenerGrupo(grupoId);
  }

  // ─── Listar alumnos del grupo ───────────────────────────────────────────────

  async getAlumnos(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        alumnos: {
          select: { id: true, nombre: true, numeroControl: true, email: true },
          where: { activo: true },
        },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo.alumnos;
  }

  // ─── Agregar materias ───────────────────────────────────────────────────────

  async agregarMaterias(grupoId: number, materiaIds: number[]) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { materias: true },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const materias = await this.prisma.materia.findMany({
      where: { id: { in: materiaIds } },
    });
    if (materias.length !== materiaIds.length) {
      throw new BadRequestException('Una o más materias no fueron encontradas');
    }

    // Validar conflictos de horario con las materias ya asignadas al grupo
    for (const nueva of materias) {
      for (const existente of grupo.materias) {
        if (
          nueva.id !== existente.id &&
          hayConflictoHorario(nueva, existente)
        ) {
          throw new ConflictException(
            `Conflicto de horario: "${nueva.nombre}" (${nueva.dias} ${nueva.horaInicio}-${nueva.horaFin}) ` +
              `choca con "${existente.nombre}" (${existente.dias} ${existente.horaInicio}-${existente.horaFin})`,
          );
        }
      }
    }

    return this.prisma.grupo.update({
      where: { id: grupoId },
      data: { materias: { connect: materiaIds.map((id) => ({ id })) } },
      include: INCLUDE_DETAIL,
    });
  }

  // ─── Quitar materia ─────────────────────────────────────────────────────────

  async quitarMateria(grupoId: number, materiaId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { materias: { where: { id: materiaId }, select: { id: true } } },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (grupo.materias.length === 0) {
      throw new NotFoundException('La materia no pertenece a este grupo');
    }

    return this.prisma.grupo.update({
      where: { id: grupoId },
      data: { materias: { disconnect: { id: materiaId } } },
      include: INCLUDE_DETAIL,
    });
  }

  // ─── Listar materias del grupo ──────────────────────────────────────────────

  async getMaterias(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        materias: {
          select: {
            id: true,
            nombre: true,
            clave: true,
            dias: true,
            horaInicio: true,
            horaFin: true,
            semestre: true,
            docente: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true } },
          },
        },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo.materias;
  }

  // ─── Horario del grupo ──────────────────────────────────────────────────────

  async obtenerHorario(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        carrera: { select: { id: true, nombre: true } },
        materias: {
          include: {
            docente: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true } },
          },
          orderBy: { horaInicio: 'asc' },
        },
      },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    return grupo;
  }

  // ─── Estado de la retícula para un grupo ───────────────────────────────────
  // Devuelve las materias de la retícula del semestre/carrera del grupo,
  // cada una con estado: ASIGNADA | DISPONIBLE | FALTANTE

  async getReticulaStatus(grupoId: number) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { materias: { select: { id: true, clave: true } } },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const reticulaMaterias = await this.prisma.reticulaMateria.findMany({
      where: {
        semestre: grupo.semestre,
        carreraId: grupo.carreraId,
        activo: true,
      },
      orderBy: { nombre: 'asc' },
    });

    const clavesEnGrupo = new Set(grupo.materias.map((m) => m.clave));
    const idsEnGrupo = new Set(grupo.materias.map((m) => m.id));

    const result = await Promise.all(
      reticulaMaterias.map(async (rm) => {
        const materia = await this.prisma.materia.findUnique({
          where: { clave: rm.clave },
          select: {
            id: true,
            nombre: true,
            clave: true,
            horaInicio: true,
            horaFin: true,
            dias: true,
            docenteId: true,
          },
        });
        let estado: 'ASIGNADA' | 'DISPONIBLE' | 'FALTANTE' = 'FALTANTE';
        if (materia) {
          estado = idsEnGrupo.has(materia.id) ? 'ASIGNADA' : 'DISPONIBLE';
        }
        return {
          reticulaId: rm.id,
          clave: rm.clave,
          nombre: rm.nombre,
          semestre: rm.semestre,
          horasTeoria: rm.horasTeoria,
          horasPractica: rm.horasPractica,
          creditos: rm.creditos,
          estado,
          materiaId: materia?.id ?? null,
        };
      }),
    );

    return result;
  }

  // ─── Validar conflicto de grupo (usado por módulo de horarios) ──────────────

  async validarConflictoGrupo(materiaId: number): Promise<void> {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      include: {
        grupos: {
          include: {
            materias: { where: { id: { not: materiaId } } },
          },
        },
      },
    });
    if (!materia) return;

    for (const grupo of materia.grupos) {
      for (const otraMateria of grupo.materias) {
        if (hayConflictoHorario(materia, otraMateria)) {
          throw new ConflictException(
            `Conflicto de grupo: el grupo "${grupo.nombre}" ya tiene "${otraMateria.nombre}" ` +
              `(${otraMateria.dias} ${otraMateria.horaInicio}-${otraMateria.horaFin})`,
          );
        }
      }
    }
  }
}
