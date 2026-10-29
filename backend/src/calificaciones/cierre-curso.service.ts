import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EstadoUnidad, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import { CALIFICACION_APROBATORIA } from '../common/desempeno.util';
import {
  estadoUnidad,
  resultadoCurso,
  type EstadoCurso,
  type EstadoUnidadCierre,
  type NivelDesempeno,
} from '../common/cierre-curso.util';
import { CalificacionesService } from './calificaciones.service';
import { GuardarSegundaOportunidadDto } from './dto/guardar-segunda-oportunidad.dto';

type Actor = { id: number; rol: string; nombre?: string };

/** Lo que este servicio lee de cada fila del reporte de calificaciones. */
type FilaReporte = {
  alumno: {
    id: number;
    nombre: string;
    numeroControl?: string | null;
    sexo?: string | null;
  };
  unidad: { id: number | null } | null;
  calificacionFinal: number | null;
};

export type UnidadAlumnoCierre = {
  unidadId: number;
  primera: number | null;
  segunda: number | null;
  noPresento: boolean;
  estado: EstadoUnidadCierre;
  calificacion: number | null;
  oportunidad: 1 | 2 | null;
};

export type AlumnoCierre = {
  alumno: {
    id: number;
    nombre: string;
    numeroControl: string | null;
    sexo: string | null;
  };
  unidades: UnidadAlumnoCierre[];
  estado: EstadoCurso;
  final: number | null;
  nivel: NivelDesempeno | null;
};

/** Lo que se congela al cerrar: el concentrado tal como se entregó. */
export type FotoCierre = {
  docente: string | null;
  unidades: Array<{ id: number; nombre: string; orden: number }>;
  alumnos: AlumnoCierre[];
};

@Injectable()
export class CierreCursoService {
  constructor(
    private prisma: PrismaService,
    private calificaciones: CalificacionesService,
  ) {}

