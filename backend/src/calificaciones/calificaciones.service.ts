import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoAsistencia,
  EstadoRevision,
  EstadoTarea,
  EstadoUnidad,
  TipoCriterio,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import { asegurarAccesoMateria } from '../common/materia-ownership';
import { GuardarCalificacionManualDto } from './dto/guardar-calificacion-manual.dto';
import { GuardarCalificacionesLoteDto } from './dto/guardar-calificaciones-lote.dto';
import { GuardarPonderacionDto } from './dto/guardar-ponderacion.dto';
import {
  calcularUnidad,
  cargarCriterios,
  esCriterioDeActividad,
  type ListaCriterios,
} from './criterios';

type Actor = {
  id: number;
  rol: string;
};

type CalificacionesFiltros = {
  materiaId?: number;
  grupoId?: number;
  unidadId?: number;
  docenteId?: number;
};

/**
 * Forma anterior de la ponderación (tareas / asistencia + categorías de
 * tareas). Se sigue mandando para las pantallas que aún no conocen los
 * criterios; los pesos de las categorías ya son parte de la unidad.
 */
function ponderacionLegada(lista: ListaCriterios) {
  const actividades = lista.criterios.filter((criterio) =>
    esCriterioDeActividad(criterio.tipo),
  );
  return {
    tareas: actividades.reduce((suma, criterio) => suma + criterio.peso, 0),
    asistencia:
      lista.criterios.find(
        (criterio) => criterio.tipo === TipoCriterio.ASISTENCIA,
      )?.peso ?? 0,
    categorias:
      lista.origen === 'PREDETERMINADA'
        ? []
        : actividades.map(({ id, nombre, peso }) => ({
            id: id as number,
            nombre,
            peso,
          })),
    origen:
      lista.origen === 'PREDETERMINADA'
        ? (lista.legado ?? 'MATERIA')
        : ('GRUPO' as const),
  };
}

const ESTADOS_CON_ENTREGA = new Set<EstadoRevision>([
  EstadoRevision.PENDIENTE,
  EstadoRevision.ENTREGADA,
  EstadoRevision.REVISADA,
  EstadoRevision.CALIFICADA,
  EstadoRevision.INCORRECTA,
]);

const ESTADOS_PENDIENTES_REVISION = new Set<EstadoRevision>([
  EstadoRevision.PENDIENTE,
  EstadoRevision.ENTREGADA,
]);

const ESTADOS_VISIBLES_TAREA = [
  EstadoTarea.PUBLICADA,
  EstadoTarea.VENCIDA,
  EstadoTarea.CERRADA,
];

@Injectable()
export class CalificacionesService {
  constructor(private prisma: PrismaService) {}

  obtenerReporteDocente(actor: Actor, filtros: CalificacionesFiltros) {
    if (!filtros.materiaId) {
      throw new BadRequestException('La materia es obligatoria');
    }

    return this.construirReporte(
      { ...filtros, materiaId: filtros.materiaId },
      {
        actor,
        validarDocente: true,
      },
    );
  }

  async obtenerReporteAlumno(
    alumnoId: number,
    filtros: CalificacionesFiltros = {},
  ) {
    const alumno = await this.prisma.usuario.findUnique({
      where: { id: alumnoId },
      select: {
        id: true,
        nombre: true,
        numeroControl: true,
        grupoId: true,
      },
    });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');

    const materiaIds = await this.obtenerMateriaIdsAlumno(
      alumnoId,
      alumno.grupoId,
      filtros.materiaId,
    );

    const reportes = await Promise.all(
      materiaIds.map((materiaId) =>
        this.construirReporte(
          {
            materiaId,
            grupoId: alumno.grupoId ?? undefined,
            unidadId: filtros.unidadId,
          },
          {
            alumnoId,
            validarDocente: false,
          },
        ),
      ),
    );

    const rows = reportes.flatMap((reporte) => reporte.rows);
    return {
      generatedAt: new Date().toISOString(),
      reportes,
      rows,
      metrics: this.calcularMetricas(rows, 1),
    };
  }

