import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModalidadReunion, Prisma, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { asegurarCarreraDeJefe } from '../common/materia-ownership';
import { instanteEnZona, partesEnZona } from '../common/zona-horaria.util';
import { construirEventoUnico } from '../calendario/ics';
import {
  ChoqueReunion,
  ClasesJustificadasService,
  DURACION_REUNION_DEFAULT_MIN,
} from './clases-justificadas.service';
import {
  CrearReunionDto,
  EditarReunionDto,
  GuardarActaDto,
} from './dto/reunion.dto';

const docenteCampos = { id: true, nombre: true, email: true } as const;
const reunionInclude = {
  carrera: { select: { id: true, nombre: true, codigo: true } },
  creadaPor: { select: { id: true, nombre: true } },
  puntos: { orderBy: { orden: 'asc' } },
  acuerdos: { orderBy: { orden: 'asc' } },
  convocados: {
    include: { docente: { select: docenteCampos } },
    orderBy: { docente: { nombre: 'asc' } },
  },
  clasesJustificadas: {
    select: {
      docenteId: true,
      motivo: true,
      horario: {
        select: {
          id: true,
          horaInicio: true,
          horaFin: true,
          materia: { select: { nombre: true } },
          grupo: { select: { nombre: true } },
        },
      },
    },
    orderBy: { horario: { horaInicio: 'asc' } },
  },
} satisfies Prisma.ReunionAcademicaInclude;
type ReunionCompleta = Prisma.ReunionAcademicaGetPayload<{
  include: typeof reunionInclude;
}>;

const DURACION_DEFAULT_MIN = DURACION_REUNION_DEFAULT_MIN;

function instante(fecha: string, hora: string) {
  const [year, month, day] = fecha.split('-').map(Number);
  const [hour, minute] = hora.split(':').map(Number);
  return instanteEnZona({ year, month, day, hour, minute });
}

function fechaValida(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return (
    f.getUTCFullYear() === y &&
    f.getUTCMonth() === m - 1 &&
    f.getUTCDate() === d
  );
}