  /**
   * El cierre de una materia en un grupo: por alumno, cada unidad con su
   * oportunidad y el resultado del curso; si ya se cerró, la foto del cierre y
   * lo que cambió después.
   */
  async obtener(actor: Actor, materiaId: number, grupoId: number) {
    // Valida el acceso y calcula la calificación de primera oportunidad.
    const reporte = await this.calificaciones.obtenerReporteDocente(actor, {
      materiaId,
      grupoId,
    });
    const periodo = getCurrentAcademicPeriod();
    const unidades = (
      reporte.unidades as Array<{
        id: number | null;
        nombre: string;
        orden: number;
        status: EstadoUnidad | null;
      }>
    )
      .filter((unidad): unidad is typeof unidad & { id: number } =>
        Number.isInteger(unidad.id),
      )
      .map(({ id, nombre, orden, status }) => ({ id, nombre, orden, status }));

    const alumnosReporte = new Map<number, AlumnoCierre['alumno']>();
    const primeras = new Map<string, number | null>();
    for (const row of reporte.rows as FilaReporte[]) {
      alumnosReporte.set(row.alumno.id, {
        id: row.alumno.id,
        nombre: row.alumno.nombre,
        numeroControl: row.alumno.numeroControl ?? null,
        sexo: row.alumno.sexo ?? null,
      });
      if (row.unidad?.id != null) {
        primeras.set(
          `${row.alumno.id}:${row.unidad.id}`,
          typeof row.calificacionFinal === 'number'
            ? row.calificacionFinal
            : null,
        );
      }
    }

    const segundas = alumnosReporte.size
      ? await this.prisma.calificacionUnidad.findMany({
          where: {
            materiaId,
            periodo,
            alumnoId: { in: [...alumnosReporte.keys()] },
            unidadId: { in: unidades.map((unidad) => unidad.id) },
          },
          select: {
            alumnoId: true,
            unidadId: true,
            calificacionSegunda: true,
            segundaNoPresento: true,
          },
        })
      : [];
    const segundaDe = new Map(
      segundas.map((item) => [`${item.alumnoId}:${item.unidadId}`, item]),
    );

    const alumnos: AlumnoCierre[] = [...alumnosReporte.values()].map(
      (alumno) => {
        const porUnidad = unidades.map((unidad): UnidadAlumnoCierre => {
          const clave = `${alumno.id}:${unidad.id}`;
          // Una unidad abierta todavía no se evalúa: su calificación se mueve.
          const primera =
            unidad.status === EstadoUnidad.FINALIZADA
              ? (primeras.get(clave) ?? null)
              : null;
          const segunda = segundaDe.get(clave);
          return {
            unidadId: unidad.id,
            primera,
            segunda: segunda?.calificacionSegunda ?? null,
            noPresento: segunda?.segundaNoPresento ?? false,
            ...estadoUnidad({
              primera,
              segunda: segunda?.calificacionSegunda ?? null,
              noPresento: segunda?.segundaNoPresento ?? false,
            }),
          };
        });
        return { alumno, unidades: porUnidad, ...resultadoCurso(porUnidad) };
      },
    );

    const cierre = await this.prisma.cierreCurso.findUnique({
      where: { materiaId_grupoId_periodo: { materiaId, grupoId, periodo } },
    });
    const foto = cierre?.concentrado as unknown as FotoCierre | undefined;

    const bloqueos: string[] = [];
    if (!unidades.length) bloqueos.push('La materia no tiene unidades.');
    const abiertas = unidades.filter(
      (unidad) => unidad.status !== EstadoUnidad.FINALIZADA,
    );
    if (abiertas.length) {
      bloqueos.push(
        `Falta cerrar ${abiertas.map((unidad) => unidad.nombre).join(', ')}.`,
      );
    }
    const pendientes = alumnos.filter((item) =>
      item.unidades.some((unidad) => unidad.estado === 'PENDIENTE_SEGUNDA'),
    ).length;
    if (pendientes) {
      bloqueos.push(
        `${pendientes} ${pendientes === 1 ? 'alumno tiene' : 'alumnos tienen'} segunda oportunidad sin capturar.`,
      );
    }
    // Una unidad cerrada sin calificación dejaría al alumno pendiente para siempre.
    const sinCalificar = unidades
      .filter((unidad) => unidad.status === EstadoUnidad.FINALIZADA)
      .map((unidad) => ({
        unidad,
        alumnos: alumnos.filter(
          (item) =>
            item.unidades.find((celda) => celda.unidadId === unidad.id)
              ?.estado === 'SIN_CALIFICAR',
        ).length,
      }))
      .filter((item) => item.alumnos);
    for (const { unidad, alumnos: cuantos } of sinCalificar) {
      bloqueos.push(
        `${cuantos} ${cuantos === 1 ? 'alumno no tiene' : 'alumnos no tienen'} calificación en ${unidad.nombre}.`,
      );
    }
    if (!alumnos.length) bloqueos.push('El grupo no tiene alumnos inscritos.');

    return {
      materia: reporte.materia,
      grupo: reporte.grupoSeleccionado,
      periodo,
      aprobatoria: CALIFICACION_APROBATORIA,
      unidades,
      alumnos,
      resumen: this.resumir(alumnos),
      porUnidad: unidades.map((unidad) => {
        const estados = alumnos.map(
          (item) =>
            item.unidades.find((celda) => celda.unidadId === unidad.id)?.estado,
        );
        const contar = (estado: EstadoUnidadCierre) =>
          estados.filter((item) => item === estado).length;
        return {
          unidadId: unidad.id,
          alcanzadaPrimera: contar('ALCANZADA'),
          alcanzadaSegunda: contar('ALCANZADA_SEGUNDA'),
          pendienteSegunda: contar('PENDIENTE_SEGUNDA'),
          noAlcanzada: contar('NO_ALCANZADA'),
          sinCalificar: contar('SIN_CALIFICAR'),
        };
      }),
      cierre: cierre
        ? {
            cerradoEn: cierre.cerradoEn,
            docente: foto?.docente ?? null,
            foto,
            cambios: this.cambiosDesdeCierre(foto, alumnos),
          }
        : null,
      puedeCerrar: !cierre && !bloqueos.length,
      bloqueos: cierre ? [] : bloqueos,
    };
  }

