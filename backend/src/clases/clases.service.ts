import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAsistencia, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { IniciarClaseDto } from './dto/iniciar-clase.dto';
import { RegistrarClaseAtrasadaDto } from './dto/registrar-clase-atrasada.dto';
import { MarcarAsistenciaAtrasadasDto } from './dto/marcar-asistencia-atrasadas.dto';
import {
  combinarFechaYHora,
  convertirHoraAMinutos,
  convertirFechaAMinutos,
  estaDentroDelHorario,
  formatearFechaClave,
  horarioAplicaEnFecha,
  mismoDia,
  obtenerClaveSemana,
  obtenerDiaCanonico,
  obtenerFinDelDia,
  obtenerInicioDelDia,
  parsearFechaClave,
  sumarDias,
} from './clases.utils';
import {
  getAcademicPeriodStart,
  getCurrentAcademicPeriod,
} from '../common/periodo.util';

/** Tope de seguridad hacia atrás, por si el periodo empezó hace mucho. */
const DIAS_MAXIMOS_ATRASO = 120;

@Injectable()
export class ClasesService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  async iniciar(docenteId: number, dto: IniciarClaseDto) {
    const referencia = dto.fecha ? new Date(dto.fecha) : new Date();
    const horario = await this.prisma.horarioMateria.findUnique({
      where: { id: dto.horarioId },
      include: {
        materia: {
          include: {
            unidades: {
              orderBy: { orden: 'asc' },
            },
          },
        },
        grupo: {
          select: { id: true, nombre: true, periodo: true, semestre: true },
        },
        aula: {
          select: { id: true, nombre: true, edificio: true },
        },
      },
    });

    if (!horario || !horario.activo) {
      throw new NotFoundException('Horario no encontrado');
    }
    if (horario.docenteId !== docenteId) {
      throw new ForbiddenException('No puedes iniciar esta clase');
    }
    if (!horario.grupoId) {
      throw new BadRequestException('El horario no tiene un grupo asignado');
    }

    const unidadActiva = horario.materia.unidades.find(
      (unidad) => unidad.status === 'ACTIVA',
    );
    if (!unidadActiva) {
      throw new ConflictException('No hay una unidad activa para esta materia');
    }

    const inicioDia = obtenerInicioDelDia(referencia);
    const finDia = obtenerFinDelDia(referencia);

    const claseActiva = await this.prisma.claseSesion.findFirst({
      where: { docenteId, activa: true },
    });
    if (claseActiva) {
      throw new ConflictException('Ya tienes una clase activa');
    }

