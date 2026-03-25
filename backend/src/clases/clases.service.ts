import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { IniciarClaseDto } from './dto/iniciar-clase.dto';
import {
  convertirHoraAMinutos,
  convertirFechaAMinutos,
  estaDentroDelHorario,
  formatearFechaClave,
  horarioAplicaEnFecha,
  mismoDia,
  obtenerClaveSemana,
  obtenerFinDelDia,
  obtenerInicioDelDia,
} from './clases.utils';

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
        mensaje: `${horario.grupo?.nombre ?? 'Grupo'} ya está en curso`,
        referenciaId: sesion.id,
        referenciaTipo: 'ClaseSesion',
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
        referenciaId: sesionId,
        referenciaTipo: 'ClaseSesion',
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

  async obtenerHistorial(materiaId: number) {
    return this.prisma.claseSesion.findMany({
      where: { materiaId },
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