  async guardarSegunda(actor: Actor, dto: GuardarSegundaOportunidadDto) {
    const actual = await this.obtener(actor, dto.materiaId, dto.grupoId);
    if (actual.cierre) {
      throw new ConflictException(
        'El curso está cerrado. Reábrelo para cambiar la segunda oportunidad.',
      );
    }
    const periodo = getCurrentAcademicPeriod();
    const capturas = dto.capturas.map((captura) => {
      const alumno = actual.alumnos.find(
        (item) => item.alumno.id === captura.alumnoId,
      );
      const celda = alumno?.unidades.find(
        (item) => item.unidadId === captura.unidadId,
      );
      if (!alumno || !celda) {
        throw new BadRequestException(
          'El alumno o la unidad no pertenecen a este curso',
        );
      }
      if (celda.primera == null || celda.primera >= CALIFICACION_APROBATORIA) {
        throw new BadRequestException(
          `${alumno.alumno.nombre} no necesita segunda oportunidad en esa unidad`,
        );
      }
      const calificacion = captura.noPresento
        ? null
        : (captura.calificacion ?? null);
      return { ...captura, calificacion };
    });

    await this.prisma.$transaction(
      capturas.map((captura) =>
        this.prisma.calificacionUnidad.upsert({
          where: {
            alumnoId_materiaId_unidadId_periodo: {
              alumnoId: captura.alumnoId,
              materiaId: dto.materiaId,
              unidadId: captura.unidadId,
              periodo,
            },
          },
          create: {
            alumnoId: captura.alumnoId,
            materiaId: dto.materiaId,
            unidadId: captura.unidadId,
            grupoId: dto.grupoId,
            periodo,
            calificacionSegunda: captura.calificacion,
            segundaNoPresento: Boolean(captura.noPresento),
            docenteId: actor.id,
          },
          update: {
            calificacionSegunda: captura.calificacion,
            segundaNoPresento: Boolean(captura.noPresento),
            docenteId: actor.id,
          },
        }),
      ),
    );
    return this.obtener(actor, dto.materiaId, dto.grupoId);
  }

  async cerrar(actor: Actor, materiaId: number, grupoId: number) {
    const actual = await this.obtener(actor, materiaId, grupoId);
    if (actual.cierre) throw new ConflictException('El curso ya está cerrado');
    if (actual.bloqueos.length) {
      throw new ConflictException(
        `Todavía no se puede cerrar: ${actual.bloqueos.join(' ')}`,
      );
    }
    const foto: FotoCierre = {
      docente: actor.nombre ?? actual.materia?.docente?.nombre ?? null,
      unidades: actual.unidades.map(({ id, nombre, orden }) => ({
        id,
        nombre,
        orden,
      })),
      alumnos: actual.alumnos,
    };
    try {
      await this.prisma.cierreCurso.create({
        data: {
          materiaId,
          grupoId,
          periodo: actual.periodo,
          docenteId: actor.id,
          concentrado: foto as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // Dos cierres simultáneos: el segundo choca con el índice único.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El curso ya está cerrado');
      }
      throw error;
    }
    return this.obtener(actor, materiaId, grupoId);
  }

  async reabrir(actor: Actor, materiaId: number, grupoId: number) {
    // Valida el acceso antes de tocar nada.
    await this.calificaciones.obtenerReporteDocente(actor, {
      materiaId,
      grupoId,
    });
    await this.prisma.cierreCurso.deleteMany({
      where: { materiaId, grupoId, periodo: getCurrentAcademicPeriod() },
    });
    return this.obtener(actor, materiaId, grupoId);
  }

  private resumir(alumnos: AlumnoCierre[]) {
    const contar = (estado: EstadoCurso) =>
      alumnos.filter((item) => item.estado === estado).length;
    const finales = alumnos
      .map((item) => item.final)
      .filter((final): final is number => final != null);
    return {
      total: alumnos.length,
      acreditados: contar('ACREDITADO'),
      noAcreditados: contar('NO_ACREDITADO'),
      pendientes: contar('PENDIENTE'),
      promedio: finales.length
        ? Math.round(
            (finales.reduce((suma, final) => suma + final, 0) /
              finales.length) *
              10,
          ) / 10
        : null,
    };
  }

  /** Alumnos cuyo resultado de hoy ya no es el que quedó en el cierre. */
  private cambiosDesdeCierre(
    foto: FotoCierre | undefined,
    alumnos: AlumnoCierre[],
  ) {
    if (!foto) return [];
    const antes = new Map(foto.alumnos.map((item) => [item.alumno.id, item]));
    return alumnos
      .filter((item) => {
        const previo = antes.get(item.alumno.id);
        return (
          !previo ||
          previo.final !== item.final ||
          previo.estado !== item.estado
        );
      })
      .map((item) => ({
        alumno: item.alumno,
        antes: antes.get(item.alumno.id)?.final ?? null,
        ahora: item.final,
      }));
  }
}