  /**
   * Ponderación predeterminada tareas / asistencia, la de los grupos que aún no
   * tienen criterios. Sin grupo es la de la materia; con grupo, la propia del
   * grupo. Los criterios (examen, prácticas, participación…) se guardan con
   * `CriteriosService`; una pantalla vieja que mande categorías recibe 409.
   */
  async guardarPonderacion(actor: Actor, dto: GuardarPonderacionDto) {
    if (dto.pesoTareas + dto.pesoAsistencia !== 100) {
      throw new BadRequestException(
        'La ponderación de tareas y asistencia debe sumar 100',
      );
    }
    await asegurarAccesoMateria(this.prisma, actor, dto.materiaId, dto.grupoId);

    if (!dto.grupoId) {
      await this.prisma.materia.update({
        where: { id: dto.materiaId },
        data: {
          pesoTareas: dto.pesoTareas,
          pesoAsistencia: dto.pesoAsistencia,
        },
        select: { id: true },
      });
      return this.obtenerPonderacion(actor, dto.materiaId);
    }

    const grupoId = dto.grupoId;
    const vinculado = await this.prisma.materia.count({
      where: { id: dto.materiaId, grupos: { some: { id: grupoId } } },
    });
    if (!vinculado) {
      throw new BadRequestException(
        'El grupo no esta vinculado a la materia seleccionada',
      );
    }
    const conCriterios = await this.prisma.categoriaPesoGrupo.count({
      where: { grupoId, categoria: { materiaId: dto.materiaId } },
    });
    if (dto.categorias?.length || conCriterios) {
      throw new ConflictException(
        'La ponderación ahora se arma con criterios de evaluación. Recarga la página para editarlos.',
      );
    }

    await this.prisma.ponderacionGrupo.upsert({
      where: { materiaId_grupoId: { materiaId: dto.materiaId, grupoId } },
      create: {
        materiaId: dto.materiaId,
        grupoId,
        pesoTareas: dto.pesoTareas,
        pesoAsistencia: dto.pesoAsistencia,
      },
      update: {
        pesoTareas: dto.pesoTareas,
        pesoAsistencia: dto.pesoAsistencia,
      },
    });

    return this.obtenerPonderacion(actor, dto.materiaId, grupoId);
  }

