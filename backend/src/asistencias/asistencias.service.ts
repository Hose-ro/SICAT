import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAsistencia, Sexo, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PasarListaDto } from './dto/pasar-lista.dto';
import { ActualizarAsistenciaDto } from './dto/actualizar-asistencia.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  formatearFechaClave,
  obtenerClaveSemana,
  obtenerFinDelDia,
  obtenerInicioDelDia,
  parsearFechaClave,
  parsearMesClave,
  horarioAplicaEnFecha,
  sumarDias,
} from '../clases/clases.utils';
import { esDocenteDeMateria } from '../common/materia-ownership';
import { PeriodosService } from '../periodos/periodos.service';

type Actor = {
  id: number;
  rol: string;
};

type ResumenAlumno = {
  alumnoId: number;
  nombre: string;
  numControl: string | null;
  asistencias: number;
  faltas: number;
  retardos: number;
  justificadas: number;
  porcentaje: number;
};

type ResumenRegistros = {
  asistencias: number;
  faltas: number;
  retardos: number;
  justificados: number;
  total: number;
  porcentaje: number;
};

@Injectable()
export class AsistenciasService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
    private periodos: PeriodosService,
  ) {}

  async pasarLista(actor: Actor, dto: PasarListaDto) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: dto.claseSesionId },
      include: {
        grupo: { select: { id: true, nombre: true } },
      },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    this.validarAccesoSesion(actor, sesion.docenteId);
    await this.validarNoSuspendida(sesion.docenteId, sesion.fecha);

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
          `El alumno ${registro.alumnoId} no pertenece al grupo ni está inscrito en la materia de esta sesión`,
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

    if (sesion.fueFueraDeHorario) {
      await this.notificaciones.crearSiNoExisteNoLeida({
        usuarioId: sesion.docenteId,
        tipo: TipoNotificacion.ASISTENCIA_FUERA_HORARIO,
        titulo: 'Asistencia fuera de horario',
        mensaje: 'Se registró una asistencia fuera del horario programado.',
        referenciaId: sesion.id,
        referenciaTipo: 'Asistencias',
      });
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
              select: {
                id: true,
                nombre: true,
                numeroControl: true,
                sexo: true,
              },
            },
          },
          orderBy: { alumno: { nombre: 'asc' } },
        },
      },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    this.validarAccesoSesion(actor, sesion.docenteId);

    // La lista la forman los inscritos en la materia: los que pertenecen al
    // grupo de la sesión y los que el docente agregó a esta clase en concreto
    // (inscripción con ese grupo, o sin grupo cuando la sesión tampoco lo
    // tiene). Así una materia compartida por dos grupos no mezcla sus listas.
    const inscripcionesFormales = await this.prisma.inscripcion.findMany({
      where: {
        materiaId: sesion.materiaId,
        estado: 'ACEPTADA',
        alumno: { rol: 'ALUMNO', activo: true },
        ...(sesion.grupoId
          ? {
              OR: [
                { alumno: { grupoId: sesion.grupoId } },
                { grupoId: sesion.grupoId },
              ],
            }
          : {}),
      },
      select: {
        alumno: {
          select: { id: true, nombre: true, numeroControl: true, sexo: true },
        },
      },
      orderBy: { alumno: { nombre: 'asc' } },
    });

    // Un alumno puede tener inscripción en más de un periodo (recursa la
    // materia): en la lista va una sola vez.
    const alumnosFormales = Array.from(
      new Map(
        inscripcionesFormales.map((item) => [item.alumno.id, item.alumno]),
      ).values(),
    );
    const idsFormales = new Set(alumnosFormales.map((alumno) => alumno.id));
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
          select: { id: true, nombre: true, numeroControl: true, sexo: true },
          orderBy: { nombre: 'asc' },
        })
      : [];

    const mapaAsistencias = new Map(
      sesion.asistencias.map((item) => [item.alumnoId, item]),
    );

    const alumnos = [
      ...alumnosFormales.map((alumno) => ({
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        numeroControl: alumno.numeroControl,
        sexo: alumno.sexo,
        estado: mapaAsistencias.get(alumno.id)?.estado ?? null,
        observacion: mapaAsistencias.get(alumno.id)?.observacion ?? null,
        asistenciaId: mapaAsistencias.get(alumno.id)?.id ?? null,
        manual: false,
      })),
      ...manualesGuardados.map((item) => ({
        alumnoId: item.alumno.id,
        nombre: item.alumno.nombre,
        numeroControl: item.alumno.numeroControl,
        sexo: item.alumno.sexo,
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
        registroAtrasado: sesion.registroAtrasado,
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
          select: { id: true, nombre: true, numeroControl: true, sexo: true },
        },
      },
    });

    return this.construirResumenAlumnos(registros);
  }

  async obtenerAsistenciasAlumno(
    alumnoId: number,
    materiaId: number,
    actor: Actor,
  ) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { grupoId: true },
    });

    if (actor.rol === 'DOCENTE') {
      const imparte = await esDocenteDeMateria(
        this.prisma,
        materiaId,
        actor.id,
        alumno?.grupoId,
      );
      if (!imparte) {
        throw new ForbiddenException('No impartes esta materia');
      }
    }

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

    const horarios = alumno?.grupoId
      ? await this.prisma.horarioMateria.findMany({
          where: { materiaId, grupoId: alumno.grupoId, activo: true },
          select: {
            docenteId: true,
            dias: true,
            grupo: { select: { id: true, nombre: true } },
          },
        })
      : [];
    const suspensiones = await this.periodos.listarSuspensionesDeDocentes([
      ...new Set(horarios.map((horario) => horario.docenteId)),
    ]);
    const diasSinClases = new Map<
      string,
      {
        fecha: Date;
        motivo: string;
        grupo: { id: number; nombre: string } | null;
      }
    >();
    for (const suspension of suspensiones) {
      const fecha = parsearFechaClave(suspension.fecha) as Date;
      const horario = horarios.find(
        (item) =>
          item.docenteId === suspension.docenteId &&
          horarioAplicaEnFecha(item.dias, fecha),
      );
      if (horario && !diasSinClases.has(suspension.fecha)) {
        diasSinClases.set(suspension.fecha, {
          fecha,
          motivo: suspension.motivo,
          grupo: horario.grupo,
        });
      }
    }

    const items: any[] = sesiones
      .filter(
        (sesion) =>
          !diasSinClases.has(formatearFechaClave(sesion.fecha)) ||
          mapaAsistencias.has(sesion.id),
      )
      .map((sesion) => {
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
    for (const suspension of diasSinClases.values()) {
      items.push({
        id: null,
        sesionId: null,
        fecha: suspension.fecha,
        semanaClave: obtenerClaveSemana(suspension.fecha),
        unidad: null,
        unidadId: null,
        grupo: suspension.grupo,
        estado: null,
        observacion: null,
        suspendida: true,
        suspensionMotivo: suspension.motivo,
      });
    }
    return items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  async obtenerResumenAlumnoPorMateria(alumnoId: number) {
    const { alumno, materias } = await this.obtenerMateriasAlumno(alumnoId);

    if (!materias.length) return [];

    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        materiaId: { in: materias.map((materia) => materia.id) },
        ...(alumno.grupoId ? { grupoId: alumno.grupoId } : {}),
      },
      select: {
        id: true,
        materiaId: true,
        fecha: true,
        horaInicio: true,
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });

    const asistencias =
      sesiones.length > 0
        ? await this.prisma.asistencia.findMany({
            where: {
              alumnoId,
              claseSesionId: { in: sesiones.map((sesion) => sesion.id) },
            },
          })
        : [];

    const sesionesPorMateria = new Map<number, typeof sesiones>();
    sesiones.forEach((sesion) => {
      const actuales = sesionesPorMateria.get(sesion.materiaId) ?? [];
      actuales.push(sesion);
      sesionesPorMateria.set(sesion.materiaId, actuales);
    });

    const asistenciaPorSesionId = new Map(
      asistencias.map((asistencia) => [asistencia.claseSesionId, asistencia]),
    );

    return materias.map((materia) => {
      const sesionesMateria = sesionesPorMateria.get(materia.id) ?? [];
      const registrosMateria = sesionesMateria
        .map((sesion) => asistenciaPorSesionId.get(sesion.id))
        .filter(Boolean) as typeof asistencias;
      const resumen = this.resumirRegistros(registrosMateria);
      const grupo =
        (alumno.grupoId
          ? materia.grupos.find((item) => item.id === alumno.grupoId)
          : materia.grupos[0]) ?? null;

      return {
        materia: {
          id: materia.id,
          nombre: materia.nombre,
          clave: materia.clave,
          semestre: materia.semestre,
          docente: materia.docente,
          carrera: materia.carrera,
        },
        grupo,
        ultimaSesion: sesionesMateria[0]?.fecha ?? null,
        resumen: {
          ...resumen,
          totalSesiones: sesionesMateria.length,
          sinRegistro: Math.max(sesionesMateria.length - resumen.total, 0),
        },
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
      mes?: string;
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

    const rango = this.construirRangoDeFecha(filters);
    if (rango) Object.assign(where, rango);

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
            alumno: {
              select: {
                id: true,
                nombre: true,
                numeroControl: true,
                sexo: true,
              },
            },
          },
        },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });

    const suspensiones = await this.construirSuspensionesHistorial(
      actor,
      filters,
    );
    const clavesSuspendidas = new Set(
      suspensiones.map(
        (item) => `${item.docente.id}:${formatearFechaClave(item.fecha)}`,
      ),
    );
    const sesionesValidas = sesiones.filter(
      (sesion) =>
        !clavesSuspendidas.has(
          `${sesion.docenteId}:${formatearFechaClave(sesion.fecha)}`,
        ) || sesion.asistencias.length > 0,
    );
    const items: any[] = sesionesValidas.map((sesion) => {
      const resumen = this.resumirRegistros(sesion.asistencias);
      return {
        id: sesion.id,
        fecha: sesion.fecha,
        semanaClave: sesion.semanaClave,
        fueFueraDeHorario: sesion.fueFueraDeHorario,
        registroAtrasado: sesion.registroAtrasado,
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

    items.push(...suspensiones);
    items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    const registros = sesionesValidas.flatMap((sesion) => sesion.asistencias);
    const estadisticas = this.construirEstadisticasGlobales(registros);

    return {
      items,
      estadisticas,
    };
  }

  /**
   * Opciones dependientes para el historial. Los grupos no se infieren de
   * sesiones antiguas: deben llevar la materia, pertenecer al semestre de la
   * retícula y tener un horario activo con el docente consultado.
   */
  async obtenerFiltrosDisponibles(
    actor: Actor,
    filters: {
      materiaId?: number;
      grupoId?: number;
      docenteId?: number;
    },
  ) {
    const docenteId = actor.rol === 'ADMIN' ? filters.docenteId : actor.id;

    const materias = await this.prisma.materia.findMany({
      where: docenteId
        ? {
            OR: [
              {
                horarios: {
                  some: { docenteId, activo: true, grupoId: { not: null } },
                },
              },
              { claseSesiones: { some: { docenteId } } },
            ],
          }
        : undefined,
      select: { id: true, nombre: true, clave: true },
      orderBy: [{ nombre: 'asc' }, { clave: 'asc' }],
    });

    if (!filters.materiaId) {
      return {
        materias,
        grupos: [],
        unidades: [],
        fechasClase: [],
        mesesClase: [],
      };
    }

    const materia = await this.prisma.materia.findUnique({
      where: { id: filters.materiaId },
      select: {
        id: true,
        clave: true,
        unidades: {
          select: { id: true, nombre: true, orden: true },
          orderBy: { orden: 'asc' },
        },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');

    const materiaPermitida = materias.some((item) => item.id === materia.id);
    if (docenteId && !materiaPermitida) {
      throw new ForbiddenException('No impartes esta materia');
    }

    const candidatos = await this.prisma.grupo.findMany({
      where: {
        activo: true,
        materias: { some: { id: materia.id } },
        horarios: {
          some: {
            materiaId: materia.id,
            activo: true,
            ...(docenteId ? { docenteId } : {}),
          },
        },
      },
      select: {
        id: true,
        nombre: true,
        semestre: true,
        carreraId: true,
        periodo: true,
      },
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });

    const paresCarreraSemestre = Array.from(
      new Map(
        candidatos.map((grupo) => [
          `${grupo.carreraId}:${grupo.semestre}`,
          { carreraId: grupo.carreraId, semestre: grupo.semestre },
        ]),
      ).values(),
    );
    const entradasReticula = paresCarreraSemestre.length
      ? await this.prisma.reticulaMateria.findMany({
          where: {
            clave: materia.clave,
            activo: true,
            OR: paresCarreraSemestre,
          },
          select: { carreraId: true, semestre: true },
        })
      : [];
    const combinacionesValidas = new Set(
      entradasReticula.map(
        (entrada) => `${entrada.carreraId}:${entrada.semestre}`,
      ),
    );
    const grupos = candidatos.filter((grupo) =>
      combinacionesValidas.has(`${grupo.carreraId}:${grupo.semestre}`),
    );

    const grupoIdValido = filters.grupoId
      ? grupos.some((grupo) => grupo.id === filters.grupoId)
      : true;
    if (!grupoIdValido) {
      throw new BadRequestException(
        'El grupo no corresponde a la materia, la retícula y el docente',
      );
    }

    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        materiaId: materia.id,
        ...(docenteId ? { docenteId } : {}),
        ...(filters.grupoId ? { grupoId: filters.grupoId } : {}),
      },
      select: { fecha: true },
      orderBy: { fecha: 'asc' },
    });
    const suspendidas = await this.construirSuspensionesHistorial(actor, {
      materiaId: materia.id,
      grupoId: filters.grupoId,
      docenteId: filters.docenteId,
    });
    const fechasClase = Array.from(
      new Set([
        ...sesiones.map((sesion) => formatearFechaClave(sesion.fecha)),
        ...suspendidas.map((item) => formatearFechaClave(item.fecha)),
      ]),
    ).sort();
    const mesesClase = Array.from(
      new Set(fechasClase.map((fecha) => fecha.slice(0, 7))),
    ).sort();

    return {
      materias,
      grupos,
      unidades: materia.unidades,
      fechasClase,
      mesesClase,
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
        claseSesion: { select: { id: true, docenteId: true, fecha: true } },
      },
    });
    if (!asistencia) throw new NotFoundException('Asistencia no encontrada');
    this.validarAccesoSesion(actor, asistencia.claseSesion.docenteId);
    await this.validarNoSuspendida(
      asistencia.claseSesion.docenteId,
      asistencia.claseSesion.fecha,
    );

    return this.prisma.asistencia.update({
      where: { id: asistenciaId },
      data: {
        estado: dto.estado,
        observacion: dto.observacion,
        editadaPorId: actor.id,
      },
      include: {
        alumno: {
          select: { id: true, nombre: true, numeroControl: true, sexo: true },
        },
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
      mes?: string;
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

    const rango = this.construirRangoDeFecha(filters);
    if (rango) Object.assign(where, rango);

    const sesiones = await this.prisma.claseSesion.findMany({
      where,
      include: {
        grupo: { select: { id: true, nombre: true } },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    const suspensiones = filters.sesionId
      ? []
      : await this.construirSuspensionesHistorial(actor, {
          ...filters,
          materiaId,
        });
    const sesionesReporte: any[] = [
      ...sesiones.filter(
        (sesion) =>
          !suspensiones.some(
            (item) =>
              item.docente.id === sesion.docenteId &&
              formatearFechaClave(item.fecha) ===
                formatearFechaClave(sesion.fecha) &&
              item.materia.id === sesion.materiaId &&
              (item.grupo?.id ?? null) === sesion.grupoId,
          ),
      ),
      ...suspensiones.map((item) => ({
        id: item.id,
        fecha: item.fecha,
        grupoId: item.grupo?.id ?? null,
        grupo: item.grupo,
        suspensionMotivo: item.suspensionMotivo,
      })),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const sesionIds = sesiones.map((sesion) => sesion.id);
    const asistencias =
      sesionIds.length > 0
        ? await this.prisma.asistencia.findMany({
            where: { claseSesionId: { in: sesionIds } },
            include: {
              alumno: {
                select: {
                  id: true,
                  nombre: true,
                  numeroControl: true,
                  sexo: true,
                },
              },
            },
          })
        : [];

    const alumnosMapa = new Map<
      number,
      {
        id: number;
        nombre: string;
        numeroControl: string | null;
        sexo: Sexo | null;
      }
    >();

    asistencias.forEach((asistencia) => {
      alumnosMapa.set(asistencia.alumno.id, {
        id: asistencia.alumno.id,
        nombre: asistencia.alumno.nombre,
        numeroControl: asistencia.alumno.numeroControl,
        sexo: asistencia.alumno.sexo,
      });
    });

    if (filters.grupoId || sesionesReporte.some((sesion) => sesion.grupoId)) {
      const grupoIds = Array.from(
        new Set([
          ...(filters.grupoId ? [filters.grupoId] : []),
          ...(sesionesReporte
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
            alumno: {
              select: {
                id: true,
                nombre: true,
                numeroControl: true,
                sexo: true,
              },
            },
          },
        });
        formales.forEach((inscripcion) => {
          alumnosMapa.set(inscripcion.alumno.id, {
            id: inscripcion.alumno.id,
            nombre: inscripcion.alumno.nombre,
            numeroControl: inscripcion.alumno.numeroControl,
            sexo: inscripcion.alumno.sexo,
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
          ? obtenerClaveSemana(parsearFechaClave(filters.semana) as Date)
          : null,
        mes: filters.mes ?? null,
        unidadId: filters.unidadId ?? null,
      },
      sesiones: sesionesReporte,
      alumnos: Array.from(alumnosMapa.values()).sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es'),
      ),
      asistencias,
    };
  }

  private async validarNoSuspendida(docenteId: number, fecha: Date) {
    const suspension = await this.periodos.obtenerSuspension(docenteId, fecha);
    if (suspension) {
      throw new ConflictException(
        `No se pasa lista este día: ${suspension.motivo}`,
      );
    }
  }

  private async construirSuspensionesHistorial(
    actor: Actor,
    filters: {
      materiaId?: number;
      grupoId?: number;
      fecha?: string;
      semana?: string;
      mes?: string;
      unidadId?: number;
      docenteId?: number;
    },
  ) {
    const rango = this.construirRangoDeFecha(filters) as {
      fecha?: { gte: Date; lte: Date };
    } | null;
    const semanaInicio =
      !filters.fecha && filters.semana
        ? (parsearFechaClave(
            obtenerClaveSemana(parsearFechaClave(filters.semana) as Date),
          ) as Date)
        : null;
    const fechaFiltro = rango?.fecha
      ? {
          gte: formatearFechaClave(rango.fecha.gte),
          lte: formatearFechaClave(rango.fecha.lte),
        }
      : semanaInicio
        ? {
            gte: formatearFechaClave(semanaInicio),
            lte: formatearFechaClave(sumarDias(semanaInicio, 6)),
          }
        : null;
    // Primero los horarios que caen en el filtro; de sus docentes salen las
    // suspensiones. Así una institucional se refleja en cada materia afectada.
    const docenteScope = actor.rol === 'ADMIN' ? filters.docenteId : actor.id;
    const horarios = await this.prisma.horarioMateria.findMany({
      where: {
        activo: true,
        ...(docenteScope ? { docenteId: docenteScope } : {}),
        ...(filters.materiaId ? { materiaId: filters.materiaId } : {}),
        ...(filters.grupoId ? { grupoId: filters.grupoId } : {}),
      },
      include: {
        materia: { select: { id: true, nombre: true, clave: true } },
        grupo: { select: { id: true, nombre: true } },
        docente: { select: { id: true, nombre: true } },
        aula: { select: { id: true, nombre: true } },
      },
    });
    const suspensiones = await this.periodos.listarSuspensionesDeDocentes(
      [...new Set(horarios.map((horario) => horario.docenteId))],
      fechaFiltro ?? undefined,
    );
    if (!suspensiones.length) return [];

    const vistos = new Set<string>();
    return suspensiones.flatMap((suspension) => {
      const fecha = parsearFechaClave(suspension.fecha) as Date;
      return horarios
        .filter(
          (horario) =>
            horario.docenteId === suspension.docenteId &&
            horarioAplicaEnFecha(horario.dias, fecha),
        )
        .filter((horario) => {
          const clave = `${suspension.docenteId}:${suspension.fecha}:${horario.materiaId}:${horario.grupoId}`;
          if (vistos.has(clave)) return false;
          vistos.add(clave);
          return true;
        })
        .map((horario) => ({
          id: `suspension-${suspension.id}-${suspension.docenteId}-${horario.materiaId}-${horario.grupoId ?? 'sin-grupo'}`,
          fecha,
          semanaClave: obtenerClaveSemana(fecha),
          fueFueraDeHorario: false,
          registroAtrasado: false,
          activa: false,
          suspendida: true,
          suspensionInstitucional: suspension.institucional,
          suspensionMotivo: suspension.motivo,
          materia: horario.materia,
          grupo: horario.grupo,
          docente: horario.docente,
          aula: horario.aula,
          unidad: null,
          resumen: {
            asistencias: 0,
            faltas: 0,
            retardos: 0,
            justificados: 0,
            total: 0,
            porcentaje: 0,
          },
        }));
    });
  }

  /**
   * Acota las sesiones a un día, una semana o un mes. Se excluyen entre sí: el
   * día es el más específico y el mes el más amplio. Las claves llegan como
   * `YYYY-MM-DD` / `YYYY-MM` y se interpretan en hora local, porque
   * `new Date(clave)` las leería como UTC y en husos negativos devolvería el
   * día anterior.
   */
  private construirRangoDeFecha(filters: {
    fecha?: string;
    semana?: string;
    mes?: string;
  }): Record<string, unknown> | null {
    if (filters.fecha) {
      const fecha = parsearFechaClave(filters.fecha);
      if (!fecha) throw new BadRequestException('Fecha inválida');
      return {
        fecha: {
          gte: obtenerInicioDelDia(fecha),
          lte: obtenerFinDelDia(fecha),
        },
      };
    }

    if (filters.semana) {
      const semana = parsearFechaClave(filters.semana);
      if (!semana) throw new BadRequestException('Semana inválida');
      return { semanaClave: obtenerClaveSemana(semana) };
    }

    if (filters.mes) {
      const mes = parsearMesClave(filters.mes);
      if (!mes) throw new BadRequestException('Mes inválido');
      return { fecha: { gte: mes.inicio, lte: mes.fin } };
    }

    return null;
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

    // Puede pasar lista quien pertenece al grupo de la sesión y también quien
    // está inscrito en la materia aunque no forme parte del grupo, que es como
    // el docente agrega alumnos a su clase.
    const [alumnosGrupo, inscritos] = await Promise.all([
      sesion.grupoId
        ? this.prisma.usuario.findMany({
            where: { grupoId: sesion.grupoId, rol: 'ALUMNO', activo: true },
            select: { id: true },
          })
        : Promise.resolve([]),
      this.prisma.inscripcion.findMany({
        where: {
          materiaId: sesion.materiaId,
          estado: 'ACEPTADA',
          alumno: { rol: 'ALUMNO', activo: true },
        },
        select: { alumnoId: true },
      }),
    ]);

    return Array.from(
      new Set([
        ...alumnosGrupo.map((alumno) => alumno.id),
        ...inscritos.map((inscripcion) => inscripcion.alumnoId),
        ...registradosIds,
      ]),
    );
  }

  private async obtenerMateriasAlumno(alumnoId: number) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { carreraId: true, semestre: true, grupoId: true },
    });

    if (!alumno) {
      throw new NotFoundException('Alumno no encontrado');
    }

    if (alumno.grupoId) {
      const grupo = await this.prisma.grupo.findUnique({
        where: { id: alumno.grupoId },
        include: {
          materias: {
            include: {
              docente: {
                select: {
                  id: true,
                  nombre: true,
                  email: true,
                },
              },
              carrera: { select: { id: true, nombre: true } },
              grupos: {
                select: {
                  id: true,
                  nombre: true,
                  semestre: true,
                  seccion: true,
                  periodo: true,
                },
              },
            },
            orderBy: { nombre: 'asc' },
          },
        },
      });

      return { alumno, materias: grupo?.materias ?? [] };
    }

    const where: Record<string, unknown> = {};
    if (alumno.carreraId) Object.assign(where, { carreraId: alumno.carreraId });
    if (alumno.semestre) Object.assign(where, { semestre: alumno.semestre });

    const materias = await this.prisma.materia.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: {
        docente: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
        carrera: { select: { id: true, nombre: true } },
        grupos: {
          select: {
            id: true,
            nombre: true,
            semestre: true,
            seccion: true,
            periodo: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return { alumno, materias };
  }

  private construirResumenAlumnos(
    registros: Array<{
      alumnoId: number;
      estado: EstadoAsistencia;
      alumno: { id: number; nombre: string; numeroControl: string | null };
    }>,
  ): ResumenAlumno[] {
    const mapa = new Map<number, Omit<ResumenAlumno, 'porcentaje'>>();

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
      if (!actual) continue;
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

  private resumirRegistros(
    registros: Array<{ estado: EstadoAsistencia }>,
  ): ResumenRegistros {
    const resumen: ResumenRegistros = {
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