    const sesionExistente = await this.prisma.claseSesion.findFirst({
      where: {
        docenteId,
        materiaId: horario.materiaId,
        grupoId: horario.grupoId,
        fecha: { gte: inicioDia, lte: finDia },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (sesionExistente) {
      throw new ConflictException(
        'Ya existe una sesión registrada para esta materia y grupo en esta fecha',
      );
    }

    const dentroDeHorario = estaDentroDelHorario(
      referencia,
      horario.horaInicio,
      horario.horaFin,
    );
    const alumnoIds = await this.obtenerAlumnoIdsFormales(
      horario.materiaId,
      horario.grupoId,
    );

    const sesion = await this.prisma.claseSesion.create({
      data: {
        materiaId: horario.materiaId,
        docenteId,
        horarioMateriaId: horario.id,
        grupoId: horario.grupoId,
        unidadId: unidadActiva.id,
        fecha: referencia,
        semanaClave: obtenerClaveSemana(referencia),
        horaInicio: referencia,
        unidad: unidadActiva.orden,
        activa: true,
        fueFueraDeHorario: !dentroDeHorario,
        notificacionEnviada: dentroDeHorario && alumnoIds.length > 0,
      },
      include: {
        materia: { select: { id: true, nombre: true, clave: true } },
        grupo: { select: { id: true, nombre: true } },
        horarioMateria: {
          include: {
            aula: { select: { id: true, nombre: true } },
          },
        },
        unidadRef: {
          select: { id: true, nombre: true, orden: true, status: true },
        },
      },
    });

    if (dentroDeHorario && alumnoIds.length > 0) {
      await this.notificaciones.crearParaVarios(alumnoIds, {
        tipo: TipoNotificacion.CLASE_INICIADA,
        titulo: `Clase iniciada: ${horario.materia.nombre}`,
        mensaje: `La clase de ${horario.materia.nombre} ha iniciado.`,
        referenciaId: horario.materiaId,
        referenciaTipo: 'Materia',
      });
    }

    if (!dentroDeHorario) {
      await this.notificaciones.crearParaAdmins({
        tipo: TipoNotificacion.ALERTA_ADMIN,
        titulo: 'Clase iniciada fuera de horario',
        mensaje: `Se inició ${horario.materia.nombre} fuera del horario programado.`,
        referenciaId: horario.materiaId,
        referenciaTipo: 'Asistencias',
      });
    }

    return {
      ...sesion,
      advertencia: dentroDeHorario
        ? null
        : 'La clase se inició fuera del horario programado. Se permitirá la captura, pero no se mostrará como clase en línea.',
    };
  }

  async finalizar(sesionId: number, docenteId: number) {
    const sesion = await this.prisma.claseSesion.findUnique({
      where: { id: sesionId },
      include: {
        materia: { select: { id: true, nombre: true } },
        grupo: { select: { id: true, nombre: true } },
      },
    });

    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    if (sesion.docenteId !== docenteId) throw new ForbiddenException();
    if (!sesion.activa)
      throw new ConflictException('La clase ya está finalizada');

    const alumnoIds = sesion.grupoId
      ? await this.obtenerAlumnoIdsFormales(sesion.materiaId, sesion.grupoId)
      : [];

    const conAsistencia = await this.prisma.asistencia.findMany({
      where: { claseSesionId: sesionId },
      select: { alumnoId: true },
    });
    const idsConAsistencia = new Set(
      conAsistencia.map((asistencia) => asistencia.alumnoId),
    );

    const faltantes = alumnoIds.filter(
      (alumnoId) => !idsConAsistencia.has(alumnoId),
    );
    if (faltantes.length > 0) {
      await this.prisma.asistencia.createMany({
        data: faltantes.map((alumnoId) => ({
          claseSesionId: sesionId,
          alumnoId,
          estado: 'FALTA',
          editadaPorId: docenteId,
        })),
        skipDuplicates: true,
      });
    }

    const actualizada = await this.prisma.claseSesion.update({
      where: { id: sesionId },
      data: { horaFin: new Date(), activa: false },
      include: {
        materia: { select: { id: true, nombre: true, clave: true } },
        grupo: { select: { id: true, nombre: true } },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
      },
    });

    if (!actualizada.fueFueraDeHorario && alumnoIds.length > 0) {
      await this.notificaciones.crearParaVarios(alumnoIds, {
        tipo: TipoNotificacion.CLASE_FINALIZADA,
        titulo: `Clase finalizada: ${actualizada.materia.nombre}`,
        mensaje: `${actualizada.grupo?.nombre ?? 'Grupo'} ha finalizado la sesión del día`,
        referenciaId: actualizada.materia.id,
        referenciaTipo: 'Materia',
      });
    }

    return actualizada;
  }

  async obtenerActiva(materiaId: number, docenteId: number) {
    return this.prisma.claseSesion.findFirst({
      where: { materiaId, docenteId, activa: true },
      include: {
        grupo: { select: { id: true, nombre: true } },
        horarioMateria: {
          include: { aula: { select: { id: true, nombre: true } } },
        },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
      },
      orderBy: { horaInicio: 'desc' },
    });
  }

  async obtenerHistorial(materiaId: number, docenteId: number) {
    return this.prisma.claseSesion.findMany({
      where: { materiaId, docenteId },
      orderBy: { fecha: 'desc' },
      include: {
        grupo: { select: { id: true, nombre: true } },
        unidadRef: { select: { id: true, nombre: true, orden: true } },
        _count: { select: { asistencias: true } },
      },
    });
  }

  async obtenerClaseActualDocente(docenteId: number) {
    const panel = await this.obtenerPanelDocente(docenteId);
    return panel.claseActual ?? panel.proximaClase ?? null;
  }

  async obtenerClasesHoyDocente(docenteId: number) {
    const panel = await this.obtenerPanelDocente(docenteId);
    return panel.clasesHoy;
  }

  async obtenerPanelDocente(docenteId: number) {
    const referencia = new Date();
    const inicioDia = obtenerInicioDelDia(referencia);
    const finDia = obtenerFinDelDia(referencia);

    const horarios = await this.prisma.horarioMateria.findMany({
      where: { docenteId, activo: true },
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
            clave: true,
            unidades: {
              orderBy: { orden: 'asc' },
              select: {
                id: true,
                nombre: true,
                orden: true,
                status: true,
                fechaInicio: true,
                fechaFin: true,
              },
            },
          },
        },
        grupo: {
          select: { id: true, nombre: true, periodo: true, semestre: true },
        },
        aula: {
          select: { id: true, nombre: true, edificio: true },
        },
      },
    });