  /**
   * Ponderación en la forma anterior, para pantallas que aún no conocen los
   * criterios (p. ej. un formulario de tareas abierto antes de actualizar).
   * El catálogo sólo trae criterios de actividad.
   */
  async obtenerPonderacion(actor: Actor, materiaId: number, grupoId?: number) {
    await asegurarAccesoMateria(this.prisma, actor, materiaId, grupoId);
    const materia = await this.prisma.materia.findUnique({
      where: { id: materiaId },
      select: { id: true, pesoTareas: true, pesoAsistencia: true },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    const { resolver, catalogo } = await cargarCriterios(this.prisma, materia);
    return {
      ...ponderacionLegada(resolver(grupoId)),
      catalogo: catalogo
        .filter((item) => esCriterioDeActividad(item.tipo))
        .map(({ id, nombre }) => ({ id, nombre })),
    };
  }

  guardarManual(
    actor: Actor,
    dto: GuardarCalificacionManualDto,
    filtros: Pick<CalificacionesFiltros, 'grupoId' | 'unidadId'> = {},
  ) {
    return this.guardarManualLote(
      actor,
      {
        materiaId: dto.materiaId,
        grupoId: dto.grupoId,
        calificaciones: [
          {
            alumnoId: dto.alumnoId,
            unidadId: dto.unidadId,
            calificacionManual: dto.calificacionManual,
            observacion: dto.observacion,
          },
        ],
      },
      filtros,
    );
  }

  // Guarda varias capturas en una transacción y devuelve el reporte una sola
  // vez, para que "Guardar todo" no reconstruya el reporte por cada alumno.
  async guardarManualLote(
    actor: Actor,
    dto: GuardarCalificacionesLoteDto,
    filtros: Pick<CalificacionesFiltros, 'grupoId' | 'unidadId'> = {},
  ) {
    const materia = await this.obtenerMateria({ materiaId: dto.materiaId });
    const unidadIds = new Set(materia.unidades.map((unidad) => unidad.id));
    if (dto.calificaciones.some((item) => !unidadIds.has(item.unidadId))) {
      throw new BadRequestException(
        'La unidad no pertenece a la materia seleccionada',
      );
    }
    await asegurarAccesoMateria(this.prisma, actor, dto.materiaId, dto.grupoId);

    if (
      dto.grupoId &&
      !materia.grupos.some((grupo) => grupo.id === dto.grupoId)
    ) {
      throw new BadRequestException(
        'El grupo no esta vinculado a la materia seleccionada',
      );
    }

    const alumnos = new Map(
      (await this.obtenerAlumnosReporte(dto.materiaId, dto.grupoId)).map(
        (alumno) => [alumno.id, alumno] as const,
      ),
    );
    const capturas = dto.calificaciones.map((item) => {
      const alumno = alumnos.get(item.alumnoId);
      if (!alumno) {
        throw new BadRequestException(
          'El alumno no pertenece a la materia seleccionada',
        );
      }
      const calificacionManual =
        item.calificacionManual == null
          ? null
          : Number(item.calificacionManual);
      if (
        calificacionManual !== null &&
        (!Number.isFinite(calificacionManual) ||
          calificacionManual < 1 ||
          calificacionManual > 100)
      ) {
        throw new BadRequestException(
          'La calificacion debe estar entre 1 y 100',
        );
      }
      return {
        alumnoId: item.alumnoId,
        unidadId: item.unidadId,
        grupoId: dto.grupoId ?? alumno.grupoId ?? null,
        calificacionManual,
        observacion: item.observacion?.trim() || null,
      };
    });

    const periodo = getCurrentAcademicPeriod();
    await this.prisma.$transaction(
      capturas.map(({ alumnoId, unidadId, ...datos }) =>
        this.prisma.calificacionUnidad.upsert({
          where: {
            alumnoId_materiaId_unidadId_periodo: {
              alumnoId,
              materiaId: dto.materiaId,
              unidadId,
              periodo,
            },
          },
          create: {
            alumnoId,
            materiaId: dto.materiaId,
            unidadId,
            periodo,
            ...datos,
            docenteId: actor.id,
          },
          update: { ...datos, docenteId: actor.id },
        }),
      ),
    );

    return this.construirReporte(
      {
        materiaId: dto.materiaId,
        ...(filtros.grupoId
          ? { grupoId: filtros.grupoId }
          : dto.grupoId
            ? { grupoId: dto.grupoId }
            : {}),
        ...(filtros.unidadId ? { unidadId: filtros.unidadId } : {}),
      },
      {
        actor,
        validarDocente: true,
      },
    );
  }

  private async construirReporte(
    filtros: Required<Pick<CalificacionesFiltros, 'materiaId'>> &
      CalificacionesFiltros,
    options: {
      actor?: Actor;
      alumnoId?: number;
      validarDocente: boolean;
    },
  ) {
    const materia = await this.obtenerMateria(filtros);
    if (options.validarDocente) {
      await asegurarAccesoMateria(
        this.prisma,
        options.actor,
        filtros.materiaId,
        filtros.grupoId,
      );
    }
    const { resolver: resolverCriterios, catalogo } = await cargarCriterios(
      this.prisma,
      materia,
    );
    const criteriosBase = resolverCriterios(filtros.grupoId);

    const unidades = this.obtenerUnidadesReporte(materia, filtros.unidadId);
    const grupoSeleccionado = filtros.grupoId
      ? materia.grupos.find((grupo) => grupo.id === filtros.grupoId)
      : null;
    if (filtros.grupoId && !grupoSeleccionado) {
      throw new BadRequestException(
        'El grupo no esta vinculado a la materia seleccionada',
      );
    }

    const alumnos = await this.obtenerAlumnosReporte(
      filtros.materiaId,
      filtros.grupoId,
      options.alumnoId,
    );
    const alumnoIds = alumnos.map((alumno) => alumno.id);
    const unidadIds = unidades
      .map((unidad) => unidad.id)
      .filter((id): id is number => typeof id === 'number');
    const periodo = getCurrentAcademicPeriod();

    const [tareas, sesiones, calificacionesGuardadas] = await Promise.all([
      this.prisma.tarea.findMany({
        where: {
          materiaId: filtros.materiaId,
          estado: { in: ESTADOS_VISIBLES_TAREA },
          ...(filtros.grupoId ? { grupoId: filtros.grupoId } : {}),
          ...(filtros.unidadId
            ? {
                OR: [
                  { unidadId: filtros.unidadId },
                  {
                    unidad: unidades[0]?.orden,
                    unidadId: null,
                  },
                ],
              }
            : {}),
        },
        include: {
          grupo: { select: { id: true, nombre: true } },
          unidadRef: { select: { id: true, nombre: true, orden: true } },
          entregas: {
            where: alumnoIds.length ? { alumnoId: { in: alumnoIds } } : {},
            select: {
              id: true,
              alumnoId: true,
              estadoRevision: true,
              calificacion: true,
              observacion: true,
              fueTardia: true,
            },
          },
        },
        orderBy: [{ unidad: 'asc' }, { titulo: 'asc' }],
      }),
      this.prisma.claseSesion.findMany({
        where: {
          materiaId: filtros.materiaId,
          ...(filtros.grupoId ? { grupoId: filtros.grupoId } : {}),
          ...(filtros.unidadId
            ? {
                OR: [
                  { unidadId: filtros.unidadId },
                  {
                    unidad: unidades[0]?.orden,
                    unidadId: null,
                  },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          grupoId: true,
          unidadId: true,
          unidad: true,
        },
      }),
      unidadIds.length && alumnoIds.length
        ? this.prisma.calificacionUnidad.findMany({
            where: {
              materiaId: filtros.materiaId,
              periodo,
              alumnoId: { in: alumnoIds },
              unidadId: { in: unidadIds },
            },
            select: {
              alumnoId: true,
              unidadId: true,
              calificacionManual: true,
              observacion: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const calificacionesPorAlumnoUnidad = new Map(
      calificacionesGuardadas.map(
        (calificacion) =>
          [
            `${calificacion.alumnoId}:${calificacion.unidadId}`,
            calificacion,
          ] as const,
      ),
    );

    // Participación: informativa, se muestra junto a la nota pero no la mueve.
    const participaciones = sesiones.length
      ? await this.prisma.participacion.findMany({
          where: {
            claseSesionId: { in: sesiones.map((sesion) => sesion.id) },
            ...(alumnoIds.length ? { alumnoId: { in: alumnoIds } } : {}),
          },
          select: { alumnoId: true, claseSesionId: true, puntos: true },
        })
      : [];

    const asistencias = sesiones.length
      ? await this.prisma.asistencia.findMany({
          where: {
            claseSesionId: { in: sesiones.map((sesion) => sesion.id) },
            ...(alumnoIds.length ? { alumnoId: { in: alumnoIds } } : {}),
          },
          select: {
            alumnoId: true,
            claseSesionId: true,
            estado: true,
          },
        })
      : [];

    const asistenciasPorSesionAlumno = new Map(
      asistencias.map((asistencia) => [
        `${asistencia.alumnoId}:${asistencia.claseSesionId}`,
        asistencia,
      ]),
    );

    const rows: any[] = [];
    const tareasSinCategoria = new Set<number>();
    for (const unidad of unidades) {
      const tareasUnidad = tareas.filter((tarea) =>
        this.perteneceAUnidad(tarea, unidad),
      );
      const sesionesUnidad = sesiones.filter((sesion) =>
        this.perteneceAUnidad(sesion, unidad),
      );

      for (const alumno of alumnos) {
        const tareasAlumno = tareasUnidad.filter((tarea) =>
          this.aplicaAGrupoAlumno(
            tarea.grupoId,
            alumno.grupoId,
            filtros.grupoId,
          ),
        );
        const sesionesAlumno = sesionesUnidad.filter((sesion) =>
          this.aplicaAGrupoAlumno(
            sesion.grupoId,
            alumno.grupoId,
            filtros.grupoId,
          ),
        );
        const entregasAlumno = tareasAlumno
          .map((tarea) => ({
            tarea,
            entrega:
              tarea.entregas.find(
                (entrega) => entrega.alumnoId === alumno.id,
              ) ?? null,
          }))
          .filter((item) => item.tarea);

        // Los criterios se resuelven por unidad: una unidad puede tener sus
        // propios porcentajes.
        const listaAlumno = resolverCriterios(
          filtros.grupoId ?? alumno.grupoId,
          unidad.id,
        );
        const asistencia = this.resumirAsistenciaAlumno(
          alumno.id,
          sesionesAlumno,
          asistenciasPorSesionAlumno,
        );
        const tareasResumen = this.resumirTareasAlumno(entregasAlumno);
        const idsSesionesAlumno = new Set(sesionesAlumno.map((s) => s.id));
        const participacion = participaciones
          .filter(
            (item) =>
              item.alumnoId === alumno.id &&
              idsSesionesAlumno.has(item.claseSesionId),
          )
          .reduce((suma, item) => suma + item.puntos, 0);
        const calculo = calcularUnidad(listaAlumno, {
          actividades: entregasAlumno.map(({ tarea, entrega }) => ({
            tareaId: tarea.id,
            categoriaId: tarea.categoriaId,
            calificacion: entrega?.calificacion,
          })),
          asistencia,
          participacion: {
            puntos: participacion,
            sesiones: sesionesAlumno.length,
          },
        });
        calculo.sinCriterio.forEach((id) => tareasSinCategoria.add(id));
        const { calificacionCalculada, promedioTareas } = calculo;
        // Forma anterior del desglose: sólo los criterios de actividad.
        const promedioPorCategoria =
          listaAlumno.origen === 'PREDETERMINADA'
            ? []
            : calculo.criterios
                .filter((criterio) => esCriterioDeActividad(criterio.tipo))
                .map((criterio) => ({
                  categoriaId: criterio.id,
                  nombre: criterio.nombre,
                  peso: criterio.peso,
                  promedio: criterio.valor,
                  calificadas: criterio.calificadas,
                  total: criterio.total,
                }));
        const calificacionGuardada =
          unidad.id == null
            ? null
            : calificacionesPorAlumnoUnidad.get(`${alumno.id}:${unidad.id}`);
        const calificacionManual =
          typeof calificacionGuardada?.calificacionManual === 'number'
            ? calificacionGuardada.calificacionManual
            : null;
        const calificacionFinal = calificacionManual ?? calificacionCalculada;
        const observacionManual =
          calificacionGuardada?.observacion?.trim() || null;
        const observacionesEntregas = entregasAlumno
          .map((item) => item.entrega?.observacion?.trim())
          .filter(Boolean);
        const grupo =
          grupoSeleccionado ??
          materia.grupos.find((item) => item.id === alumno.grupoId) ??
          tareasAlumno[0]?.grupo ??
          null;

        rows.push({
          alumno: {
            id: alumno.id,
            nombre: alumno.nombre,
            numeroControl: alumno.numeroControl,
            sexo: alumno.sexo ?? null,
          },
          materia: {
            id: materia.id,
            nombre: materia.nombre,
            clave: materia.clave,
          },
          grupo,
          unidad,
          calificacionSugerida: calificacionFinal,
          calificacionFinal,
          calificacionManual,
          calificacionCalculada,
          fuenteCalificacion:
            calificacionManual != null
              ? 'MANUAL'
              : calificacionCalculada != null
                ? 'CALCULADA'
                : 'PENDIENTE',
          promedioTareas,
          promedioPorCategoria,
          criterios: calculo.criterios.map(
            ({
              clave,
              id,
              nombre,
              tipo,
              peso,
              meta,
              valor,
              calificadas,
              total,
              puntos,
            }) => ({
              clave,
              id,
              nombre,
              tipo,
              peso,
              meta,
              valor,
              calificadas,
              total,
              ...(puntos !== undefined ? { puntos } : {}),
            }),
          ),
          origenCriterios: listaAlumno.origen,
          estado: this.obtenerEstadoCalificacion(calificacionFinal),
          tareas: tareasResumen,
          asistencia,
          participacion,
          observacionManual,
          observaciones: [observacionManual, ...observacionesEntregas]
            .filter(Boolean)
            .slice(0, 3),
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      materia: {
        id: materia.id,
        nombre: materia.nombre,
        clave: materia.clave,
        docente: materia.docente,
        carrera: materia.carrera,
      },
      grupoSeleccionado,
      unidadSeleccionada:
        filtros.unidadId && unidades.length === 1 ? unidades[0] : null,
      unidades,
      rows: rows.sort(
        (a, b) =>
          (a.unidad.orden ?? 0) - (b.unidad.orden ?? 0) ||
          a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'),
      ),
      filters: filtros,
      ponderacion: ponderacionLegada(criteriosBase),
      criterios: criteriosBase,
      categorias: catalogo.filter((item) => esCriterioDeActividad(item.tipo)),
      tareasSinCategoria: tareasSinCategoria.size,
      metrics: this.calcularMetricas(rows, unidades.length),
    };
  }

  private async obtenerMateria(filtros: CalificacionesFiltros) {
    if (!filtros.materiaId) {
      throw new BadRequestException('La materia es obligatoria');
    }

    const materia = await this.prisma.materia.findUnique({
      where: { id: filtros.materiaId },
      include: {
        docente: { select: { id: true, nombre: true, email: true } },
        carrera: { select: { id: true, nombre: true } },
        grupos: {
          select: {
            id: true,
            nombre: true,
            semestre: true,
            seccion: true,
            periodo: true,
          },
          orderBy: [{ semestre: 'asc' }, { seccion: 'asc' }],
        },
        unidades: { orderBy: { orden: 'asc' } },
      },
    });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    if (
      filtros.unidadId &&
      !materia.unidades.some((unidad) => unidad.id === filtros.unidadId)
    ) {
      throw new BadRequestException(
        'La unidad no pertenece a la materia seleccionada',
      );
    }
    return materia;
  }

  private obtenerUnidadesReporte(
    materia: {
      numUnidades: number;
      unidades: Array<{
        id: number;
        nombre: string;
        orden: number;
        status: EstadoUnidad;
      }>;
    },
    unidadId?: number,
  ): Array<{
    id: number | null;
    nombre: string;
    orden: number;
    status: EstadoUnidad | null;
  }> {
    const unidades = unidadId
      ? materia.unidades.filter((unidad) => unidad.id === unidadId)
      : materia.unidades;

    if (unidades.length) {
      return unidades.map((unidad) => ({
        id: unidad.id,
        nombre: unidad.nombre,
        orden: unidad.orden,
        status: unidad.status,
      }));
    }

    return Array.from({ length: materia.numUnidades || 1 }).map((_, index) => ({
      id: null,
      nombre: `Unidad ${index + 1}`,
      orden: index + 1,
      status: null,
    }));
  }

  private async obtenerAlumnosReporte(
    materiaId: number,
    grupoId?: number,
    alumnoId?: number,
  ) {
    if (alumnoId) {
      const alumno = await this.prisma.usuario.findUnique({
        where: { id: alumnoId },
        select: {
          id: true,
          nombre: true,
          numeroControl: true,
          sexo: true,
          grupoId: true,
        },
      });
      return alumno ? [alumno] : [];
    }

    const periodo = getCurrentAcademicPeriod();
    const baseWhere = {
      materiaId,
      estado: 'ACEPTADA' as const,
      alumno: {
        rol: 'ALUMNO' as const,
        activo: true,
      },
      // Del grupo, o inscritos por el docente en la clase de ese grupo.
      ...(grupoId ? { OR: [{ alumno: { grupoId } }, { grupoId }] } : {}),
    };

    let inscripciones = await this.prisma.inscripcion.findMany({
      where: { ...baseWhere, periodo },
      select: {
        alumno: {
          select: {
            id: true,
            nombre: true,
            numeroControl: true,
            sexo: true,
            grupoId: true,
          },
        },
      },
      orderBy: { alumno: { nombre: 'asc' } },
    });

    if (!inscripciones.length) {
      inscripciones = await this.prisma.inscripcion.findMany({
        where: baseWhere,
        select: {
          alumno: {
            select: {
              id: true,
              nombre: true,
              numeroControl: true,
              sexo: true,
              grupoId: true,
            },
          },
        },
        orderBy: { alumno: { nombre: 'asc' } },
      });
    }

    return Array.from(
      new Map(
        inscripciones.map((inscripcion) => [
          inscripcion.alumno.id,
          inscripcion.alumno,
        ]),
      ).values(),
    );
  }

  private async obtenerMateriaIdsAlumno(
    alumnoId: number,
    grupoId?: number | null,
    materiaId?: number,
  ) {
    const periodo = getCurrentAcademicPeriod();
    const where: any = {
      alumnoId,
      estado: 'ACEPTADA',
      ...(materiaId ? { materiaId } : {}),
    };

    let inscripciones = await this.prisma.inscripcion.findMany({
      where: { ...where, periodo },
      select: { materiaId: true },
    });
    if (!inscripciones.length) {
      inscripciones = await this.prisma.inscripcion.findMany({
        where,
        select: { materiaId: true },
      });
    }

    const materiaIds = inscripciones.map(
      (inscripcion) => inscripcion.materiaId,
    );
    if (materiaIds.length) return [...new Set(materiaIds)];

    if (!grupoId) return [];
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: {
        materias: {
          where: materiaId ? { id: materiaId } : undefined,
          select: { id: true },
        },
      },
    });
    return grupo?.materias.map((materia) => materia.id) ?? [];
  }

  private perteneceAUnidad(
    item: any,
    unidad: { id: number | null; orden: number },
  ) {
    if (unidad.id != null && item.unidadId === unidad.id) return true;
    return item.unidad === unidad.orden;
  }

  private aplicaAGrupoAlumno(
    itemGrupoId?: number | null,
    alumnoGrupoId?: number | null,
    filtroGrupoId?: number,
  ) {
    if (filtroGrupoId) return itemGrupoId === filtroGrupoId;
    if (!itemGrupoId) return true;
    return itemGrupoId === alumnoGrupoId;
  }

  private resumirTareasAlumno(
    items: Array<{ entrega: any | null; tarea: any }>,
  ) {
    const entregadas = items.filter(
      (item) =>
        item.entrega && ESTADOS_CON_ENTREGA.has(item.entrega.estadoRevision),
    ).length;
    const calificadas = items.filter(
      (item) =>
        item.entrega?.estadoRevision === EstadoRevision.CALIFICADA &&
        typeof item.entrega?.calificacion === 'number',
    ).length;
    const pendientesRevision = items.filter(
      (item) =>
        item.entrega &&
        ESTADOS_PENDIENTES_REVISION.has(item.entrega.estadoRevision),
    ).length;

    return {
      total: items.length,
      entregadas,
      calificadas,
      pendientesRevision,
      sinEntregar: Math.max(items.length - entregadas, 0),
    };
  }

  private resumirAsistenciaAlumno(
    alumnoId: number,
    sesiones: Array<{ id: number }>,
    asistenciasPorSesionAlumno: Map<string, { estado: EstadoAsistencia }>,
  ) {
    const resumen = {
      totalSesiones: sesiones.length,
      registradas: 0,
      asistencias: 0,
      faltas: 0,
      retardos: 0,
      justificadas: 0,
      sinRegistro: 0,
      porcentaje: 0,
    };

    for (const sesion of sesiones) {
      const asistencia = asistenciasPorSesionAlumno.get(
        `${alumnoId}:${sesion.id}`,
      );
      if (!asistencia) {
        resumen.sinRegistro += 1;
        continue;
      }
      resumen.registradas += 1;
      if (asistencia.estado === EstadoAsistencia.ASISTENCIA) {
        resumen.asistencias += 1;
      } else if (asistencia.estado === EstadoAsistencia.FALTA) {
        resumen.faltas += 1;
      } else if (asistencia.estado === EstadoAsistencia.RETARDO) {
        resumen.retardos += 1;
      } else if (asistencia.estado === EstadoAsistencia.JUSTIFICADA) {
        resumen.justificadas += 1;
      }
    }

    resumen.porcentaje = resumen.registradas
      ? Math.round((resumen.asistencias / resumen.registradas) * 100)
      : 0;
    return resumen;
  }

  private obtenerEstadoCalificacion(calificacion: number | null) {
    if (calificacion == null) return 'PENDIENTE';
    return calificacion >= 70 ? 'APROBADO' : 'REQUIERE_ATENCION';
  }

  private calcularMetricas(rows: any[], unidadesCount: number) {
    const calificaciones = rows
      .map((row) => row.calificacionFinal ?? row.calificacionSugerida)
      .filter((value) => typeof value === 'number');

    return {
      totalFilas: rows.length,
      totalAlumnos: unidadesCount
        ? Math.round(rows.length / Math.max(unidadesCount, 1))
        : rows.length,
      aprobadas: rows.filter((row) => row.estado === 'APROBADO').length,
      requiereAtencion: rows.filter((row) => row.estado === 'REQUIERE_ATENCION')
        .length,
      pendientes: rows.filter((row) => row.estado === 'PENDIENTE').length,
      promedioGeneral: calificaciones.length
        ? Number(
            (
              calificaciones.reduce((sum, value) => sum + value, 0) /
              calificaciones.length
            ).toFixed(2),
          )
        : null,
    };
  }
}
