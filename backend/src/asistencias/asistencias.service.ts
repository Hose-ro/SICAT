import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAsistencia } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PasarListaDto } from './dto/pasar-lista.dto';
import { ActualizarAsistenciaDto } from './dto/actualizar-asistencia.dto';
import {
  formatearFechaClave,
  obtenerClaveSemana,
  obtenerFinDelDia,
  obtenerInicioDelDia,
} from '../clases/clases.utils';

type Actor = {
  id: number;
  rol: string;
};

@Injectable()
export class AsistenciasService {
  constructor(private prisma: PrismaService) {}

  async pasarLista(actor: Actor, dto: PasarListaDto) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: dto.claseSesionId },
      include: {
        grupo: { select: { id: true, nombre: true } },
      },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    this.validarAccesoSesion(actor, sesion.docenteId);

    const alumnosPermitidos = new Set(
      await this.obtenerAlumnoIdsPermitidosSesion(sesion.id),
    );
    let asistencias = 0;
    let faltas = 0;
    let retardos = 0;
    let justificados = 0;

    for (const registro of dto.registros) {
      if (!alumnosPermitidos.has(registro.alumnoId)) {
        throw new BadRequestException(
          `El alumno ${registro.alumnoId} no pertenece al grupo autorizado para esta sesión`,
        );
      }

      await this.prisma.asistencia.upsert({
        where: {
          claseSesionId_alumnoId: {
            claseSesionId: dto.claseSesionId,
            alumnoId: registro.alumnoId,
          },
        },
        create: {
          claseSesionId: dto.claseSesionId,
          alumnoId: registro.alumnoId,
          estado: registro.estado,
          observacion: registro.observacion,
          editadaPorId: actor.id,
        },
        update: {
          estado: registro.estado,
          observacion: registro.observacion,
          editadaPorId: actor.id,
        },
      });

      if (registro.estado === 'ASISTENCIA') asistencias++;
      else if (registro.estado === 'FALTA') faltas++;
      else if (registro.estado === 'RETARDO') retardos++;
      else if (registro.estado === 'JUSTIFICADA') justificados++;
    }

    return {
      sesionId: dto.claseSesionId,
      asistencias,
      faltas,
      retardos,
      justificados,
      total: dto.registros.length,
      guardadoEn: new Date(),
      modoEdicionHistorica: !sesion.activa,
    };
  }

  async obtenerListaSesion(claseSesionId: number, actor: Actor) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: claseSesionId },
      include: {
        materia: { select: { id: true, nombre: true, clave: true } },
        grupo: {
          select: { id: true, nombre: true, periodo: true, semestre: true },
        },
        horarioMateria: {
          include: {
            aula: { select: { id: true, nombre: true, edificio: true } },
          },
        },
        unidadRef: {
          select: { id: true, nombre: true, orden: true, status: true },
        },
        asistencias: {
          include: {
            alumno: {
              select: { id: true, nombre: true, numeroControl: true },
            },
          },
          orderBy: { alumno: { nombre: 'asc' } },
        },
      },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    this.validarAccesoSesion(actor, sesion.docenteId);

    const alumnosFormales = sesion.grupoId
      ? await this.prisma.inscripcion.findMany({
          where: {
            materiaId: sesion.materiaId,
            estado: 'ACEPTADA',
            alumno: {
              grupoId: sesion.grupoId,
              rol: 'ALUMNO',
              activo: true,
            },
          },
          select: {
            alumno: {
              select: { id: true, nombre: true, numeroControl: true },
            },
          },
          orderBy: { alumno: { nombre: 'asc' } },
        })
      : [];

    const idsFormales = new Set(alumnosFormales.map((item) => item.alumno.id));
    const idsRegistrados = new Set(
      sesion.asistencias.map((item) => item.alumnoId),
    );

    const manualesGuardados = sesion.asistencias
      .filter((item) => !idsFormales.has(item.alumnoId))
      .map((item) => ({
        alumno: item.alumno,
        asistencia: item,
      }));

    const alumnosDisponiblesAgregar = sesion.grupoId
      ? await this.prisma.usuario.findMany({
          where: {
            grupoId: sesion.grupoId,
            rol: 'ALUMNO',
            activo: true,
            id: {
              notIn: Array.from(new Set([...idsFormales, ...idsRegistrados])),
            },
          },
          select: { id: true, nombre: true, numeroControl: true },
          orderBy: { nombre: 'asc' },
        })
      : [];

    const mapaAsistencias = new Map(
      sesion.asistencias.map((item) => [item.alumnoId, item]),
    );

    const alumnos = [
      ...alumnosFormales.map((item) => ({
        alumnoId: item.alumno.id,
        nombre: item.alumno.nombre,
        numeroControl: item.alumno.numeroControl,
        estado: mapaAsistencias.get(item.alumno.id)?.estado ?? null,
        observacion: mapaAsistencias.get(item.alumno.id)?.observacion ?? null,
        asistenciaId: mapaAsistencias.get(item.alumno.id)?.id ?? null,
        manual: false,
      })),
      ...manualesGuardados.map((item) => ({
        alumnoId: item.alumno.id,
        nombre: item.alumno.nombre,
        numeroControl: item.alumno.numeroControl,
        estado: item.asistencia.estado,
        observacion: item.asistencia.observacion ?? null,
        asistenciaId: item.asistencia.id,
        manual: true,
      })),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return {
      sesion: {
        id: sesion.id,
        fecha: sesion.fecha,
        semanaClave: sesion.semanaClave,
        horaInicio: sesion.horaInicio,
        horaFin: sesion.horaFin,
        activa: sesion.activa,
        fueFueraDeHorario: sesion.fueFueraDeHorario,
        materia: sesion.materia,
        grupo: sesion.grupo,
        aula: sesion.horarioMateria?.aula ?? null,
        unidad: sesion.unidadRef ?? {
          id: sesion.unidadId,
          orden: sesion.unidad,
          nombre: `Unidad ${sesion.unidad}`,
        },
      },
      alumnos,
      alumnosDisponiblesAgregar,
    };
  }

  async obtenerResumenMateria(
    materiaId: number,
    actor: Actor,
    unidadId?: number,
  ) {
    const where: Record<string, unknown> = { materiaId };

    if (actor.rol !== 'ADMIN') {
      Object.assign(where, { docenteId: actor.id });
    }
    if (unidadId) {
      Object.assign(where, { unidadId });
    }

    const sesiones = await this.prisma.claseSesion.findMany({
      where,
      select: { id: true },
    });
    const sesionIds = sesiones.map((sesion) => sesion.id);
    if (!sesionIds.length) return [];

    const registros = await this.prisma.asistencia.findMany({
      where: { claseSesionId: { in: sesionIds } },
      include: {
        alumno: {
          select: { id: true, nombre: true, numeroControl: true },
        },
      },
    });

    return this.construirResumenAlumnos(registros);
  }

  async obtenerAsistenciasAlumno(alumnoId: number, materiaId: number) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { grupoId: true },
    });

    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        materiaId,
        ...(alumno?.grupoId ? { grupoId: alumno.grupoId } : {}),
      },
      include: {
        grupo: { select: { id: true, nombre: true } },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    const asistencias = await this.prisma.asistencia.findMany({
      where: {
        alumnoId,
        claseSesionId: { in: sesiones.map((sesion) => sesion.id) },
      },
    });

    const mapaAsistencias = new Map(
      asistencias.map((asistencia) => [asistencia.claseSesionId, asistencia]),
    );

    return sesiones.map((sesion) => {
      const asistencia = mapaAsistencias.get(sesion.id);
      return {
        id: asistencia?.id ?? null,
        sesionId: sesion.id,
        fecha: sesion.fecha,
        semanaClave: sesion.semanaClave,
        unidad: sesion.unidadRef?.orden ?? sesion.unidad,
        unidadId: sesion.unidadId,
        grupo: sesion.grupo,
        estado: asistencia?.estado ?? null,
        observacion: asistencia?.observacion ?? null,
      };
    });
  }

  async justificarFalta(
    asistenciaId: number,
    alumnoId: number,
    justificacion: string,
    archivoUrl?: string,
  ) {
    const asistencia = await this.prisma.asistencia.findUnique({
      where: { id: asistenciaId },
    });
    if (!asistencia) throw new NotFoundException('Asistencia no encontrada');
    if (asistencia.alumnoId !== alumnoId) throw new ForbiddenException();
    if (asistencia.estado !== 'FALTA')
      throw new ForbiddenException('Solo se pueden justificar faltas');

    return this.prisma.asistencia.update({
      where: { id: asistenciaId },
      data: {
        justificacion,
        archivoJustificacion: archivoUrl,
        estado: 'JUSTIFICADA',
      },
    });
  }

  async obtenerHistorial(
    actor: Actor,
    filters: {
      materiaId?: number;
      grupoId?: number;
      fecha?: string;
      semana?: string;
      unidadId?: number;
      docenteId?: number;
    },
  ) {
    const where: Record<string, unknown> = {};

    if (actor.rol === 'ADMIN') {
      if (filters.docenteId)
        Object.assign(where, { docenteId: filters.docenteId });
    } else {
      Object.assign(where, { docenteId: actor.id });
    }

    if (filters.materiaId)
      Object.assign(where, { materiaId: filters.materiaId });
    if (filters.grupoId) Object.assign(where, { grupoId: filters.grupoId });
    if (filters.unidadId) Object.assign(where, { unidadId: filters.unidadId });

    if (filters.fecha) {
      const fecha = new Date(filters.fecha);
      Object.assign(where, {
        fecha: {
          gte: obtenerInicioDelDia(fecha),
          lte: obtenerFinDelDia(fecha),
        },
      });
    } else if (filters.semana) {
      Object.assign(where, {
        semanaClave: obtenerClaveSemana(new Date(filters.semana)),
      });
    }

    const sesiones = await this.prisma.claseSesion.findMany({
      where,
      include: {
        materia: { select: { id: true, nombre: true, clave: true } },
        grupo: { select: { id: true, nombre: true } },
        docente: { select: { id: true, nombre: true } },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
        horarioMateria: {
          include: {
            aula: { select: { id: true, nombre: true } },
          },
        },
        asistencias: {
          include: {
            alumno: { select: { id: true, nombre: true, numeroControl: true } },
          },
        },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });

    const items = sesiones.map((sesion) => {
      const resumen = this.resumirRegistros(sesion.asistencias);
      return {
        id: sesion.id,
        fecha: sesion.fecha,
        semanaClave: sesion.semanaClave,
        fueFueraDeHorario: sesion.fueFueraDeHorario,
        activa: sesion.activa,
        materia: sesion.materia,
        grupo: sesion.grupo,
        docente: sesion.docente,
        aula: sesion.horarioMateria?.aula ?? null,
        unidad: sesion.unidadRef ?? {
          id: sesion.unidadId,
          orden: sesion.unidad,
          nombre: `Unidad ${sesion.unidad}`,
        },
        resumen,
      };
    });

    const registros = sesiones.flatMap((sesion) => sesion.asistencias);
    const estadisticas = this.construirEstadisticasGlobales(registros);

    return {
      items,
      estadisticas,
    };
  }

  async actualizarAsistencia(
    asistenciaId: number,
    actor: Actor,
    dto: ActualizarAsistenciaDto,
  ) {
    const asistencia = await this.prisma.asistencia.findUnique({
      where: { id: asistenciaId },
      include: {
        claseSesion: { select: { id: true, docenteId: true } },
      },
    });
    if (!asistencia) throw new NotFoundException('Asistencia no encontrada');
    this.validarAccesoSesion(actor, asistencia.claseSesion.docenteId);

    return this.prisma.asistencia.update({
      where: { id: asistenciaId },
      data: {
        estado: dto.estado,
        observacion: dto.observacion,
        editadaPorId: actor.id,
      },
      include: {
        alumno: { select: { id: true, nombre: true, numeroControl: true } },
      },
    });
  }

  async obtenerDatosReporte(
    actor: Actor,
    materiaId: number,
    filters: {
      formato?: string;
      sesionId?: number;
      grupoId?: number;
      fecha?: string;
      semana?: string;
      unidadId?: number;
      docenteId?: number;
    },
  ) {
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      include: {
        docente: { select: { id: true, nombre: true } },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const where: Record<string, unknown> = { materiaId };
    if (actor.rol !== 'ADMIN') {
      Object.assign(where, { docenteId: actor.id });
    } else if (filters.docenteId) {
      Object.assign(where, { docenteId: filters.docenteId });
    }

    if (filters.sesionId) Object.assign(where, { id: filters.sesionId });
    if (filters.grupoId) Object.assign(where, { grupoId: filters.grupoId });
    if (filters.unidadId) Object.assign(where, { unidadId: filters.unidadId });

    if (filters.fecha) {
      const fecha = new Date(filters.fecha);
      Object.assign(where, {
        fecha: {
          gte: obtenerInicioDelDia(fecha),
          lte: obtenerFinDelDia(fecha),
        },
      });
    } else if (filters.semana) {
      Object.assign(where, {
        semanaClave: obtenerClaveSemana(new Date(filters.semana)),
      });
    }

    const sesiones = await this.prisma.claseSesion.findMany({
      where,
      include: {
        grupo: { select: { id: true, nombre: true } },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    const sesionIds = sesiones.map((sesion) => sesion.id);
    const asistencias =
      sesionIds.length > 0
        ? await this.prisma.asistencia.findMany({
            where: { claseSesionId: { in: sesionIds } },
            include: {
              alumno: {
                select: { id: true, nombre: true, numeroControl: true },
              },
            },
          })
        : [];

    const alumnosMapa = new Map<
      number,
      { id: number; nombre: string; numeroControl: string | null }
    >();

    asistencias.forEach((asistencia) => {
      alumnosMapa.set(asistencia.alumno.id, {
        id: asistencia.alumno.id,
        nombre: asistencia.alumno.nombre,
        numeroControl: asistencia.alumno.numeroControl,
      });
    });

    if (filters.grupoId || sesiones.some((sesion) => sesion.grupoId)) {
      const grupoIds = Array.from(
        new Set([
          ...(filters.grupoId ? [filters.grupoId] : []),
          ...(sesiones
            .map((sesion) => sesion.grupoId)
            .filter(Boolean) as number[]),
        ]),
      );

      if (grupoIds.length > 0) {
        const formales = await this.prisma.inscripcion.findMany({
          where: {
            materiaId,
            estado: 'ACEPTADA',
            alumno: { grupoId: { in: grupoIds }, rol: 'ALUMNO', activo: true },
          },
          include: {
            alumno: { select: { id: true, nombre: true, numeroControl: true } },
          },
        });
        formales.forEach((inscripcion) => {
          alumnosMapa.set(inscripcion.alumno.id, {
            id: inscripcion.alumno.id,
            nombre: inscripcion.alumno.nombre,
            numeroControl: inscripcion.alumno.numeroControl,
          });
        });
      }
    }

    return {
      materia,
      filtros: {
        sesionId: filters.sesionId ?? null,
        grupoId: filters.grupoId ?? null,
        fecha: filters.fecha ?? null,
        semana: filters.semana
          ? obtenerClaveSemana(new Date(filters.semana))
          : null,
        unidadId: filters.unidadId ?? null,
      },
      sesiones,
      alumnos: Array.from(alumnosMapa.values()).sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es'),
      ),
      asistencias,
    };
  }

  private validarAccesoSesion(actor: Actor, docenteId: number) {
    if (actor.rol === 'ADMIN') return;
    if (docenteId !== actor.id) {
      throw new ForbiddenException('No tienes acceso a esta sesión');
    }
  }

  private async obtenerAlumnoIdsPermitidosSesion(claseSesionId: number) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: claseSesionId },
      select: { id: true, materiaId: true, grupoId: true },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');

    const registrados = await this.prisma.asistencia.findMany({
      where: { claseSesionId },
      select: { alumnoId: true },
    });

    const registradosIds = registrados.map((item) => item.alumnoId);
    if (!sesion.grupoId) return registradosIds;

    const alumnosGrupo = await this.prisma.usuario.findMany({
      where: {
        grupoId: sesion.grupoId,
        rol: 'ALUMNO',
        activo: true,
      },
      select: { id: true },
    });

    return Array.from(
      new Set([...alumnosGrupo.map((alumno) => alumno.id), ...registradosIds]),
    );
  }

  private construirResumenAlumnos(
    registros: Array<{
      alumnoId: number;
      estado: EstadoAsistencia;
      alumno: { id: number; nombre: string; numeroControl: string | null };
    }>,
  ) {
    const mapa = new Map<number, any>();

    for (const registro of registros) {
      if (!mapa.has(registro.alumnoId)) {
        mapa.set(registro.alumnoId, {
          alumnoId: registro.alumno.id,
          nombre: registro.alumno.nombre,
          numControl: registro.alumno.numeroControl,
          asistencias: 0,
          faltas: 0,
          retardos: 0,
          justificadas: 0,
        });
      }

      const actual = mapa.get(registro.alumnoId);
      if (registro.estado === 'ASISTENCIA') actual.asistencias++;
      else if (registro.estado === 'FALTA') actual.faltas++;
      else if (registro.estado === 'RETARDO') actual.retardos++;
      else if (registro.estado === 'JUSTIFICADA') actual.justificadas++;
    }

    return Array.from(mapa.values()).map((item) => {
      const total =
        item.asistencias + item.faltas + item.retardos + item.justificadas;
      return {
        ...item,
        porcentaje:
          total > 0 ? Math.round((item.asistencias / total) * 100) : 0,
      };
    });
  }

  private resumirRegistros(registros: Array<{ estado: EstadoAsistencia }>) {
    const resumen = {
      asistencias: 0,
      faltas: 0,
      retardos: 0,
      justificados: 0,
      total: registros.length,
      porcentaje: 0,
    };

    registros.forEach((registro) => {
      if (registro.estado === 'ASISTENCIA') resumen.asistencias++;
      else if (registro.estado === 'FALTA') resumen.faltas++;
      else if (registro.estado === 'RETARDO') resumen.retardos++;
      else if (registro.estado === 'JUSTIFICADA') resumen.justificados++;
    });

    resumen.porcentaje =
      resumen.total > 0
        ? Math.round((resumen.asistencias / resumen.total) * 100)
        : 0;

    return resumen;
  }

  private construirEstadisticasGlobales(
    registros: Array<{
      estado: EstadoAsistencia;
      alumnoId: number;
      alumno: { id: number; nombre: string; numeroControl: string | null };
    }>,
  ) {
    const resumen = this.resumirRegistros(registros);
    const ranking = new Map<
      number,
      {
        alumnoId: number;
        nombre: string;
        numeroControl: string | null;
        faltas: number;
      }
    >();

    registros.forEach((registro) => {
      if (!ranking.has(registro.alumnoId)) {
        ranking.set(registro.alumnoId, {
          alumnoId: registro.alumno.id,
          nombre: registro.alumno.nombre,
          numeroControl: registro.alumno.numeroControl,
          faltas: 0,
        });
      }

      if (registro.estado === 'FALTA') {
        ranking.get(registro.alumnoId)!.faltas++;
      }
    });

    return {
      ...resumen,
      rankingFaltas: Array.from(ranking.values())
        .filter((item) => item.faltas > 0)
        .sort(
          (a, b) =>
            b.faltas - a.faltas || a.nombre.localeCompare(b.nombre, 'es'),
        )
        .slice(0, 10),
    };
  }
}
