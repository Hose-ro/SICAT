import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoAlertaCarrera,
  EstadoAsistencia,
  TipoAlertaCarrera,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma.service';
import {
  convertirFechaAMinutos,
  convertirHoraAMinutos,
  formatearFechaClave,
  horarioAplicaEnFecha,
  obtenerFinDelDia,
  obtenerInicioDelDia,
} from '../clases/clases.utils';
import { ActualizarAlertaDto } from './dto/actualizar-alerta.dto';

type FiltrosDocente = { carreraId?: number; q?: string; estado?: string };
type FiltrosHorario = {
  carreraId?: number;
  docenteId?: number;
  grupoId?: number;
  aulaId?: number;
};
type ReporteExportacion = {
  generadoEn: Date;
  resumen: Record<string, number>;
  cargaDocente: Array<{
    docente: string;
    horarios: number;
    materias: number;
    estado: string;
  }>;
  alumnosRiesgo: Array<{
    nombre: string;
    numeroControl: string | null;
    total: number;
    riesgo: number;
    porcentajeRiesgo: number;
  }>;
};

@Injectable()
export class JefesCarreraService {
  constructor(private readonly prisma: PrismaService) {}

  obtenerCarreras(usuarioId: number) {
    return this.prisma.carrera.findMany({
      where: { jefes: { some: { usuarioId, activa: true } } },
      select: { id: true, nombre: true, codigo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtenerPanel(usuarioId: number, carreraId?: number) {
    const carreraIds = await this.obtenerAlcance(usuarioId, carreraId);
    await this.sincronizarAlertas(carreraIds);
    const [
      docentes,
      clases,
      materiasSinHorario,
      gruposSinHorario,
      alertas,
      asistencia,
    ] = await Promise.all([
      this.obtenerDocentes(usuarioId, { carreraId }),
      this.obtenerClasesHoy(usuarioId, carreraId),
      this.prisma.materia.count({
        where: {
          carreraId: { in: carreraIds },
          horarios: { none: { activo: true } },
        },
      }),
      this.prisma.grupo.count({
        where: {
          carreraId: { in: carreraIds },
          activo: true,
          horarios: { none: { activo: true } },
        },
      }),
      this.prisma.alertaCarrera.count({
        where: {
          carreraId: { in: carreraIds },
          estado: { not: EstadoAlertaCarrera.CERRADA },
        },
      }),
      this.resumenAsistencia(carreraIds),
    ]);

    const unidadesAtrasadas = await this.prisma.unidad.count({
      where: {
        materia: { carreraId: { in: carreraIds } },
        status: 'ACTIVA',
        fechaInicio: { lte: this.diasAtras(28) },
      },
    });

    return {
      carreras: await this.obtenerCarreras(usuarioId),
      indicadores: {
        docentesActivos: docentes.length,
        clasesHoy: clases.length,
        clasesEnCurso: clases.filter((item) => item.estado === 'EN_CURSO')
          .length,
        clasesConIncidencia: clases.filter((item) =>
          ['NO_INICIADA', 'FUERA_DE_HORARIO'].includes(item.estado),
        ).length,
        materiasSinHorario,
        gruposSinHorario,
        unidadesAtrasadas,
        asistenciaPromedio: asistencia.porcentaje,
        alertasAbiertas: alertas,
      },
      clases: clases.slice(0, 8),
      docentes: docentes.slice(0, 8),
    };
  }

  async obtenerDocentes(usuarioId: number, filtros: FiltrosDocente = {}) {
    const carreraIds = await this.obtenerAlcance(usuarioId, filtros.carreraId);
    const docentes = await this.prisma.usuario.findMany({
      where: {
        rol: 'DOCENTE',
        activo: true,
        nombre: filtros.q
          ? { contains: filtros.q, mode: 'insensitive' }
          : undefined,
        OR: [
          { docenteMaterias: { some: { carreraId: { in: carreraIds } } } },
          {
            horariosDocente: {
              some: {
                activo: true,
                materia: { carreraId: { in: carreraIds } },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        avatar: true,
        docenteMaterias: {
          where: { carreraId: { in: carreraIds } },
          select: { id: true, nombre: true, clave: true, carreraId: true },
        },
        horariosDocente: {
          where: { activo: true, materia: { carreraId: { in: carreraIds } } },
          select: {
            id: true,
            dias: true,
            horaInicio: true,
            horaFin: true,
            materia: { select: { id: true, nombre: true, carreraId: true } },
            grupo: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true } },
          },
        },
        claseSesiones: {
          where: { activa: true, materia: { carreraId: { in: carreraIds } } },
          take: 1,
          orderBy: { horaInicio: 'desc' },
          select: {
            id: true,
            horaInicio: true,
            fueFueraDeHorario: true,
            materia: { select: { id: true, nombre: true } },
            grupo: { select: { id: true, nombre: true } },
            horarioMateria: {
              select: {
                horaInicio: true,
                horaFin: true,
                aula: { select: { id: true, nombre: true, edificio: true } },
              },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const result = docentes.map((docente) => ({
      ...docente,
      cargaSemanal: docente.horariosDocente.length,
      claseActual: docente.claseSesiones[0] ?? null,
      estado: docente.claseSesiones[0]
        ? docente.claseSesiones[0].fueFueraDeHorario
          ? 'FUERA_DE_HORARIO'
          : 'EN_CURSO'
        : 'SIN_CLASE',
    }));
    return filtros.estado
      ? result.filter((item) => item.estado === filtros.estado)
      : result;
  }

  async obtenerDocente(usuarioId: number, docenteId: number) {
    const carreraIds = await this.obtenerAlcance(usuarioId);
    const permitido = await this.prisma.usuario.count({
      where: {
        id: docenteId,
        rol: 'DOCENTE',
        activo: true,
        OR: [
          { docenteMaterias: { some: { carreraId: { in: carreraIds } } } },
          {
            horariosDocente: {
              some: {
                activo: true,
                materia: { carreraId: { in: carreraIds } },
              },
            },
          },
        ],
      },
    });
    if (!permitido) throw new ForbiddenException('Docente fuera de tu alcance');

    const docente = await this.prisma.usuario.findUnique({
      where: { id: docenteId },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        avatar: true,
        horariosDocente: {
          where: { activo: true, materia: { carreraId: { in: carreraIds } } },
          include: {
            materia: { select: { id: true, nombre: true, clave: true } },
            grupo: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true, edificio: true } },
          },
          orderBy: { horaInicio: 'asc' },
        },
        claseSesiones: {
          where: { materia: { carreraId: { in: carreraIds } } },
          include: {
            materia: { select: { id: true, nombre: true, clave: true } },
            grupo: { select: { id: true, nombre: true } },
            unidadRef: { select: { id: true, nombre: true, status: true } },
            _count: { select: { asistencias: true } },
          },
          orderBy: { fecha: 'desc' },
          take: 30,
        },
      },
    });
    if (!docente) throw new NotFoundException('Docente no encontrado');
    const finalizadas = docente.claseSesiones.filter(
      (item) => !item.activa,
    ).length;
    return {
      ...docente,
      resumen: {
        cargaSemanal: docente.horariosDocente.length,
        clasesRegistradas: docente.claseSesiones.length,
        clasesFinalizadas: finalizadas,
        porcentajeFinalizacion: docente.claseSesiones.length
          ? Math.round((finalizadas / docente.claseSesiones.length) * 100)
          : 0,
      },
    };
  }

  async obtenerClasesHoy(usuarioId: number, carreraId?: number) {
    const carreraIds = await this.obtenerAlcance(usuarioId, carreraId);
    const ahora = new Date();
    const horarios = await this.prisma.horarioMateria.findMany({
      where: { activo: true, materia: { carreraId: { in: carreraIds } } },
      include: {
        materia: {
          select: { id: true, nombre: true, clave: true, carreraId: true },
        },
        docente: { select: { id: true, nombre: true } },
        grupo: { select: { id: true, nombre: true } },
        aula: { select: { id: true, nombre: true, edificio: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });
    const hoy = horarios.filter((item) =>
      horarioAplicaEnFecha(item.dias, ahora),
    );
    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        horarioMateriaId: { in: hoy.map((item) => item.id) },
        fecha: {
          gte: obtenerInicioDelDia(ahora),
          lte: obtenerFinDelDia(ahora),
        },
      },
      include: {
        unidadRef: { select: { id: true, nombre: true, orden: true } },
        _count: { select: { asistencias: true } },
      },
    });
    const minutos = convertirFechaAMinutos(ahora);
    return hoy.map((horario) => {
      const sesion = sesiones.find(
        (item) => item.horarioMateriaId === horario.id,
      );
      let estado = 'PROXIMA';
      if (sesion?.activa)
        estado = sesion.fueFueraDeHorario ? 'FUERA_DE_HORARIO' : 'EN_CURSO';
      else if (sesion?.horaFin) estado = 'FINALIZADA';
      else if (minutos > convertirHoraAMinutos(horario.horaFin))
        estado = 'NO_INICIADA';
      else if (minutos >= convertirHoraAMinutos(horario.horaInicio))
        estado = 'PROGRAMADA';
      return { ...horario, sesion: sesion ?? null, estado };
    });
  }

  async obtenerAsistenciaSesion(usuarioId: number, sesionId: number) {
    const carreraIds = await this.obtenerAlcance(usuarioId);
    const sesion = await this.prisma.claseSesion.findFirst({
      where: { id: sesionId, materia: { carreraId: { in: carreraIds } } },
      include: {
        materia: { select: { id: true, nombre: true, clave: true } },
        docente: { select: { id: true, nombre: true, email: true } },
        grupo: { select: { id: true, nombre: true } },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
        horarioMateria: {
          include: {
            aula: { select: { id: true, nombre: true, edificio: true } },
          },
        },
        asistencias: {
          include: {
            alumno: { select: { id: true, nombre: true, numeroControl: true } },
          },
          orderBy: { alumno: { nombre: 'asc' } },
        },
      },
    });
    if (!sesion) {
      throw new NotFoundException('Sesión no encontrada o fuera de tu alcance');
    }

    const resumen = { asistencias: 0, faltas: 0, retardos: 0, justificadas: 0 };
    for (const registro of sesion.asistencias) {
      if (registro.estado === EstadoAsistencia.ASISTENCIA) resumen.asistencias++;
      else if (registro.estado === EstadoAsistencia.FALTA) resumen.faltas++;
      else if (registro.estado === EstadoAsistencia.RETARDO) resumen.retardos++;
      else if (registro.estado === EstadoAsistencia.JUSTIFICADA)
        resumen.justificadas++;
    }

    return {
      sesion: {
        id: sesion.id,
        activa: sesion.activa,
        fueFueraDeHorario: sesion.fueFueraDeHorario,
        horaInicio: sesion.horaInicio,
        horaFin: sesion.horaFin,
        horaInicioProgramada: sesion.horarioMateria?.horaInicio ?? null,
        horaFinProgramada: sesion.horarioMateria?.horaFin ?? null,
        materia: sesion.materia,
        grupo: sesion.grupo,
        docente: sesion.docente,
        aula: sesion.horarioMateria?.aula ?? null,
        unidad: sesion.unidadRef,
      },
      resumen: { ...resumen, total: sesion.asistencias.length },
      asistencias: sesion.asistencias.map((registro) => ({
        id: registro.id,
        alumnoId: registro.alumnoId,
        nombre: registro.alumno.nombre,
        numeroControl: registro.alumno.numeroControl,
        estado: registro.estado,
        observacion: registro.observacion,
      })),
    };
  }

  async obtenerHorarios(usuarioId: number, filtros: FiltrosHorario = {}) {
    const carreraIds = await this.obtenerAlcance(usuarioId, filtros.carreraId);
    return this.prisma.horarioMateria.findMany({
      where: {
        activo: true,
        docenteId: filtros.docenteId,
        grupoId: filtros.grupoId,
        aulaId: filtros.aulaId,
        materia: { carreraId: { in: carreraIds } },
      },
      include: {
        materia: {
          select: { id: true, nombre: true, clave: true, carreraId: true },
        },
        docente: { select: { id: true, nombre: true } },
        grupo: { select: { id: true, nombre: true } },
        aula: { select: { id: true, nombre: true, edificio: true } },
      },
      orderBy: [{ dias: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async obtenerMaterias(usuarioId: number, carreraId?: number) {
    const carreraIds = await this.obtenerAlcance(usuarioId, carreraId);
    return this.prisma.materia.findMany({
      where: { carreraId: { in: carreraIds } },
      include: {
        carrera: { select: { id: true, nombre: true, codigo: true } },
        docente: { select: { id: true, nombre: true } },
        unidades: { orderBy: { orden: 'asc' } },
        horarios: {
          where: { activo: true },
          include: {
            docente: { select: { id: true, nombre: true } },
            grupo: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true } },
          },
        },
        _count: { select: { inscripciones: true, claseSesiones: true } },
      },
      orderBy: [{ carreraId: 'asc' }, { semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  async obtenerGrupos(usuarioId: number, carreraId?: number) {
    const carreraIds = await this.obtenerAlcance(usuarioId, carreraId);
    return this.prisma.grupo.findMany({
      where: { carreraId: { in: carreraIds }, activo: true },
      include: {
        carrera: { select: { id: true, nombre: true, codigo: true } },
        alumnos: {
          where: { activo: true },
          select: { id: true, nombre: true, numeroControl: true, email: true },
        },
        materias: { select: { id: true, nombre: true, clave: true } },
        horarios: {
          where: { activo: true },
          include: {
            materia: { select: { id: true, nombre: true, clave: true } },
            docente: { select: { id: true, nombre: true } },
            aula: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: [{ periodo: 'desc' }, { semestre: 'asc' }, { nombre: 'asc' }],
    });
  }

  async obtenerAlertas(
    usuarioId: number,
    filtros: { carreraId?: number; estado?: string } = {},
  ) {
    const carreraIds = await this.obtenerAlcance(usuarioId, filtros.carreraId);
    await this.sincronizarAlertas(carreraIds);
    return this.prisma.alertaCarrera.findMany({
      where: {
        carreraId: { in: carreraIds },
        estado: filtros.estado
          ? (filtros.estado as EstadoAlertaCarrera)
          : undefined,
      },
      include: {
        carrera: { select: { id: true, nombre: true, codigo: true } },
        responsable: { select: { id: true, nombre: true } },
      },
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async actualizarAlerta(
    usuarioId: number,
    id: number,
    dto: ActualizarAlertaDto,
  ) {
    const carreraIds = await this.obtenerAlcance(usuarioId);
    const alerta = await this.prisma.alertaCarrera.findFirst({
      where: { id, carreraId: { in: carreraIds } },
    });
    if (!alerta) throw new NotFoundException('Alerta no encontrada');
    if (dto.responsableId !== undefined && dto.responsableId !== null) {
      const responsableValido = await this.prisma.usuario.count({
        where: {
          id: dto.responsableId,
          rol: 'DOCENTE',
          activo: true,
          OR: [
            { docenteMaterias: { some: { carreraId: { in: carreraIds } } } },
            {
              horariosDocente: {
                some: {
                  activo: true,
                  materia: { carreraId: { in: carreraIds } },
                },
              },
            },
          ],
        },
      });
      if (!responsableValido) {
        throw new ForbiddenException('Responsable fuera de tu alcance');
      }
    }
    return this.prisma.alertaCarrera.update({
      where: { id },
      data: {
        estado: dto.estado,
        observacion: dto.observacion,
        responsableId: dto.responsableId,
        fechaSeguimiento:
          dto.fechaSeguimiento === null
            ? null
            : dto.fechaSeguimiento
              ? new Date(dto.fechaSeguimiento)
              : undefined,
      },
      include: {
        carrera: { select: { id: true, nombre: true, codigo: true } },
        responsable: { select: { id: true, nombre: true } },
      },
    });
  }

  async obtenerReporte(usuarioId: number, carreraId?: number) {
    const carreraIds = await this.obtenerAlcance(usuarioId, carreraId);
    const [
      carreras,
      docentes,
      clases,
      materias,
      grupos,
      asistencia,
      riesgo,
      aulas,
    ] = await Promise.all([
      this.prisma.carrera.findMany({
        where: { id: { in: carreraIds } },
        select: { id: true, nombre: true, codigo: true },
      }),
      this.obtenerDocentes(usuarioId, { carreraId }),
      this.obtenerClasesHoy(usuarioId, carreraId),
      this.obtenerMaterias(usuarioId, carreraId),
      this.obtenerGrupos(usuarioId, carreraId),
      this.resumenAsistencia(carreraIds),
      this.obtenerAlumnosRiesgo(carreraIds),
      this.resumenAulas(carreraIds),
    ]);
    return {
      generadoEn: new Date(),
      carreras,
      resumen: {
        docentes: docentes.length,
        clasesHoy: clases.length,
        clasesFinalizadas: clases.filter((item) => item.estado === 'FINALIZADA')
          .length,
        incidencias: clases.filter((item) =>
          ['NO_INICIADA', 'FUERA_DE_HORARIO'].includes(item.estado),
        ).length,
        materias: materias.length,
        grupos: grupos.length,
        asistenciaPromedio: asistencia.porcentaje,
        alumnosRiesgo: riesgo.length,
      },
      cargaDocente: docentes.map((item) => ({
        docente: item.nombre,
        horarios: item.cargaSemanal,
        materias: item.docenteMaterias.length,
        estado: item.estado,
      })),
      clases,
      materias: materias.map((item) => ({
        id: item.id,
        clave: item.clave,
        nombre: item.nombre,
        docente: item.docente?.nombre ?? 'Sin asignar',
        sesiones: item._count.claseSesiones,
        unidadActiva:
          item.unidades.find((unidad) => unidad.status === 'ACTIVA')?.nombre ??
          'Sin unidad activa',
      })),
      alumnosRiesgo: riesgo,
      usoAulas: aulas,
    };
  }

  async exportarReporte(
    usuarioId: number,
    carreraId: number | undefined,
    formato: string,
  ) {
    const reporte = await this.obtenerReporte(usuarioId, carreraId);
    if (formato === 'pdf') {
      return {
        buffer: await this.crearPdf(reporte),
        contentType: 'application/pdf',
        filename: 'reporte-jefatura-carrera.pdf',
      };
    }
    return {
      buffer: await this.crearExcel(reporte),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'reporte-jefatura-carrera.xlsx',
    };
  }

  private async obtenerAlcance(usuarioId: number, carreraId?: number) {
    const asignaciones = await this.prisma.jefeCarreraAsignacion.findMany({
      where: { usuarioId, activa: true },
      select: { carreraId: true },
    });
    const ids = asignaciones.map((item) => item.carreraId);
    if (!ids.length)
      throw new ForbiddenException('No tienes carreras asignadas');
    if (carreraId && !ids.includes(carreraId)) {
      throw new ForbiddenException('Carrera fuera de tu alcance');
    }
    return carreraId ? [carreraId] : ids;
  }

  private async sincronizarAlertas(carreraIds: number[]) {
    const ahora = new Date();
    const materias = await this.prisma.materia.findMany({
      where: { carreraId: { in: carreraIds } },
      include: {
        horarios: { where: { activo: true }, select: { id: true } },
        unidades: {
          where: { status: 'ACTIVA' },
          select: { id: true, nombre: true, fechaInicio: true },
        },
      },
    });
    const alertas: Array<{
      fingerprint: string;
      tipo: TipoAlertaCarrera;
      titulo: string;
      mensaje: string;
      referenciaId?: number;
      referenciaTipo?: string;
      carreraId: number;
    }> = [];
    for (const materia of materias) {
      if (!materia.carreraId) continue;
      if (!materia.docenteId) {
        alertas.push({
          fingerprint: `MATERIA_SIN_DOCENTE:${materia.id}`,
          tipo: TipoAlertaCarrera.MATERIA_SIN_DOCENTE,
          titulo: 'Materia sin docente',
          mensaje: `${materia.clave} ${materia.nombre} no tiene docente asignado.`,
          referenciaId: materia.id,
          referenciaTipo: 'Materia',
          carreraId: materia.carreraId,
        });
      }
      if (!materia.horarios.length) {
        alertas.push({
          fingerprint: `MATERIA_SIN_HORARIO:${materia.id}`,
          tipo: TipoAlertaCarrera.MATERIA_SIN_HORARIO,
          titulo: 'Materia sin horario',
          mensaje: `${materia.clave} ${materia.nombre} no tiene horario activo.`,
          referenciaId: materia.id,
          referenciaTipo: 'Materia',
          carreraId: materia.carreraId,
        });
      }
      for (const unidad of materia.unidades) {
        if (unidad.fechaInicio && unidad.fechaInicio <= this.diasAtras(28)) {
          alertas.push({
            fingerprint: `UNIDAD_ATRASADA:${unidad.id}`,
            tipo: TipoAlertaCarrera.UNIDAD_ATRASADA,
            titulo: 'Unidad con más de 28 días',
            mensaje: `${unidad.nombre} continúa activa en ${materia.nombre}.`,
            referenciaId: unidad.id,
            referenciaTipo: 'Unidad',
            carreraId: materia.carreraId,
          });
        }
      }
    }

    const clases = await this.obtenerClasesPorAlcance(carreraIds);
    for (const clase of clases) {
      if (clase.estado === 'NO_INICIADA') {
        alertas.push({
          fingerprint: `CLASE_NO_INICIADA:${clase.id}:${formatearFechaClave(ahora)}`,
          tipo: TipoAlertaCarrera.CLASE_NO_INICIADA,
          titulo: 'Clase no iniciada',
          mensaje: `${clase.materia.nombre}, ${clase.grupo?.nombre ?? 'sin grupo'}, terminó sin sesión registrada.`,
          referenciaId: clase.id,
          referenciaTipo: 'HorarioMateria',
          carreraId: clase.materia.carreraId as number,
        });
      }
      if (clase.sesion && clase.sesion._count.asistencias === 0) {
        alertas.push({
          fingerprint: `ASISTENCIA_SIN_CAPTURA:${clase.sesion.id}`,
          tipo: TipoAlertaCarrera.ASISTENCIA_SIN_CAPTURA,
          titulo: 'Asistencia sin captura',
          mensaje: `${clase.materia.nombre} tiene una sesión sin registros de asistencia.`,
          referenciaId: clase.sesion.id,
          referenciaTipo: 'ClaseSesion',
          carreraId: clase.materia.carreraId as number,
        });
      }
    }

    const riesgo = await this.obtenerAlumnosRiesgo(carreraIds);
    for (const alumno of riesgo) {
      alertas.push({
        fingerprint: `ALUMNO_RIESGO:${alumno.id}`,
        tipo: TipoAlertaCarrera.ALUMNO_RIESGO,
        titulo: 'Alumno con inasistencias',
        mensaje: `${alumno.nombre} registra ${alumno.porcentajeRiesgo}% de faltas o retardos.`,
        referenciaId: alumno.id,
        referenciaTipo: 'Usuario',
        carreraId: alumno.carreraId,
      });
    }

    await Promise.all(
      alertas.map((alerta) =>
        this.prisma.alertaCarrera.upsert({
          where: { fingerprint: alerta.fingerprint },
          create: alerta,
          update: { titulo: alerta.titulo, mensaje: alerta.mensaje },
        }),
      ),
    );
  }

  private async obtenerClasesPorAlcance(carreraIds: number[]) {
    const ahora = new Date();
    const horarios = await this.prisma.horarioMateria.findMany({
      where: { activo: true, materia: { carreraId: { in: carreraIds } } },
      include: {
        materia: { select: { id: true, nombre: true, carreraId: true } },
        grupo: { select: { id: true, nombre: true } },
      },
    });
    const hoy = horarios.filter((item) =>
      horarioAplicaEnFecha(item.dias, ahora),
    );
    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        horarioMateriaId: { in: hoy.map((item) => item.id) },
        fecha: {
          gte: obtenerInicioDelDia(ahora),
          lte: obtenerFinDelDia(ahora),
        },
      },
      include: { _count: { select: { asistencias: true } } },
    });
    const minutos = convertirFechaAMinutos(ahora);
    return hoy.map((horario) => {
      const sesion = sesiones.find(
        (item) => item.horarioMateriaId === horario.id,
      );
      return {
        ...horario,
        sesion,
        estado:
          !sesion && minutos > convertirHoraAMinutos(horario.horaFin)
            ? 'NO_INICIADA'
            : sesion?.activa
              ? 'EN_CURSO'
              : sesion?.horaFin
                ? 'FINALIZADA'
                : 'PROXIMA',
      };
    });
  }

  private async resumenAsistencia(carreraIds: number[]) {
    const asistencias = await this.prisma.asistencia.findMany({
      where: { claseSesion: { materia: { carreraId: { in: carreraIds } } } },
      select: { estado: true },
    });
    const favorables = asistencias.filter(
      (item) =>
        item.estado === EstadoAsistencia.ASISTENCIA ||
        item.estado === EstadoAsistencia.JUSTIFICADA,
    ).length;
    return {
      total: asistencias.length,
      favorables,
      porcentaje: asistencias.length
        ? Math.round((favorables / asistencias.length) * 100)
        : 0,
    };
  }

  private async obtenerAlumnosRiesgo(carreraIds: number[]) {
    const registros = await this.prisma.asistencia.findMany({
      where: { alumno: { carreraId: { in: carreraIds } } },
      select: {
        estado: true,
        alumno: {
          select: {
            id: true,
            nombre: true,
            numeroControl: true,
            carreraId: true,
          },
        },
      },
    });
    const mapa = new Map<
      number,
      {
        id: number;
        nombre: string;
        numeroControl: string | null;
        carreraId: number;
        total: number;
        riesgo: number;
      }
    >();
    for (const registro of registros) {
      if (!registro.alumno.carreraId) continue;
      const actual = mapa.get(registro.alumno.id) ?? {
        ...registro.alumno,
        carreraId: registro.alumno.carreraId,
        total: 0,
        riesgo: 0,
      };
      actual.total += 1;
      if (
        registro.estado === EstadoAsistencia.FALTA ||
        registro.estado === EstadoAsistencia.RETARDO
      ) {
        actual.riesgo += 1;
      }
      mapa.set(registro.alumno.id, actual);
    }
    return [...mapa.values()]
      .filter((item) => item.total >= 3 && item.riesgo / item.total >= 0.3)
      .map((item) => ({
        ...item,
        porcentajeRiesgo: Math.round((item.riesgo / item.total) * 100),
      }))
      .sort((a, b) => b.porcentajeRiesgo - a.porcentajeRiesgo);
  }

  private async resumenAulas(carreraIds: number[]) {
    const horarios = await this.prisma.horarioMateria.findMany({
      where: {
        activo: true,
        aulaId: { not: null },
        materia: { carreraId: { in: carreraIds } },
      },
      select: { aula: { select: { id: true, nombre: true, edificio: true } } },
    });
    const mapa = new Map<
      number,
      { id: number; nombre: string; edificio: string | null; horarios: number }
    >();
    for (const item of horarios) {
      if (!item.aula) continue;
      const actual = mapa.get(item.aula.id) ?? { ...item.aula, horarios: 0 };
      actual.horarios += 1;
      mapa.set(item.aula.id, actual);
    }
    return [...mapa.values()].sort((a, b) => b.horarios - a.horarios);
  }

  private async crearExcel(reporte: ReporteExportacion) {
    const workbook = new ExcelJS.Workbook();
    const resumen = workbook.addWorksheet('Resumen');
    resumen.addRow(['Reporte de jefatura de carrera']);
    resumen.addRow([
      'Generado',
      new Date(reporte.generadoEn).toLocaleString('es-MX'),
    ]);
    for (const [clave, valor] of Object.entries(reporte.resumen)) {
      resumen.addRow([clave, valor]);
    }
    const carga = workbook.addWorksheet('Carga docente');
    carga.addRow(['Docente', 'Horarios', 'Materias', 'Estado']);
    reporte.cargaDocente.forEach((item) =>
      carga.addRow([item.docente, item.horarios, item.materias, item.estado]),
    );
    const riesgo = workbook.addWorksheet('Alumnos en riesgo');
    riesgo.addRow([
      'Alumno',
      'Control',
      'Registros',
      'Incidencias',
      'Porcentaje',
    ]);
    reporte.alumnosRiesgo.forEach((item) =>
      riesgo.addRow([
        item.nombre,
        item.numeroControl,
        item.total,
        item.riesgo,
        item.porcentajeRiesgo,
      ]),
    );
    [resumen, carga, riesgo].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((column) => {
        column.width = 24;
      });
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private crearPdf(reporte: ReporteExportacion): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(18).text('Reporte de jefatura de carrera');
      doc
        .moveDown(0.5)
        .fontSize(10)
        .fillColor('#667085')
        .text(
          `Generado: ${new Date(reporte.generadoEn).toLocaleString('es-MX')}`,
        );
      doc
        .moveDown()
        .fillColor('#1d2939')
        .fontSize(12)
        .text('Resumen', { underline: true });
      Object.entries(reporte.resumen).forEach(([clave, valor]) => {
        doc.fontSize(10).text(`${clave}: ${valor}`);
      });
      doc.moveDown().fontSize(12).text('Carga docente', { underline: true });
      reporte.cargaDocente.forEach((item) => {
        doc
          .fontSize(9)
          .text(
            `${item.docente}: ${item.horarios} horario(s), ${item.materias} materia(s), ${item.estado}`,
          );
      });
      doc
        .moveDown()
        .fontSize(12)
        .text('Alumnos en riesgo', { underline: true });
      if (!reporte.alumnosRiesgo.length)
        doc.fontSize(9).text('Sin alumnos en riesgo con el criterio actual.');
      reporte.alumnosRiesgo.forEach((item) => {
        doc
          .fontSize(9)
          .text(
            `${item.nombre}: ${item.porcentajeRiesgo}% de faltas o retardos`,
          );
      });
      doc.end();
    });
  }

  private diasAtras(dias: number) {
    const date = new Date();
    date.setDate(date.getDate() - dias);
    return date;
  }
}
