import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
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

@Injectable()
export class HorariosService {
  constructor(private prisma: PrismaService) {}

  // ─── Asignar docente ────────────────────────────────────────────────────────

  async asignarDocente(materiaId: number, docenteId: number) {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      include: { academias: { select: { id: true, nombre: true } } },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const docente = await this.prisma.usuario.findUnique({
      where: { id: docenteId },
      include: { academias: { select: { id: true, nombre: true } } },
    });
    if (!docente || docente.rol !== 'DOCENTE') {
      throw new BadRequestException('El usuario no existe o no tiene rol DOCENTE');
    }

    // VALIDACIÓN 0: academia en común
    if (docente.academias.length === 0) {
      throw new BadRequestException(
        'El docente no está asignado a ninguna academia. Asígnelo a una academia antes de asignar materias.',
      );
    }
    if (materia.academias.length > 0) {
      const idsDocente = docente.academias.map((a) => a.id);
      const idsMateria = materia.academias.map((a) => a.id);
      const compartidas = idsDocente.filter((id) => idsMateria.includes(id));
      if (compartidas.length === 0) {
        const nombresDocente = docente.academias.map((a) => a.nombre).join(', ');
        const nombresMateria = materia.academias.map((a) => a.nombre).join(', ');
        throw new ConflictException(
          `El docente no pertenece a ninguna academia de esta materia. ` +
            `Academias del docente: [${nombresDocente}]. Academias de la materia: [${nombresMateria}].`,
        );
      }
    }

    const materiasDocente = await this.prisma.materia.findMany({ where: { docenteId } });

    for (const m of materiasDocente) {
      if (hayConflictoHorario(materia, m)) {
        throw new ConflictException(
          `Conflicto: el docente ya tiene "${m.nombre}" los días ${m.dias} de ${m.horaInicio} a ${m.horaFin}`,
        );
      }
    }

    // VALIDACIÓN 2: conflicto de grupo
    await this.validarConflictoGrupo(materiaId);

    return this.prisma.$transaction(async (tx) => {
      return tx.materia.update({
        where: { id: materiaId },
        data: { docenteId },
        include: { docente: { select: { id: true, nombre: true, email: true } }, aula: true },
      });
    });
  }

  // ─── Quitar docente ─────────────────────────────────────────────────────────

  async quitarDocente(materiaId: number) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    return this.prisma.materia.update({
      where: { id: materiaId },
      data: { docenteId: null },
      include: { docente: { select: { id: true, nombre: true } }, aula: true },
    });
  }

  // ─── Asignar aula ────────────────────────────────────────────────────────────

  async asignarAula(materiaId: number, aulaId: number) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula || !aula.activo) throw new NotFoundException('Aula no encontrada o inactiva');

    const materiasAula = await this.prisma.materia.findMany({ where: { aulaId } });

    for (const m of materiasAula) {
      if (hayConflictoHorario(materia, m)) {
        throw new ConflictException(
          `Conflicto: el aula ya está ocupada por "${m.nombre}" los días ${m.dias} de ${m.horaInicio} a ${m.horaFin}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.materia.update({
        where: { id: materiaId },
        data: { aulaId },
        include: { docente: { select: { id: true, nombre: true } }, aula: true },
      });
    });
  }

  // ─── Quitar aula ─────────────────────────────────────────────────────────────

  async quitarAula(materiaId: number) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId } });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    return this.prisma.materia.update({
      where: { id: materiaId },
      data: { aulaId: null },
      include: { docente: { select: { id: true, nombre: true } }, aula: true },
    });
  }

  // ─── Horario de un docente ────────────────────────────────────────────────────

  async obtenerHorarioDocente(docenteId: number) {
    const docente = await this.prisma.usuario.findUnique({
      where: { id: docenteId },
      select: { id: true, nombre: true, email: true, academias: { select: { id: true, nombre: true } } },
    });
    if (!docente) throw new NotFoundException('Docente no encontrado');

    const materias = await this.prisma.materia.findMany({
      where: { docenteId },
      include: { aula: true, carrera: { select: { id: true, nombre: true } } },
    });

    return {
      docente,
      materias: this.ordenarMaterias(materias),
    };
  }

  // ─── Horario de un aula ───────────────────────────────────────────────────────

  async obtenerHorarioAula(aulaId: number) {
    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula) throw new NotFoundException('Aula no encontrada');

    const materias = await this.prisma.materia.findMany({
      where: { aulaId },
      include: {
        docente: { select: { id: true, nombre: true } },
        carrera: { select: { id: true, nombre: true } },
      },
    });

    return {
      aula,
      materias: this.ordenarMaterias(materias),
    };
  }

  // ─── Materias sin docente ─────────────────────────────────────────────────────

  obtenerMateriasSinDocente() {
    return this.prisma.materia.findMany({
      where: { docenteId: null },
      include: {
        aula: true,
        carrera: { select: { id: true, nombre: true } },
        academias: { select: { id: true, nombre: true } },
        grupos: { select: { id: true, nombre: true } },
      },
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  // ─── Materias sin aula ────────────────────────────────────────────────────────

  obtenerMateriasSinAula() {
    return this.prisma.materia.findMany({
      where: { aulaId: null },
      include: {
        docente: { select: { id: true, nombre: true } },
        carrera: { select: { id: true, nombre: true } },
      },
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  // ─── Ocupación ────────────────────────────────────────────────────────────────

  async obtenerOcupacion(docenteId?: number, aulaId?: number) {
    const where: any = {};
    if (docenteId) where.docenteId = docenteId;
    if (aulaId) where.aulaId = aulaId;

    const materias = await this.prisma.materia.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        dias: true,
        horaInicio: true,
        horaFin: true,
        docenteId: true,
        aulaId: true,
      },
    });

    return materias.map((m) => ({
      materiaId: m.id,
      nombre: m.nombre,
      dias: m.dias.split(',').map((d) => d.trim()),
      horaInicio: m.horaInicio,
      horaFin: m.horaFin,
    }));
  }

  // ─── Validar conflicto de grupo ────────────────────────────────────────────────

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

    for (const grupo of (materia as any).grupos ?? []) {
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

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private ordenarMaterias(materias: any[]) {
    return materias.sort((a, b) => {
      const primerDiaA = ORDEN_DIAS[a.dias.split(',')[0].trim().toLowerCase()] ?? 99;
      const primerDiaB = ORDEN_DIAS[b.dias.split(',')[0].trim().toLowerCase()] ?? 99;
      if (primerDiaA !== primerDiaB) return primerDiaA - primerDiaB;
      return a.horaInicio.localeCompare(b.horaInicio);
    });
  }
}