    const horariosHoy = horarios
      .filter((horario) => horarioAplicaEnFecha(horario.dias, referencia))
      .sort(
        (a, b) =>
          convertirHoraAMinutos(a.horaInicio) -
          convertirHoraAMinutos(b.horaInicio),
      );

    const sesionesHoy = await this.prisma.claseSesion.findMany({
      where: {
        docenteId,
        fecha: { gte: inicioDia, lte: finDia },
      },
      include: {
        unidadRef: {
          select: { id: true, nombre: true, orden: true, status: true },
        },
      },
      orderBy: { horaInicio: 'asc' },
    });

    const ahoraMinutos = convertirFechaAMinutos(referencia);
    const clasesHoy = horariosHoy.map((horario) => {
      const sesion = sesionesHoy.find(
        (item) =>
          (item.horarioMateriaId && item.horarioMateriaId === horario.id) ||
          (!item.horarioMateriaId &&
            item.materiaId === horario.materiaId &&
            item.grupoId === horario.grupoId &&
            mismoDia(item.fecha, referencia)),
      );

      const unidadActiva =
        horario.materia.unidades.find((unidad) => unidad.status === 'ACTIVA') ??
        null;
      const horaInicioMinutos = convertirHoraAMinutos(horario.horaInicio);
      const horaFinMinutos = convertirHoraAMinutos(horario.horaFin);
      const estaAhora =
        ahoraMinutos >= horaInicioMinutos && ahoraMinutos <= horaFinMinutos;

      let estado = 'PROXIMA';
      if (sesion?.activa) {
        estado = sesion.fueFueraDeHorario ? 'FUERA_DE_HORARIO' : 'EN_CURSO';
      } else if (sesion?.horaFin) {
        estado = 'FINALIZADA';
      } else if (estaAhora) {
        estado = 'PROGRAMADA_AHORA';
      } else if (ahoraMinutos > horaFinMinutos) {
        estado = 'PASADA';
      }

      return {
        horarioId: horario.id,
        materiaId: horario.materiaId,
        grupoId: horario.grupoId,
        aulaId: horario.aulaId,
        materia: horario.materia,
        grupo: horario.grupo,
        aula: horario.aula,
        dias: horario.dias,
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        dentroDeHorario: estaAhora,
        unidadActiva,
        sesion: sesion ?? null,
        estado,
      };
    });

    const claseActual =
      clasesHoy.find((clase) => clase.sesion?.activa) ??
      clasesHoy.find((clase) => clase.dentroDeHorario) ??
      null;

    const proximaClase =
      clasesHoy.find(
        (clase) =>
          convertirHoraAMinutos(clase.horaInicio) > ahoraMinutos &&
          !clase.sesion?.activa,
      ) ?? null;

