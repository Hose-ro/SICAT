import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoTarea,
  ModalidadGrupo,
  Prisma,
  TipoEntrega,
  TipoTokenAuth,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';
import { PeriodosService } from '../periodos/periodos.service';
import { MODALIDADES, modalidadDeHorario } from '../common/modalidad.util';
import { partesEnZona, zonaHoraria } from '../common/zona-horaria.util';
import { construirCalendario, EventoDiaCompleto, EventoSemanal } from './ics';

/** Una suscripción dura dos años; generar otra revoca la anterior. */
const VIGENCIA_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const ESTADOS_TAREA_VISIBLE: EstadoTarea[] = [
  EstadoTarea.PUBLICADA,
  EstadoTarea.VENCIDA,
];

/** Cómo se anuncia en el calendario cada tipo de actividad (si no, "Entrega"). */
const ACTIVIDAD_EN_CALENDARIO: Record<string, string> = {
  EXAMEN: 'Examen',
  PROYECTO: 'Proyecto',
  PRACTICAS: 'Práctica',
  EXPOSICION: 'Exposición',
};

const HORARIO_SELECT = {
  id: true,
  dias: true,
  horaInicio: true,
  horaFin: true,
  docenteId: true,
  materia: { select: { nombre: true } },
  grupo: { select: { nombre: true, modalidad: true } },
  aula: { select: { nombre: true } },
} satisfies Prisma.HorarioMateriaSelect;

type Horario = Prisma.HorarioMateriaGetPayload<{
  select: typeof HORARIO_SELECT;
}>;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