function hoyClave() {
  const p = partesEnZona(new Date());
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function fechaTexto(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function dondeTexto(r: {
  modalidad: ModalidadReunion;
  lugar: string | null;
  enlace: string | null;
}) {
  return r.modalidad === 'VIRTUAL'
    ? `en línea${r.enlace ? ` (${r.enlace})` : ''}`
    : (r.lugar ?? 'lugar por confirmar');
}

const limpio = (texto: string | null | undefined) => texto?.trim() || null;

/** "Se cruza con tu clase de Cálculo (3A, 10:00–11:00)…" para la notificación. */
function textoChoques(choques: ChoqueReunion[]) {
  const clase = (c: ChoqueReunion) =>
    `${c.materia.nombre} (${c.grupo ? `${c.grupo.nombre}, ` : ''}${c.horaInicio}–${c.horaFin})`;
  return choques.length === 1
    ? `Se cruza con tu clase de ${clase(choques[0])}: puedes justificarla desde Reuniones.`
    : `Se cruza con ${choques.length} de tus clases (${choques.map(clase).join('; ')}): puedes justificarlas desde Reuniones.`;
}

@Injectable()
export class ReunionesService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
    private justificadas: ClasesJustificadasService,
  ) {}

  /**
   * Docentes de la carrera: quienes imparten alguna materia en un grupo
   * activo, por horario o por asignación directa (la misma regla que el
   * catálogo de Docentes en la jefatura).
   */
  docentesDeCarrera(carreraId: number) {
    const grupoActivo = { carreraId, activo: true };
    return this.prisma.usuario.findMany({
      where: {
        rol: 'DOCENTE',
        activo: true,
        OR: [
          { horariosDocente: { some: { activo: true, grupo: grupoActivo } } },
          {
            docenteMaterias: {
              some: { carreraId, grupos: { some: grupoActivo } },
            },
          },
        ],
      },
      select: docenteCampos,
      orderBy: { nombre: 'asc' },
    });
  }

  async docentes(usuarioId: number, carreraId: number) {
    await asegurarCarreraDeJefe(this.prisma, usuarioId, carreraId);
    return this.docentesDeCarrera(carreraId);
  }

  async listarJefe(usuarioId: number, carreraId: number) {
    await asegurarCarreraDeJefe(this.prisma, usuarioId, carreraId);
    const reuniones = await this.prisma.reunionAcademica.findMany({
      where: { carreraId },
      include: reunionInclude,
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });
    return reuniones.map((r) => this.serializar(r));
  }

  async detalleJefe(usuarioId: number, id: number) {
    const reunion = await this.reunionDelJefe(usuarioId, id);
    return this.serializar(reunion);
  }

  /** Reuniones a las que está convocado el docente, de todas sus carreras. */
  async mias(docenteId: number) {
    const reuniones = await this.prisma.reunionAcademica.findMany({
      where: { convocados: { some: { docenteId } } },
      include: reunionInclude,
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });
    return Promise.all(
      reuniones.map(async (r) => {
        const propia = r.convocados.find((c) => c.docenteId === docenteId);
        // El docente ve el acta, no la lista de asistencia de sus compañeros.
        const { convocados, clasesJustificadas, ...resto } = this.serializar(r);
        void clasesJustificadas;
        return {
          ...resto,
          totalConvocados: convocados.length,
          miAsistencia: propia?.asistio ?? null,
          // Sus clases a la misma hora, para justificar que no las dará.
          choques:
            r.estado === 'CANCELADA'
              ? []
              : ((await this.justificadas.choques([docenteId], r)).get(
                  docenteId,
                ) ?? []),
        };
      }),
    );
  }

  justificarClases(
    docenteId: number,
    id: number,
    dto: { horarioIds: number[]; motivo: string },
  ) {
    return this.justificadas.justificar(docenteId, id, dto);
  }

  quitarJustificacion(docenteId: number, id: number, horarioId: number) {
    return this.justificadas.quitar(docenteId, id, horarioId);
  }

  async crear(usuarioId: number, dto: CrearReunionDto) {
    await asegurarCarreraDeJefe(this.prisma, usuarioId, dto.carreraId);
    const datos = this.validarConvocatoria({
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin ?? null,
      modalidad: dto.modalidad ?? 'PRESENCIAL',
      lugar: limpio(dto.lugar),
      enlace: limpio(dto.enlace),
    });
    const convocados = await this.resolverConvocados(
      dto.carreraId,
      dto.convocados,
    );

    const reunion = await this.prisma.reunionAcademica.create({
      data: {
        carreraId: dto.carreraId,
        creadaPorId: usuarioId,
        titulo: dto.titulo.trim(),
        asunto: limpio(dto.asunto),
        tipo: dto.tipo ?? 'ORDINARIA',
        numeroActa: limpio(dto.numeroActa),
        ...datos,
        puntos: {
          create: (dto.puntos ?? []).map((descripcion, i) => ({
            orden: i + 1,
            descripcion: descripcion.trim(),
          })),
        },
        convocados: {
          create: convocados.map((docenteId) => ({ docenteId })),
        },
      },
      include: reunionInclude,
    });

    await this.convocar(
      convocados,
      reunion,
      `Reunión de academia: ${reunion.titulo}`,
      `Se te convoca el ${fechaTexto(reunion.fecha)} a las ${reunion.horaInicio}, ${dondeTexto(reunion)}.`,
    );
    return this.serializar(reunion);
  }

  async editar(usuarioId: number, id: number, dto: EditarReunionDto) {
    const actual = await this.reunionDelJefe(usuarioId, id);
    if (actual.estado !== 'PROGRAMADA') {
      throw new ConflictException(
        'Solo se puede editar una reunión programada',
      );
    }

    const siguiente = {
      fecha: dto.fecha ?? actual.fecha,
      horaInicio: dto.horaInicio ?? actual.horaInicio,
      horaFin: dto.horaFin === undefined ? actual.horaFin : dto.horaFin,
      modalidad: dto.modalidad ?? actual.modalidad,
      lugar: dto.lugar === undefined ? actual.lugar : limpio(dto.lugar),
      enlace: dto.enlace === undefined ? actual.enlace : limpio(dto.enlace),
    };
    const cambioAgenda =
      siguiente.fecha !== actual.fecha ||
      siguiente.horaInicio !== actual.horaInicio;
    const datos = this.validarConvocatoria(siguiente, {
      // Sin mover la fecha, una reunión que ya empezó puede corregir su lugar.
      permitirPasado: !cambioAgenda,
    });
    const cambioLogistica =
      cambioAgenda ||
      datos.horaFin !== actual.horaFin ||
      datos.modalidad !== actual.modalidad ||
      datos.lugar !== actual.lugar ||
      datos.enlace !== actual.enlace;

    const previos = actual.convocados.map((c) => c.docenteId);
    const convocados =
      dto.convocados === undefined
        ? previos
        : await this.resolverConvocados(actual.carreraId, dto.convocados);
    const nuevos = convocados.filter((d) => !previos.includes(d));
    const quitados = previos.filter((d) => !convocados.includes(d));

    const reunion = await this.prisma.$transaction(async (tx) => {
      if (dto.puntos !== undefined) {
        await tx.reunionPunto.deleteMany({ where: { reunionId: id } });
        await tx.reunionPunto.createMany({
          data: dto.puntos.map((descripcion, i) => ({
            reunionId: id,
            orden: i + 1,
            descripcion: descripcion.trim(),
          })),
        });
      }
      if (quitados.length) {
        await tx.reunionConvocado.deleteMany({
          where: { reunionId: id, docenteId: { in: quitados } },
        });
      }
      if (nuevos.length) {
        await tx.reunionConvocado.createMany({
          data: nuevos.map((docenteId) => ({ reunionId: id, docenteId })),
        });
      }
      return tx.reunionAcademica.update({
        where: { id },
        data: {
          titulo: dto.titulo?.trim(),
          asunto: dto.asunto === undefined ? undefined : limpio(dto.asunto),
          tipo: dto.tipo,
          numeroActa:
            dto.numeroActa === undefined ? undefined : limpio(dto.numeroActa),
          ...datos,
        },
        include: reunionInclude,
      });
    });

    // Lo justificado que ya no se cruza (otro horario, docente quitado) se cae.
    const retiradas = await this.justificadas.retirarInvalidas(
      reunion,
      convocados,
    );
    const cuando = `el ${fechaTexto(reunion.fecha)} a las ${reunion.horaInicio}, ${dondeTexto(reunion)}`;
    await this.convocar(
      nuevos,
      reunion,
      `Reunión de academia: ${reunion.titulo}`,
      `Se te convoca ${cuando}.`,
    );
    if (cambioLogistica) {
      await this.convocar(
        convocados.filter((d) => !nuevos.includes(d)),
        reunion,
        `Cambió la reunión: ${reunion.titulo}`,
        `Ahora es ${cuando}.`,
        retiradas,
      );
    }
    await this.convocar(
      quitados,
      reunion,
      `Ya no estás convocado: ${reunion.titulo}`,
      `La jefatura te quitó de la reunión del ${fechaTexto(reunion.fecha)}.`,
      retiradas,
      { sinChoques: true },
    );
    return this.serializar(reunion);
  }

  async cancelar(usuarioId: number, id: number) {
    const actual = await this.reunionDelJefe(usuarioId, id);
    if (actual.estado !== 'PROGRAMADA') {
      throw new ConflictException(
        'Solo se puede cancelar una reunión programada',
      );
    }
    const reunion = await this.prisma.reunionAcademica.update({
      where: { id },
      data: { estado: 'CANCELADA' },
      include: reunionInclude,
    });
    const retiradas = await this.justificadas.retirarInvalidas(reunion, []);
    await this.convocar(
      reunion.convocados.map((c) => c.docenteId),
      reunion,
      `Reunión cancelada: ${reunion.titulo}`,
      `Se canceló la reunión del ${fechaTexto(reunion.fecha)} a las ${reunion.horaInicio}.`,
      retiradas,
      { sinChoques: true },
    );
    return this.serializar(reunion);
  }

  /** Borra una reunión cancelada (p. ej. capturada por error). */
  async eliminar(usuarioId: number, id: number) {
    const actual = await this.reunionDelJefe(usuarioId, id);
    if (actual.estado !== 'CANCELADA') {
      throw new ConflictException('Cancela la reunión antes de eliminarla');
    }
    await this.prisma.reunionAcademica.delete({ where: { id } });
    return { id };
  }

  /**
   * Acta de la reunión: asistencia de los convocados, acuerdos y
   * observaciones. Se puede guardar como borrador y `finalizar` la cierra;
   * una reunión finalizada todavía admite correcciones al acta.
   */
  async guardarActa(usuarioId: number, id: number, dto: GuardarActaDto) {
    const actual = await this.reunionDelJefe(usuarioId, id);
    if (actual.estado === 'CANCELADA') {
      throw new ConflictException('La reunión está cancelada');
    }
    if (actual.fecha > hoyClave()) {
      throw new ConflictException(
        'El acta se captura el día de la reunión o después',
      );
    }
    const convocados = new Set(actual.convocados.map((c) => c.docenteId));
    const ajenos = (dto.asistencia ?? []).filter(
      (a) => !convocados.has(a.docenteId),
    );
    if (ajenos.length) {
      throw new BadRequestException(
        'La asistencia incluye docentes que no están convocados',
      );
    }
    // Finalizar exige confirmar a cada convocado: nadie queda presente por omisión.
    if (dto.finalizar) {
      const asistencia = new Map(
        actual.convocados.map((c) => [c.docenteId, c.asistio]),
      );
      for (const a of dto.asistencia ?? [])
        asistencia.set(a.docenteId, a.asistio);
      const sinConfirmar = [...asistencia.values()].filter(
        (asistio) => asistio == null,
      ).length;
      if (sinConfirmar) {
        throw new BadRequestException(
          `Confirma la asistencia de ${sinConfirmar === 1 ? '1 convocado' : `${sinConfirmar} convocados`} antes de finalizar`,
        );
      }
    }

    const reunion = await this.prisma.$transaction(async (tx) => {
      for (const a of dto.asistencia ?? []) {
        await tx.reunionConvocado.update({
          where: {
            reunionId_docenteId: { reunionId: id, docenteId: a.docenteId },
          },
          data: { asistio: a.asistio },
        });
      }
      if (dto.acuerdos !== undefined) {
        await tx.reunionAcuerdo.deleteMany({ where: { reunionId: id } });
        await tx.reunionAcuerdo.createMany({
          data: dto.acuerdos.map((a, i) => ({
            reunionId: id,
            orden: i + 1,
            descripcion: a.descripcion.trim(),
            responsable: limpio(a.responsable),
            fechaLimite: a.fechaLimite || null,
          })),
        });
      }
      return tx.reunionAcademica.update({
        where: { id },
        data: {
          observaciones:
            dto.observaciones === undefined
              ? undefined
              : limpio(dto.observaciones),
          estado: dto.finalizar ? 'FINALIZADA' : undefined,
        },
        include: reunionInclude,
      });
    });

    if (
      dto.finalizar &&
      actual.estado !== 'FINALIZADA' &&
      reunion.acuerdos.length
    ) {
      await this.notificar(
        reunion.convocados.map((c) => c.docenteId),
        reunion,
        `Acta disponible: ${reunion.titulo}`,
        `Se registraron ${reunion.acuerdos.length} ${reunion.acuerdos.length === 1 ? 'acuerdo' : 'acuerdos'} de la reunión del ${fechaTexto(reunion.fecha)}.`,
      );
    }
    return this.serializar(reunion);
  }

  /** Archivo .ics: lo pide la jefatura de la carrera o un docente convocado. */
  async ics(usuario: { id: number; rol: string }, id: number) {
    const reunion = await this.prisma.reunionAcademica.findUnique({
      where: { id },
      include: {
        carrera: { select: { nombre: true } },
        puntos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!reunion) throw new NotFoundException('Reunión no encontrada');
    if (usuario.rol === 'JEFE_CARRERA') {
      await asegurarCarreraDeJefe(this.prisma, usuario.id, reunion.carreraId);
    } else {
      const convocado = await this.prisma.reunionConvocado.count({
        where: { reunionId: id, docenteId: usuario.id },
      });
      if (!convocado)
        throw new ForbiddenException('No estás convocado a esta reunión');
    }
    const inicio = instante(reunion.fecha, reunion.horaInicio);
    const fin = reunion.horaFin
      ? instante(reunion.fecha, reunion.horaFin)
      : new Date(inicio.getTime() + DURACION_DEFAULT_MIN * 60000);
    const descripcion = [
      reunion.asunto,
      reunion.puntos.length
        ? `Orden del día:\n${reunion.puntos.map((p) => `${p.orden}. ${p.descripcion}`).join('\n')}`
        : null,
      reunion.modalidad === 'VIRTUAL' && reunion.enlace
        ? `Enlace: ${reunion.enlace}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    return {
      filename: `reunion-${reunion.fecha}-${reunion.id}.ics`,
      contenido: construirEventoUnico({
        uid: `reunion-${reunion.id}@sicat`,
        resumen: `${reunion.titulo} · ${reunion.carrera.nombre}`,
        descripcion: descripcion || undefined,
        lugar:
          reunion.modalidad === 'VIRTUAL'
            ? (reunion.enlace ?? 'En línea')
            : (reunion.lugar ?? undefined),
        inicio,
        fin,
        cancelado: reunion.estado === 'CANCELADA',
      }),
    };
  }

  private async reunionDelJefe(usuarioId: number, id: number) {
    const reunion = await this.prisma.reunionAcademica.findUnique({
      where: { id },
      include: reunionInclude,
    });
    if (!reunion) throw new NotFoundException('Reunión no encontrada');
    await asegurarCarreraDeJefe(this.prisma, usuarioId, reunion.carreraId);
    return reunion;
  }

  private validarConvocatoria(
    d: {
      fecha: string;
      horaInicio: string;
      horaFin: string | null;
      modalidad: ModalidadReunion;
      lugar: string | null;
      enlace: string | null;
    },
    { permitirPasado = false } = {},
  ) {
    if (!fechaValida(d.fecha))
      throw new BadRequestException('La fecha no existe');
    if (d.horaFin && d.horaFin <= d.horaInicio) {
      throw new BadRequestException(
        'La hora de término debe ser posterior a la de inicio',
      );
    }
    if (!permitirPasado && instante(d.fecha, d.horaInicio) < new Date()) {
      throw new BadRequestException(
        'No se puede programar una reunión en una fecha u hora que ya pasó',
      );
    }
    if (d.modalidad === 'PRESENCIAL' && !d.lugar) {
      throw new BadRequestException('Indica el lugar de la reunión');
    }
    if (d.modalidad === 'VIRTUAL') {
      if (!d.enlace)
        throw new BadRequestException('Indica el enlace de la reunión');
      if (!/^https?:\/\/\S+$/i.test(d.enlace)) {
        throw new BadRequestException('El enlace debe empezar con https://');
      }
    }
    return d;
  }

  /** Sin lista explícita se convoca a todos; con lista, solo a docentes de la carrera. */
  private async resolverConvocados(carreraId: number, ids?: number[]) {
    const docentes = (await this.docentesDeCarrera(carreraId)).map((d) => d.id);
    if (ids === undefined) return docentes;
    const validos = new Set(docentes);
    const ajenos = ids.filter((id) => !validos.has(id));
    if (ajenos.length) {
      throw new BadRequestException(
        'Solo se puede convocar a docentes que imparten en la carrera',
      );
    }
    return ids;
  }

  /**
   * Notifica a cada docente y, si la reunión se cruza con alguna de sus
   * clases sin justificar, se lo dice para que la justifique. `retiradas`
   * agrega las justificaciones que se cayeron con el cambio.
   */
  private async convocar(
    docenteIds: number[],
    reunion: {
      id: number;
      fecha: string;
      horaInicio: string;
      horaFin: string | null;
    },
    titulo: string,
    mensaje: string,
    retiradas = new Map<number, string[]>(),
    { sinChoques = false } = {},
  ) {
    const ids = [...new Set(docenteIds)];
    if (!ids.length) return;
    const choques = sinChoques
      ? new Map<number, ChoqueReunion[]>()
      : await this.justificadas.choques(ids, reunion);
    await this.notificaciones.crearVarias(
      ids.map((docenteId) => {
        const pendientes = (choques.get(docenteId) ?? []).filter(
          (c) => !c.justificacion && !c.sinClases && !c.listaCapturada,
        );
        const caidas = retiradas.get(docenteId) ?? [];
        return {
          usuarioId: docenteId,
          tipo: TipoNotificacion.REUNION_ACADEMICA,
          titulo: titulo.slice(0, 200),
          mensaje: [
            mensaje,
            pendientes.length ? textoChoques(pendientes) : null,
            caidas.length
              ? `Se retiró la justificación de ${caidas.join(', ')}: ${caidas.length === 1 ? 'esa clase se imparte' : 'esas clases se imparten'} normalmente.`
              : null,
          ]
            .filter(Boolean)
            .join(' '),
          referenciaId: reunion.id,
          referenciaTipo: 'ReunionAcademica',
        };
      }),
    );
  }

  private async notificar(
    docenteIds: number[],
    reunion: { id: number },
    titulo: string,
    mensaje: string,
  ) {
    await this.notificaciones.crearParaVarios(docenteIds, {
      tipo: TipoNotificacion.REUNION_ACADEMICA,
      titulo: titulo.slice(0, 200),
      mensaje,
      referenciaId: reunion.id,
      referenciaTipo: 'ReunionAcademica',
    });
  }

  private serializar(r: ReunionCompleta) {
    const asistieron = r.convocados.filter((c) => c.asistio === true).length;
    return {
      id: r.id,
      carrera: r.carrera,
      creadaPor: r.creadaPor,
      titulo: r.titulo,
      asunto: r.asunto,
      tipo: r.tipo,
      numeroActa: r.numeroActa,
      fecha: r.fecha,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      modalidad: r.modalidad,
      lugar: r.lugar,
      enlace: r.enlace,
      estado: r.estado,
      observaciones: r.observaciones,
      puntos: r.puntos.map((p) => ({
        id: p.id,
        orden: p.orden,
        descripcion: p.descripcion,
      })),
      acuerdos: r.acuerdos.map((a) => ({
        id: a.id,
        orden: a.orden,
        descripcion: a.descripcion,
        responsable: a.responsable,
        fechaLimite: a.fechaLimite,
      })),
      convocados: r.convocados.map((c) => ({
        ...c.docente,
        asistio: c.asistio,
      })),
      // Clases que los convocados justificaron por esta reunión.
      clasesJustificadas: (r.clasesJustificadas ?? []).map((j) => ({
        docenteId: j.docenteId,
        docente:
          r.convocados.find((c) => c.docenteId === j.docenteId)?.docente
            .nombre ?? null,
        motivo: j.motivo,
        horarioId: j.horario.id,
        materia: j.horario.materia.nombre,
        grupo: j.horario.grupo?.nombre ?? null,
        horaInicio: j.horario.horaInicio,
        horaFin: j.horario.horaFin,
      })),
      asistencia: {
        convocados: r.convocados.length,
        asistieron,
        registrada: r.convocados.some((c) => c.asistio !== null),
      },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
