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
import { HorariosService } from '../horarios/horarios.service';
import { unidadesIniciales } from '../common/unidades.util';

const SECCIONES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** El nombre del grupo lo escribe el administrador: se guarda normalizado. */
function normalizarNombreGrupo(nombre: string) {
  return nombre.trim().replace(/\s+/g, ' ').toUpperCase();
}

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
  constructor(
    private prisma: PrismaService,
    private horarios: HorariosService,
  ) {}

  // ─── Crear grupo ────────────────────────────────────────────────────────────

  async crearGrupo(dto: CreateGrupoDto) {
    const carrera = await this.prisma.carrera.findUnique({
      where: { id: dto.carreraId },
    });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    const nombre = normalizarNombreGrupo(dto.nombre);

    const existe = await this.prisma.grupo.findFirst({
      where: { nombre, periodo: dto.periodo },
    });
    if (existe)
      throw new ConflictException(
        `Ya existe el grupo "${nombre}" en el periodo ${dto.periodo}`,
      );

    const seccion = await this.resolverSeccion(nombre, dto, carrera.nombre);

    // Obtener materias del catálogo de retícula para este semestre/carrera
    const reticulaMaterias = await this.prisma.reticulaMateria.findMany({
      where: { semestre: dto.semestre, carreraId: dto.carreraId, activo: true },
    });

    // Auto-crear Materia records que aún no existan (sin horario ni docente asignados)
    for (const rm of reticulaMaterias) {
      const existente = await this.prisma.materia.findFirst({
        where: { clave: rm.clave, carreraId: dto.carreraId },
      });
      if (!existente) {
        await this.prisma.materia.create({
          data: {
            nombre: rm.nombre,
            clave: rm.clave,
            semestre: rm.semestre,
            carreraId: dto.carreraId,
            horaInicio: '00:00',
            horaFin: '00:00',
            dias: '',
            numUnidades: 3,
            unidades: { create: unidadesIniciales(3) },
          },
        });
      }
    }

    const claves = reticulaMaterias.map((r) => r.clave);
    const secciones = await this.prisma.materia.findMany({
      where: { clave: { in: claves }, carreraId: dto.carreraId },
    });

    return this.prisma.grupo.create({
      data: {
        nombre,
        semestre: dto.semestre,
        seccion,
        carreraId: dto.carreraId,
        periodo: dto.periodo,
        materias: {
          connect: secciones.map((m) => ({ id: m.id })),
        },
      },
      include: INCLUDE_DETAIL,
    });
  }

  /**
   * La sección ya no se captura: se toma de la última letra del nombre
   * (103A → A) y, si esa letra está ocupada o el nombre no termina en letra,
   * se asigna la primera libre de ese semestre, carrera y periodo. Sigue
   * sirviendo para emparejar al alumno que sube su horario.
   */
  private async resolverSeccion(
    nombre: string,
    dto: CreateGrupoDto,
    carreraNombre: string,
  ) {
    const clave = {
      semestre: dto.semestre,
      carreraId: dto.carreraId,
      periodo: dto.periodo,
    };

    if (dto.seccion) {
      await this.ensureSeccionLibre(
        { ...clave, seccion: dto.seccion },
        carreraNombre,
      );
      return dto.seccion;
    }

    const ocupadas = await this.prisma.grupo.findMany({
      where: clave,
      select: { seccion: true },
    });
    const tomadas = new Set(ocupadas.map((grupo) => grupo.seccion));

    // Sólo se interpreta como sección la letra final que sigue a un número,
    // como en 103A; en un nombre como "GRUPO NUEVO" la última letra no lo es.
    const sufijo = /[0-9]([A-Z])$/.exec(nombre)?.[1];
    if (sufijo && !tomadas.has(sufijo)) return sufijo;

    const libre = SECCIONES.find((letra) => !tomadas.has(letra));
    if (!libre) {
      throw new ConflictException(
        `El semestre ${dto.semestre} de ${carreraNombre} ya tiene 26 grupos en el periodo ${dto.periodo}`,
      );
    }
    return libre;
  }

  /**
   * La base sólo admite una sección por semestre, carrera y periodo, aunque el
   * nombre del grupo ahora sea libre.
   */
  private async ensureSeccionLibre(
    clave: {
      semestre: number;
      seccion: string;
      carreraId: number;
      periodo: string;
    },
    carreraNombre: string,
    excluirGrupoId?: number,
  ) {
    const ocupada = await this.prisma.grupo.findFirst({
      where: {
        ...clave,
        ...(excluirGrupoId ? { id: { not: excluirGrupoId } } : {}),
      },
      select: { nombre: true },
    });
    if (ocupada) {
      throw new ConflictException(
        `La sección ${clave.seccion} del semestre ${clave.semestre} de ${carreraNombre} ya la ocupa el grupo "${ocupada.nombre}" en el periodo ${clave.periodo}`,
      );
    }
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

  /**
   * Sólo lo necesario para elegir grupo al programar una clase: sin alumnos ni
   * materias, de modo que el docente no vea más de lo que necesita.
   */
  listarCatalogo(filtros: {
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
      select: {
        id: true,
        nombre: true,
        semestre: true,
        seccion: true,
        periodo: true,
        carreraId: true,
        carrera: { select: { id: true, nombre: true, codigo: true } },
      },
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

    const nuevoNombre = dto.nombre
      ? normalizarNombreGrupo(dto.nombre)
      : grupo.nombre;
    const nuevaSeccion = dto.seccion ?? grupo.seccion;
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

    if (nuevaSeccion !== grupo.seccion || nuevoPeriodo !== grupo.periodo) {
      await this.ensureSeccionLibre(
        {
          semestre: grupo.semestre,
          seccion: nuevaSeccion,
          carreraId: grupo.carreraId,
          periodo: nuevoPeriodo,
        },
        grupo.carrera.nombre,
        id,
      );
    }

    return this.prisma.grupo.update({
      where: { id },
      data: {
        ...(dto.nombre && { nombre: nuevoNombre }),
        ...(dto.seccion && { seccion: dto.seccion }),
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

  // ─── Eliminar grupo (definitivo) ───────────────────────────────────────────

  /**
   * Borra el grupo y sus bloques de horario, que sólo existen para él. Los
   * alumnos quedan sin grupo y el historial académico se conserva a nivel de
   * materia: sesiones de clase, tareas, calificaciones e importaciones sólo
   * pierden la referencia al grupo.
   */
  async eliminarGrupoDefinitivo(id: number) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const alumnos = await tx.usuario.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const horarios = await tx.horarioMateria.deleteMany({
        where: { grupoId: id },
      });
      const sesiones = await tx.claseSesion.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const tareas = await tx.tarea.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const calificaciones = await tx.calificacionUnidad.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const importaciones = await tx.importacionHorario.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });
      const eliminado = await tx.grupo.delete({ where: { id } });

      return {
        ...eliminado,
        horariosEliminados: horarios.count,
        liberados: {
          alumnos: alumnos.count,
          sesiones: sesiones.count,
          tareas: tareas.count,
          calificaciones: calificaciones.count,
          importaciones: importaciones.count,
        },
      };
    });
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

    // El grupo cursa un semestre concreto. Sólo se revisan las materias que
    // llegan en esta petición: las ya asignadas se conservan como estén.
    const deOtroSemestre = materias.filter(
      (materia) =>
        materia.semestre != null && materia.semestre !== grupo.semestre,
    );
    if (deOtroSemestre.length) {
      throw new BadRequestException(
        `El grupo ${grupo.nombre} es de ${grupo.semestre}° semestre y estas materias no lo son: ${deOtroSemestre
          .map((materia) => `${materia.nombre} (${materia.semestre}°)`)
          .join(', ')}.`,
      );
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

  async asignarAula(
    grupoId: number,
    aulaId: number | null,
    horarioId?: number,
  ) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    return this.horarios.asignarAulaGrupo(grupoId, aulaId, horarioId);
  }

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
        const materia = await this.prisma.materia.findFirst({
          where: { clave: rm.clave, carreraId: grupo.carreraId },
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