function dosDigitos(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Suscripción iCal: el horario de clases (sin los días suspendidos) y las
 * fechas límite de tareas, para verlos en el calendario del teléfono. El
 * calendario no manda encabezados de sesión, así que el acceso es con un
 * token propio en la URL, revocable y distinto del de inicio de sesión.
 */
@Injectable()
export class CalendarioService {
  constructor(
    private prisma: PrismaService,
    private periodos: PeriodosService,
  ) {}

  async generarToken(usuarioId: number) {
    const token = randomBytes(24).toString('base64url');
    const ahora = new Date();
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({
        where: { usuarioId, tipo: TipoTokenAuth.CALENDARIO, usedAt: null },
        data: { usedAt: ahora },
      }),
      this.prisma.authToken.create({
        data: {
          usuarioId,
          tipo: TipoTokenAuth.CALENDARIO,
          tokenHash: hashToken(token),
          expiresAt: new Date(ahora.getTime() + VIGENCIA_MS),
        },
      }),
    ]);
    return { token };
  }

  async estado(usuarioId: number) {
    const activo = await this.prisma.authToken.findFirst({
      where: {
        usuarioId,
        tipo: TipoTokenAuth.CALENDARIO,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { createdAt: true },
    });
    return { activo: Boolean(activo), creado: activo?.createdAt ?? null };
  }

  async revocar(usuarioId: number) {
    await this.prisma.authToken.updateMany({
      where: { usuarioId, tipo: TipoTokenAuth.CALENDARIO, usedAt: null },
      data: { usedAt: new Date() },
    });
    return { activo: false };
  }

  async feed(token: string, ahora = new Date()) {
    const registro = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        tipo: true,
        usedAt: true,
        expiresAt: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            rol: true,
            activo: true,
            grupoId: true,
          },
        },
      },
    });
    const usuario = registro?.usuario;
    if (
      !registro ||
      !usuario ||
      registro.tipo !== TipoTokenAuth.CALENDARIO ||
      registro.usedAt ||
      registro.expiresAt <= ahora ||
      !usuario.activo ||
      (usuario.rol !== 'DOCENTE' && usuario.rol !== 'ALUMNO')
    ) {
      // Mismo 404 para todo: no se revela si el token existió.
      throw new NotFoundException('Calendario no encontrado');
    }

    const rangos = new Map<
      ModalidadGrupo,
      { clave: string; desde: string; hasta: string }
    >();
    for (const modalidad of MODALIDADES) {
      const periodo = await this.periodos.obtenerActual(ahora, modalidad);
      rangos.set(modalidad, {
        clave: periodo.clave,
        desde: periodo.fechaInicio,
        hasta: periodo.fechaFin,
      });
    }
    const claves = [...new Set([...rangos.values()].map((r) => r.clave))];
    const inicio = [...rangos.values()].map((r) => r.desde).sort()[0];

    const esDocente = usuario.rol === 'DOCENTE';
    const horarios: Horario[] = esDocente
      ? await this.prisma.horarioMateria.findMany({
          where: { docenteId: usuario.id, activo: true },
          select: HORARIO_SELECT,
        })
      : usuario.grupoId
        ? await this.prisma.horarioMateria.findMany({
            where: { grupoId: usuario.grupoId, activo: true },
            select: HORARIO_SELECT,
          })
        : [];

    const docenteIds = [...new Set(horarios.map((h) => h.docenteId))];
    const [propias, institucionales, tareas] = await Promise.all([
      this.prisma.suspensionClase.findMany({
        where: { docenteId: { in: docenteIds }, periodoClave: { in: claves } },
        select: { docenteId: true, fecha: true },
      }),
      this.prisma.suspensionInstitucional.findMany({
        where: { periodoClave: { in: claves } },
        select: { fecha: true, motivo: true },
      }),
      esDocente
        ? this.tareasDocente(usuario.id, inicio)
        : this.tareasAlumno(usuario.id, usuario.grupoId, inicio),
    ]);

    const semanales: EventoSemanal[] = horarios.map((horario) => {
      const rango = rangos.get(modalidadDeHorario(horario))!;
      const lugar = horario.aula?.nombre;
      return {
        uid: `horario-${horario.id}@sicat`,
        resumen: horario.grupo
          ? `${horario.materia.nombre} · ${horario.grupo.nombre}`
          : horario.materia.nombre,
        lugar,
        desde: rango.desde,
        hasta: rango.hasta,
        dias: horario.dias,
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        excepciones: [
          ...institucionales.map((s) => s.fecha),
          ...propias
            .filter((s) => s.docenteId === horario.docenteId)
            .map((s) => s.fecha),
        ],
      };
    });

    const diasCompletos: EventoDiaCompleto[] = [
      ...institucionales.map((s) => ({
        uid: `sin-clases-${s.fecha}@sicat`,
        resumen: `Sin clases: ${s.motivo}`,
        fecha: s.fecha,
      })),
      ...tareas.map((tarea) => {
        const p = partesEnZona(tarea.fechaLimite as Date);
        const hora =
          tarea.horaLimite ?? `${dosDigitos(p.hour)}:${dosDigitos(p.minute)}`;
        const enClase = tarea.tipoEntrega === TipoEntrega.PRESENCIAL;
        const tipo = ACTIVIDAD_EN_CALENDARIO[tarea.categoria?.tipo ?? ''];
        return {
          uid: `tarea-${tarea.id}@sicat`,
          resumen: `${tipo ?? (enClase ? 'En clase' : 'Entrega')}: ${tarea.titulo}`,
          descripcion: `${tarea.materia.nombre}${tarea.grupo ? ` · ${tarea.grupo.nombre}` : ''}. ${enClase ? `Se aplica en clase, ${hora}.` : `Hora límite ${hora}.`}`,
          fecha: `${p.year}-${dosDigitos(p.month)}-${dosDigitos(p.day)}`,
        };
      }),
    ];

    const p = partesEnZona(ahora);
    const desplazamientoMin = Math.round(
      (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
        Math.floor(ahora.getTime() / 1000) * 1000) /
        60000,
    );

    return construirCalendario({
      nombre: esDocente ? 'SICAT · Mis clases' : 'SICAT · Mi horario',
      zona: zonaHoraria(),
      desplazamientoMin,
      semanales,
      diasCompletos,
      generado: ahora,
    });
  }

  private tareasDocente(docenteId: number, desde: string) {
    return this.prisma.tarea.findMany({
      where: {
        docenteId,
        estado: { in: ESTADOS_TAREA_VISIBLE },
        tieneFechaLimite: true,
        fechaLimite: { gte: new Date(`${desde}T00:00:00Z`) },
      },
      select: {
        id: true,
        titulo: true,
        fechaLimite: true,
        horaLimite: true,
        tipoEntrega: true,
        categoria: { select: { tipo: true } },
        materia: { select: { nombre: true } },
        grupo: { select: { nombre: true } },
      },
    });
  }

  /** Las tareas que el alumno ve: de sus materias inscritas y de su grupo. */
  private async tareasAlumno(
    alumnoId: number,
    grupoId: number | null,
    desde: string,
  ) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { alumnoId, estado: 'ACEPTADA' },
      select: { materiaId: true, grupoId: true },
    });
    if (!inscripciones.length) return [];
    return this.prisma.tarea.findMany({
      where: {
        estado: { in: ESTADOS_TAREA_VISIBLE },
        tieneFechaLimite: true,
        fechaLimite: { gte: new Date(`${desde}T00:00:00Z`) },
        OR: inscripciones.map((inscripcion) => {
          const grupo = inscripcion.grupoId ?? grupoId;
          return {
            materiaId: inscripcion.materiaId,
            OR: [{ grupoId: null }, ...(grupo ? [{ grupoId: grupo }] : [])],
          };
        }),
      },
      select: {
        id: true,
        titulo: true,
        fechaLimite: true,
        horaLimite: true,
        tipoEntrega: true,
        categoria: { select: { tipo: true } },
        materia: { select: { nombre: true } },
        grupo: { select: { nombre: true } },
      },
    });
  }
}