    return {
      fecha: formatearFechaClave(referencia),
      claseActual,
      proximaClase,
      clasesHoy,
    };
  }

  /**
   * Primera fecha capturable: el inicio del periodo académico, acotado por el
   * tope de seguridad de {@link DIAS_MAXIMOS_ATRASO} días.
   */
  private obtenerFechaMinimaAtraso(hoy: Date) {
    const inicioPeriodo = obtenerInicioDelDia(getAcademicPeriodStart(hoy));
    const tope = sumarDias(hoy, -DIAS_MAXIMOS_ATRASO);
    return inicioPeriodo > tope ? inicioPeriodo : tope;
  }

  /**
   * Unidad a la que pertenece una clase de esa fecha: la que ya estaba iniciada
   * y cubre el día; si ninguna lo cubre (la fecha es anterior a que el docente
   * empezara a registrar unidades) se usa la unidad activa, para que la
   * asistencia quede asociada a algo. `null` cuando la materia no tiene
   * ninguna unidad iniciada todavía.
   */
  private resolverUnidadParaFecha<
    T extends {
      orden: number;
      status: string;
      fechaInicio: Date | null;
      fechaFin: Date | null;
    },
  >(unidades: T[], fecha: Date): T | null {
    const inicioDia = obtenerInicioDelDia(fecha);
    const finDia = obtenerFinDelDia(fecha);
    const iniciadas = unidades
      .filter(
        (unidad) =>
          unidad.fechaInicio !== null &&
          (unidad.status === 'ACTIVA' || unidad.status === 'FINALIZADA'),
      )
      .sort((a, b) => a.orden - b.orden);

    const contiene = iniciadas.find(
      (unidad) =>
        (unidad.fechaInicio as Date) <= finDia &&
        (!unidad.fechaFin || unidad.fechaFin >= inicioDia),
    );
    if (contiene) return contiene;

    const activa = iniciadas.find((unidad) => unidad.status === 'ACTIVA');
    if (activa) return activa;

    // La fecha cae después de que terminó la última unidad y no hay ninguna
    // activa: se asocia a la última que estuvo vigente antes de ese día.
    const previas = iniciadas.filter(
      (unidad) => (unidad.fechaInicio as Date) <= finDia,
    );
    if (previas.length) return previas[previas.length - 1];

    // La fecha es anterior a todas: la primera unidad iniciada es la más cercana.
    return iniciadas[0] ?? null;
  }

  /**
   * Clases del horario del docente que ya ocurrieron en el periodo en curso y
   * siguen sin pase de lista: o nunca se abrió la sesión, o se abrió pero no se
   * guardó ningún registro. Son las fechas para las que se habilita la captura
   * de asistencia atrasada.
   */
  async obtenerClasesAtrasadas(docenteId: number) {
    const ahora = new Date();
    const hoy = obtenerInicioDelDia(ahora);
    const ahoraMinutos = convertirFechaAMinutos(ahora);
    const fechaMinima = this.obtenerFechaMinimaAtraso(hoy);

    const horarios = await this.prisma.horarioMateria.findMany({
      where: { docenteId, activo: true, grupoId: { not: null } },
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
            clave: true,
            unidades: {
              orderBy: { orden: 'asc' },
              select: {
                id: true,
                nombre: true,
                orden: true,
                status: true,
                fechaInicio: true,
                fechaFin: true,
              },
            },
          },
        },
        grupo: {
          select: { id: true, nombre: true, periodo: true, semestre: true },
        },
        aula: { select: { id: true, nombre: true, edificio: true } },
      },
    });

    type Candidato = {
      horario: (typeof horarios)[number];
      unidad: (typeof horarios)[number]['materia']['unidades'][number] | null;
      fecha: Date;
    };

    // Una misma materia y grupo sólo admiten una sesión por fecha, así que dos
    // horarios que coincidan en el mismo día no generan dos pendientes.
    const candidatos = new Map<string, Candidato>();
    let fechaMasAntigua: Date | null = null;

    for (const horario of horarios) {
      for (let dia = fechaMinima; dia <= hoy; dia = sumarDias(dia, 1)) {
        if (!horarioAplicaEnFecha(horario.dias, dia)) continue;
        // La clase de hoy sólo se considera atrasada cuando ya terminó.
        if (
          dia.getTime() === hoy.getTime() &&
          ahoraMinutos <= convertirHoraAMinutos(horario.horaFin)
        )
          continue;

        const clave = `${horario.materiaId}-${horario.grupoId}-${formatearFechaClave(dia)}`;
        if (candidatos.has(clave)) continue;

        candidatos.set(clave, {
          horario,
          unidad: this.resolverUnidadParaFecha(horario.materia.unidades, dia),
          fecha: dia,
        });
        if (!fechaMasAntigua || dia < fechaMasAntigua) fechaMasAntigua = dia;
      }
    }

    if (!fechaMasAntigua) return [];

    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        docenteId,
        fecha: { gte: fechaMasAntigua, lte: obtenerFinDelDia(hoy) },
      },
      select: {
        id: true,
        materiaId: true,
        grupoId: true,
        fecha: true,
        activa: true,
        registroAtrasado: true,
        _count: { select: { asistencias: true } },
      },
    });

    return Array.from(candidatos.values())
      .map((candidato) => ({
        ...candidato,
        sesion: sesiones.find(
          (item) =>
            item.materiaId === candidato.horario.materiaId &&
            item.grupoId === candidato.horario.grupoId &&
            mismoDia(item.fecha, candidato.fecha),
        ),
      }))
      .filter(({ sesion }) => !sesion || sesion._count.asistencias === 0)
      .map(({ horario, unidad, fecha, sesion }) => ({
        horarioId: horario.id,
        materiaId: horario.materiaId,
        grupoId: horario.grupoId,
        aulaId: horario.aulaId,
        materia: {
          id: horario.materia.id,
          nombre: horario.materia.nombre,
          clave: horario.materia.clave,
        },
        grupo: horario.grupo,
        aula: horario.aula,
        fecha: formatearFechaClave(fecha),
        semanaClave: obtenerClaveSemana(fecha),
        dia: obtenerDiaCanonico(fecha),
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        unidad,
        estado: sesion ? 'SIN_CAPTURA' : 'SIN_SESION',
        sesion: sesion
          ? {
              id: sesion.id,
              activa: sesion.activa,
              registroAtrasado: sesion.registroAtrasado,
            }
          : null,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  /**
   * Abre una sesión ya cerrada para una clase pasada del horario del docente,
   * para que capture la lista que no tomó en su momento. No notifica a los
   * alumnos ni prellena faltas: la lista la guarda el docente.
   */
  /**
   * Valida que esa fecha sea una clase atrasada legítima del docente y devuelve
   * todo lo necesario para abrir la sesión, incluida la que ya exista.
   */
  private async resolverClaseAtrasada(
    docenteId: number,
    horarioId: number,
    fechaClave: string,
  ) {
    const fecha = parsearFechaClave(fechaClave);
    if (!fecha) throw new BadRequestException('Fecha inválida');

    const horario = await this.prisma.horarioMateria.findUnique({
      where: { id: horarioId },
      include: {
        materia: {
          include: { unidades: { orderBy: { orden: 'asc' } } },
        },
        grupo: { select: { id: true, nombre: true } },
      },
    });

    if (!horario || !horario.activo) {
      throw new NotFoundException('Horario no encontrado');
    }
    if (horario.docenteId !== docenteId) {
      throw new ForbiddenException('No puedes registrar esta clase');
    }
    if (!horario.grupoId) {
      throw new BadRequestException('El horario no tiene un grupo asignado');
    }

    const ahora = new Date();
    const hoy = obtenerInicioDelDia(fecha);
    const inicioHoy = obtenerInicioDelDia(ahora);

    if (hoy > inicioHoy) {
      throw new BadRequestException(
        'No puedes registrar asistencia de una clase que todavía no ocurre',
      );
    }
    if (
      hoy.getTime() === inicioHoy.getTime() &&
      convertirFechaAMinutos(ahora) <= convertirHoraAMinutos(horario.horaFin)
    ) {
      throw new BadRequestException(
        'La clase de hoy aún no termina; inicia la clase desde el panel',
      );
    }
    if (hoy < this.obtenerFechaMinimaAtraso(inicioHoy)) {
      throw new BadRequestException(
        'Esa fecha está fuera del periodo académico en curso',
      );
    }
    if (!horarioAplicaEnFecha(horario.dias, fecha)) {
      throw new BadRequestException(
        'Ese día no tienes esta clase programada en tu horario',
      );
    }

    const finDia = obtenerFinDelDia(fecha);
    const unidad = this.resolverUnidadParaFecha(
      horario.materia.unidades,
      fecha,
    );
    if (!unidad) {
      throw new ConflictException(
        'La materia no tiene ninguna unidad iniciada: inicia una para poder capturar la asistencia',
      );
    }

    const sesionExistente = await this.prisma.claseSesion.findFirst({
      where: {
        docenteId,
        materiaId: horario.materiaId,
        grupoId: horario.grupoId,
        fecha: { gte: hoy, lte: finDia },
      },
    });

    return { horario, fecha, unidad, sesionExistente };
  }

  /** Crea la sesión cerrada de una clase pasada. No notifica: eso lo hace quien llama. */
  private async crearSesionAtrasada(
    docenteId: number,
    horario: {
      id: number;
      materiaId: number;
      grupoId: number | null;
      horaInicio: string;
      horaFin: string;
    },
    fecha: Date,
    unidad: { id: number; orden: number },
  ) {
    const horaInicio = combinarFechaYHora(fecha, horario.horaInicio);
    const horaFin = combinarFechaYHora(fecha, horario.horaFin);

    return this.prisma.claseSesion.create({
      data: {
        materiaId: horario.materiaId,
        docenteId,
        horarioMateriaId: horario.id,
        grupoId: horario.grupoId,
        unidadId: unidad.id,
        fecha: horaInicio,
        semanaClave: obtenerClaveSemana(fecha),
        horaInicio,
        horaFin,
        unidad: unidad.orden,
        activa: false,
        fueFueraDeHorario: false,
        registroAtrasado: true,
        notificacionEnviada: false,
      },
      include: {
        materia: { select: { id: true, nombre: true, clave: true } },
        grupo: { select: { id: true, nombre: true } },
        unidadRef: {
          select: { id: true, nombre: true, orden: true, status: true },
        },
      },
    });
  }

  /**
   * Abre una sesión ya cerrada para una clase pasada del horario del docente,
   * para que capture la lista que no tomó en su momento. No notifica a los
   * alumnos ni prellena faltas: la lista la guarda el docente.
   */
  async registrarClaseAtrasada(
    docenteId: number,
    dto: RegistrarClaseAtrasadaDto,
  ) {
    const { horario, fecha, unidad, sesionExistente } =
      await this.resolverClaseAtrasada(docenteId, dto.horarioId, dto.fecha);

    if (sesionExistente) {
      throw new ConflictException(
        'Ya existe una sesión de esa fecha: ábrela para capturar la lista',
      );
    }

    const sesion = await this.crearSesionAtrasada(
      docenteId,
      horario,
      fecha,
      unidad,
    );

    await this.notificaciones.crearParaAdmins({
      tipo: TipoNotificacion.ALERTA_ADMIN,
      titulo: 'Asistencia atrasada',
      mensaje: `Se registró una clase atrasada de ${horario.materia.nombre} del ${formatearFechaClave(fecha)}.`,
      referenciaId: sesion.id,
      referenciaTipo: 'Asistencias',
    });

    return sesion;
  }

  /**
   * Marca un mismo estado (por defecto asistencia) a todos los alumnos de varias
   * clases atrasadas de una sola vez. Abre la sesión que falte y reutiliza la que
   * ya exista. Las clases que no se puedan procesar se devuelven en `omitidas`
   * con el motivo, en vez de abortar todo el lote.
   */
  async marcarAsistenciaClasesAtrasadas(
    docenteId: number,
    dto: MarcarAsistenciaAtrasadasDto,
  ) {
    const estado = dto.estado ?? EstadoAsistencia.ASISTENCIA;
    const procesadas: Array<{
      sesionId: number;
      horarioId: number;
      fecha: string;
      materia: string;
      grupo: string | null;
      alumnos: number;
      sesionNueva: boolean;
    }> = [];
    const omitidas: Array<{
      horarioId: number;
      fecha: string;
      motivo: string;
    }> = [];
    let alumnosMarcados = 0;

    for (const clase of dto.clases) {
      try {
        const { horario, fecha, unidad, sesionExistente } =
          await this.resolverClaseAtrasada(
            docenteId,
            clase.horarioId,
            clase.fecha,
          );

        const alumnoIds = await this.obtenerAlumnoIdsFormales(
          horario.materiaId,
          horario.grupoId as number,
        );
        if (!alumnoIds.length) {
          omitidas.push({
            horarioId: clase.horarioId,
            fecha: clase.fecha,
            motivo: 'El grupo no tiene alumnos inscritos en la materia',
          });
          continue;
        }

        const sesion =
          sesionExistente ??
          (await this.crearSesionAtrasada(docenteId, horario, fecha, unidad));

        // createMany + updateMany deja el lote en dos consultas por sesión y es
        // idempotente: repetir la acción no duplica ni deja estados a medias.
        await this.prisma.asistencia.createMany({
          data: alumnoIds.map((alumnoId) => ({
            claseSesionId: sesion.id,
            alumnoId,
            estado,
            editadaPorId: docenteId,
          })),
          skipDuplicates: true,
        });
        await this.prisma.asistencia.updateMany({
          where: { claseSesionId: sesion.id, alumnoId: { in: alumnoIds } },
          data: { estado, editadaPorId: docenteId },
        });

        alumnosMarcados += alumnoIds.length;
        procesadas.push({
          sesionId: sesion.id,
          horarioId: clase.horarioId,
          fecha: clase.fecha,
          materia: horario.materia.nombre,
          grupo: horario.grupo?.nombre ?? null,
          alumnos: alumnoIds.length,
          sesionNueva: !sesionExistente,
        });
      } catch (error) {
        omitidas.push({
          horarioId: clase.horarioId,
          fecha: clase.fecha,
          motivo:
            error instanceof HttpException
              ? (error.getResponse() as { message?: string })?.message ||
                error.message
              : 'No se pudo procesar esta clase',
        });
      }
    }

    // Un solo aviso por lote, no uno por clase.
    if (procesadas.length) {
      await this.notificaciones.crearParaAdmins({
        tipo: TipoNotificacion.ALERTA_ADMIN,
        titulo: 'Asistencias atrasadas capturadas en lote',
        mensaje: `Se marcó ${estado.toLowerCase()} a ${alumnosMarcados} alumnos en ${procesadas.length} clases atrasadas.`,
        referenciaTipo: 'Asistencias',
      });
    }

    return {
      estado,
      totalSolicitadas: dto.clases.length,
      procesadas,
      omitidas,
      alumnosMarcados,
    };
  }

  async obtenerClasesActivasAlumno(alumnoId: number) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: { grupoId: true },
    });
    if (!alumno?.grupoId) return [];

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        alumnoId,
        estado: 'ACEPTADA',
        periodo: getCurrentAcademicPeriod(),
      },
      select: { materiaId: true },
    });
    const materiaIds = inscripciones.map(
      (inscripcion) => inscripcion.materiaId,
    );
    if (!materiaIds.length) return [];

    return this.prisma.claseSesion.findMany({
      where: {
        materiaId: { in: materiaIds },
        grupoId: alumno.grupoId,
        activa: true,
        fueFueraDeHorario: false,
      },
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
      },
      orderBy: { horaInicio: 'desc' },
    });
  }

  private async obtenerAlumnoIdsFormales(materiaId: number, grupoId: number) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        materiaId,
        estado: 'ACEPTADA',
        alumno: {
          grupoId,
          rol: 'ALUMNO',
          activo: true,
        },
      },
      select: { alumnoId: true },
    });

    return inscripciones.map((inscripcion) => inscripcion.alumnoId);
  }
}
