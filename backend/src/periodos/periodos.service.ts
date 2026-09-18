import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ModalidadGrupo, Rol } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  formatearFechaClave,
  obtenerFinDelDia,
  obtenerInicioDelDia,
  parsearFechaClave,
  horarioAplicaEnFecha,
  sumarDias,
} from '../clases/clases.utils';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import { MODALIDADES, modalidadDeHorario } from '../common/modalidad.util';

/** Un periodo escolar no dura ni menos de un mes ni más de un año. */
const DIAS_MINIMOS = 30;
const DIAS_MAXIMOS = 366;

/** Un semestre mixto son 16 sábados de clase. */
export const SABADOS_POR_SEMESTRE = 16;

/** Cómo va el semestre mixto contado en sábados, que es su unidad real. */
export type ResumenSabados = {
  requeridos: number;
  /** Sábados dentro del rango, tengan clase o no. */
  total: number;
  conClase: number;
  /** Sábados con clase que ya pasaron (hoy incluido si es sábado). */
  transcurridos: number;
  /** Sábados del rango marcados sin clases (festivos o suspensiones). */
  sinClases: Array<{ fecha: string; motivo: string; institucional: boolean }>;
  /** Sábado en que se completarían los 16 con clase, si el rango se queda corto. */
  finSugerido: string | null;
};

export type PeriodoModalidad = {
  clave: string;
  modalidad: ModalidadGrupo;
  fechaInicio: string;
  fechaFin: string;
  configurado: boolean;
  actualizadoEn: Date | null;
};

/** Los dos calendarios del periodo en curso, tal como los ve un usuario. */
export type PeriodosActuales = {
  clave: string;
  escolarizado: PeriodoModalidad & { aplica: boolean };
  /** `sabados` sólo cuando las fechas son reales: sobre un estimado no dice nada. */
  mixto: PeriodoModalidad & {
    aplica: boolean;
    sabados: ResumenSabados | null;
  };
  /** Unión de las fechas de las modalidades que le aplican al usuario. */
  rango: { fechaInicio: string; fechaFin: string };
};

type Actor = { id: number; rol: Rol };

/** Un día sin clases tal como lo ve un docente, venga de él o de la institución. */
export type SuspensionVigente = {
  id: number;
  fecha: string;
  motivo: string;
  institucional: boolean;
};

export type SuspensionDeDocente = Omit<SuspensionVigente, 'id'> & {
  /** Prefijado por origen para que no choquen ids de tablas distintas. */
  id: string;
  docenteId: number;
};

@Injectable()
export class PeriodosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Fechas del periodo en curso para una modalidad. Mientras nadie las haya
   * capturado se devuelve un estimado por el calendario (enero–junio o
   * julio–diciembre) marcado con `configurado: false`, para que la interfaz
   * pida las reales en vez de fingir que las sabe.
   */
  async obtenerActual(
    referencia = new Date(),
    modalidad: ModalidadGrupo = 'ESCOLARIZADO',
  ): Promise<PeriodoModalidad> {
    const clave = getCurrentAcademicPeriod(referencia);
    const guardado = await this.prisma.periodoAcademico.findUnique({
      where: { clave_modalidad: { clave, modalidad } },
    });

    if (guardado) {
      return {
        clave,
        modalidad,
        fechaInicio: formatearFechaClave(guardado.fechaInicio),
        fechaFin: formatearFechaClave(guardado.fechaFin),
        configurado: true,
        actualizadoEn: guardado.updatedAt,
      };
    }

    const anio = referencia.getFullYear();
    const primerSemestre = referencia.getMonth() + 1 <= 6;
    return {
      clave,
      modalidad,
      fechaInicio: formatearFechaClave(
        new Date(anio, primerSemestre ? 0 : 6, 1),
      ),
      fechaFin: formatearFechaClave(
        new Date(anio, primerSemestre ? 5 : 11, primerSemestre ? 30 : 31),
      ),
      configurado: false,
      actualizadoEn: null,
    };
  }

  /**
   * Los dos calendarios del periodo en curso, marcando cuáles le tocan a quien
   * pregunta: al admin y al jefe de carrera ambos; al docente los de sus
   * grupos (escolarizado mientras no tenga ninguno); al alumno el de su grupo.
   */
  async obtenerActualesPara(
    actor: Actor,
    referencia = new Date(),
  ): Promise<PeriodosActuales> {
    const [escolarizado, mixto, modalidades] = await Promise.all([
      this.obtenerActual(referencia, 'ESCOLARIZADO'),
      this.obtenerActual(referencia, 'MIXTO'),
      this.modalidadesDe(actor),
    ]);
    const periodos = { escolarizado, mixto };
    const aplicaMixto = modalidades.includes('MIXTO');
    // El docente descuenta también sus propios días sin clases; los demás
    // sólo ven los festivos institucionales.
    const sinClases =
      mixto.configurado && aplicaMixto
        ? actor.rol === 'DOCENTE'
          ? await this.listarSuspensiones(actor.id, referencia)
          : (await this.listarSuspensionesInstitucionales(referencia)).map(
              (item) => ({ ...item, institucional: true }),
            )
        : null;
    return {
      clave: escolarizado.clave,
      escolarizado: {
        ...escolarizado,
        aplica: modalidades.includes('ESCOLARIZADO'),
      },
      mixto: {
        ...mixto,
        aplica: aplicaMixto,
        sabados: sinClases ? contarSabados(mixto, sinClases, referencia) : null,
      },
      rango: rangoDe(periodos, modalidades),
    };
  }

  /** Modalidades de los grupos del docente; escolarizado si aún no tiene. */
  async modalidadesDeDocente(docenteId: number): Promise<ModalidadGrupo[]> {
    const [horarios, agregados] = await Promise.all([
      this.prisma.horarioMateria.findMany({
        where: { docenteId, activo: true },
        select: { dias: true, grupo: { select: { modalidad: true } } },
      }),
      this.prisma.grupo.findMany({
        where: { activo: true, docentes: { some: { id: docenteId } } },
        select: { modalidad: true },
      }),
    ]);
    const propias = new Set<ModalidadGrupo>([
      ...horarios.map(modalidadDeHorario),
      ...agregados.map((grupo) => grupo.modalidad),
    ]);
    if (!propias.size) return ['ESCOLARIZADO'];
    return MODALIDADES.filter((modalidad) => propias.has(modalidad));
  }

  private async modalidadesDe(actor: Actor): Promise<ModalidadGrupo[]> {
    if (actor.rol === 'DOCENTE') return this.modalidadesDeDocente(actor.id);
    if (actor.rol === 'ALUMNO') {
      const alumno = await this.prisma.usuario.findUnique({
        where: { id: actor.id },
        select: { grupo: { select: { modalidad: true } } },
      });
      return [alumno?.grupo?.modalidad ?? 'ESCOLARIZADO'];
    }
    return [...MODALIDADES];
  }

  /** Límites reales del periodo, ya como fechas locales, para acotar consultas. */
  async obtenerRangoActual(
    referencia = new Date(),
    modalidad: ModalidadGrupo = 'ESCOLARIZADO',
  ) {
    const periodo = await this.obtenerActual(referencia, modalidad);
    return {
      clave: periodo.clave,
      modalidad,
      configurado: periodo.configurado,
      inicio: obtenerInicioDelDia(
        parsearFechaClave(periodo.fechaInicio) as Date,
      ),
      fin: obtenerFinDelDia(parsearFechaClave(periodo.fechaFin) as Date),
    };
  }

  /**
   * Guarda las fechas de una modalidad del periodo en curso. El docente sólo
   * puede tocar las de las modalidades en las que da clase; el admin, ambas.
   */
  async actualizarActual(
    actor: Actor,
    dto: { fechaInicio: string; fechaFin: string; modalidad?: ModalidadGrupo },
    referencia = new Date(),
  ) {
    const modalidad = dto.modalidad ?? 'ESCOLARIZADO';
    if (
      actor.rol === 'DOCENTE' &&
      !(await this.modalidadesDeDocente(actor.id)).includes(modalidad)
    ) {
      throw new ForbiddenException(
        modalidad === 'MIXTO'
          ? 'No tienes grupos mixtos: sólo puedes editar el periodo escolarizado'
          : 'No tienes grupos escolarizados: sólo puedes editar el periodo mixto',
      );
    }

    const inicio = parsearFechaClave(dto.fechaInicio);
    const fin = parsearFechaClave(dto.fechaFin);
    if (!inicio || !fin) throw new BadRequestException('Fecha inválida');

    if (fin <= inicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }

    const dias = Math.round((fin.getTime() - inicio.getTime()) / 86400000);
    if (dias < DIAS_MINIMOS) {
      throw new BadRequestException(
        `El periodo debe durar al menos ${DIAS_MINIMOS} días`,
      );
    }
    if (dias > DIAS_MAXIMOS) {
      throw new BadRequestException(
        `El periodo no puede durar más de ${DIAS_MAXIMOS} días`,
      );
    }
    if (modalidad === 'MIXTO') {
      if (inicio.getDay() !== 6) {
        throw new BadRequestException('El semestre mixto inicia en sábado');
      }
      const sabados = sabadosEntre(inicio, fin).length;
      if (sabados < SABADOS_POR_SEMESTRE) {
        throw new BadRequestException(
          `El rango sólo tiene ${sabados} sábados; el semestre mixto necesita ${SABADOS_POR_SEMESTRE}`,
        );
      }
    }

    const clave = getCurrentAcademicPeriod(referencia);
    await this.prisma.periodoAcademico.upsert({
      where: { clave_modalidad: { clave, modalidad } },
      create: {
        clave,
        modalidad,
        fechaInicio: inicio,
        fechaFin: fin,
        actualizadoPorId: actor.id,
      },
      update: {
        fechaInicio: inicio,
        fechaFin: fin,
        actualizadoPorId: actor.id,
      },
    });

    return this.obtenerActual(referencia, modalidad);
  }

  /**
   * Días sin clases del docente en el periodo en curso: los suyos más los que
   * marcó la institución. Si una fecha aparece en ambos manda el institucional,
   * porque el docente no puede levantarlo.
   */
  async listarSuspensiones(
    docenteId: number,
    referencia = new Date(),
  ): Promise<SuspensionVigente[]> {
    const periodo = await this.obtenerActual(referencia);
    const [propias, institucionales] = await Promise.all([
      this.prisma.suspensionClase.findMany({
        where: { docenteId, periodoClave: periodo.clave },
        select: { id: true, fecha: true, motivo: true },
      }),
      this.prisma.suspensionInstitucional.findMany({
        where: { periodoClave: periodo.clave },
        select: { id: true, fecha: true, motivo: true },
      }),
    ]);
    const porFecha = new Map<string, SuspensionVigente>();
    for (const item of propias) {
      porFecha.set(item.fecha, { ...item, institucional: false });
    }
    for (const item of institucionales) {
      porFecha.set(item.fecha, { ...item, institucional: true });
    }
    return [...porFecha.values()].sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
  }

  /** Suspensión vigente para un docente en una fecha, o null si hay clases. */
  async obtenerSuspension(
    docenteId: number,
    fecha: Date,
  ): Promise<SuspensionVigente | null> {
    const clave = formatearFechaClave(fecha);
    const institucional = await this.prisma.suspensionInstitucional.findUnique({
      where: { fecha: clave },
      select: { id: true, fecha: true, motivo: true },
    });
    if (institucional) return { ...institucional, institucional: true };
    const propia = await this.prisma.suspensionClase.findUnique({
      where: { docenteId_fecha: { docenteId, fecha: clave } },
      select: { id: true, fecha: true, motivo: true },
    });
    return propia ? { ...propia, institucional: false } : null;
  }

  /**
   * Qué docentes de la lista no tienen clases en la fecha. Con suspensión
   * institucional son todos; si no, sólo los que marcaron ese día.
   */
  async suspensionesDelDia(fecha: Date, docenteIds: number[]) {
    const resultado = new Map<number, SuspensionVigente>();
    if (!docenteIds.length) return resultado;
    const clave = formatearFechaClave(fecha);
    const institucional = await this.prisma.suspensionInstitucional.findUnique({
      where: { fecha: clave },
      select: { id: true, fecha: true, motivo: true },
    });
    if (institucional) {
      for (const docenteId of docenteIds) {
        resultado.set(docenteId, { ...institucional, institucional: true });
      }
      return resultado;
    }
    const propias = await this.prisma.suspensionClase.findMany({
      where: { fecha: clave, docenteId: { in: docenteIds } },
      select: { id: true, docenteId: true, fecha: true, motivo: true },
    });
    for (const item of propias) {
      resultado.set(item.docenteId, {
        id: item.id,
        fecha: item.fecha,
        motivo: item.motivo,
        institucional: false,
      });
    }
    return resultado;
  }

  /**
   * Suspensiones de varios docentes, opcionalmente acotadas a un rango de
   * claves `YYYY-MM-DD`. Las institucionales se expanden a cada docente para
   * que quien las consuma no tenga que distinguir el origen.
   */
  async listarSuspensionesDeDocentes(
    docenteIds: number[],
    rango?: { gte?: string; lte?: string },
  ): Promise<SuspensionDeDocente[]> {
    if (!docenteIds.length) return [];
    const fecha =
      rango?.gte || rango?.lte
        ? {
            ...(rango.gte ? { gte: rango.gte } : {}),
            ...(rango.lte ? { lte: rango.lte } : {}),
          }
        : undefined;
    const [propias, institucionales] = await Promise.all([
      this.prisma.suspensionClase.findMany({
        where: { docenteId: { in: docenteIds }, ...(fecha ? { fecha } : {}) },
        select: { id: true, docenteId: true, fecha: true, motivo: true },
      }),
      this.prisma.suspensionInstitucional.findMany({
        where: fecha ? { fecha } : {},
        select: { id: true, fecha: true, motivo: true },
      }),
    ]);
    const porClave = new Map<string, SuspensionDeDocente>();
    for (const item of propias) {
      porClave.set(`${item.docenteId}:${item.fecha}`, {
        id: `docente-${item.id}`,
        docenteId: item.docenteId,
        fecha: item.fecha,
        motivo: item.motivo,
        institucional: false,
      });
    }
    for (const item of institucionales) {
      for (const docenteId of docenteIds) {
        porClave.set(`${docenteId}:${item.fecha}`, {
          id: `institucional-${item.id}`,
          docenteId,
          fecha: item.fecha,
          motivo: item.motivo,
          institucional: true,
        });
      }
    }
    return [...porClave.values()];
  }

  async guardarSuspensiones(
    docenteId: number,
    dto: { fechas: string[]; motivo: string },
  ) {
    const { motivo, fechas, periodo } = await this.validarSuspensiones(
      dto,
      docenteId,
    );
    const horarios = await this.prisma.horarioMateria.findMany({
      where: { docenteId, activo: true },
      select: { dias: true },
    });
    const institucionales = new Set(
      (
        await this.prisma.suspensionInstitucional.findMany({
          where: { fecha: { in: fechas } },
          select: { fecha: true },
        })
      ).map((item) => item.fecha),
    );
    for (const clave of fechas) {
      if (institucionales.has(clave)) {
        throw new BadRequestException(
          `El ${clave} ya está marcado sin clases para toda la institución`,
        );
      }
      if (
        !horarios.some((horario) =>
          horarioAplicaEnFecha(horario.dias, parsearFechaClave(clave) as Date),
        )
      ) {
        throw new BadRequestException(
          `No tienes clases programadas el ${clave}`,
        );
      }
    }
    await this.validarSinListasCapturadas(fechas, docenteId);

    await this.prisma.$transaction(
      fechas.map((fecha) =>
        this.prisma.suspensionClase.upsert({
          where: { docenteId_fecha: { docenteId, fecha } },
          create: { docenteId, periodoClave: periodo.clave, fecha, motivo },
          update: { periodoClave: periodo.clave, motivo },
        }),
      ),
    );
    return this.listarSuspensiones(docenteId);
  }

  async eliminarSuspension(docenteId: number, fecha: string) {
    const parsed = parsearFechaClave(fecha);
    if (!parsed || formatearFechaClave(parsed) !== fecha) {
      throw new BadRequestException('Fecha inválida');
    }
    await this.prisma.suspensionClase.deleteMany({
      where: { docenteId, fecha },
    });
    return this.listarSuspensiones(docenteId);
  }

  async listarSuspensionesInstitucionales(referencia = new Date()) {
    const periodo = await this.obtenerActual(referencia);
    return this.prisma.suspensionInstitucional.findMany({
      where: { periodoClave: periodo.clave },
      orderBy: { fecha: 'asc' },
      select: { id: true, fecha: true, motivo: true },
    });
  }

  /** Día sin clases para todos los docentes; sólo el admin lo marca. */
  async guardarSuspensionesInstitucionales(
    actorId: number,
    dto: { fechas: string[]; motivo: string },
  ) {
    const { motivo, fechas, periodo } = await this.validarSuspensiones(dto);
    await this.validarSinListasCapturadas(fechas);

    await this.prisma.$transaction(
      fechas.map((fecha) =>
        this.prisma.suspensionInstitucional.upsert({
          where: { fecha },
          create: {
            periodoClave: periodo.clave,
            fecha,
            motivo,
            creadoPorId: actorId,
          },
          update: { periodoClave: periodo.clave, motivo, creadoPorId: actorId },
        }),
      ),
    );
    return this.listarSuspensionesInstitucionales();
  }

  async eliminarSuspensionInstitucional(fecha: string) {
    const parsed = parsearFechaClave(fecha);
    if (!parsed || formatearFechaClave(parsed) !== fecha) {
      throw new BadRequestException('Fecha inválida');
    }
    await this.prisma.suspensionInstitucional.deleteMany({ where: { fecha } });
    return this.listarSuspensionesInstitucionales();
  }

  /**
   * Motivo y fechas válidas, únicas y dentro del periodo en curso. Con
   * `docenteId` el periodo es el de sus modalidades; sin él (institucional)
   * cuenta cualquier fecha de cualquiera de las dos.
   */
  private async validarSuspensiones(
    dto: { fechas: string[]; motivo: string },
    docenteId?: number,
  ) {
    const motivo = dto.motivo?.trim();
    if (!motivo || motivo.length > 500) {
      throw new BadRequestException(
        'Escribe un motivo de hasta 500 caracteres',
      );
    }
    const fechas = [...new Set(dto.fechas ?? [])].sort();
    if (!fechas.length || fechas.length > 31) {
      throw new BadRequestException('Selecciona entre 1 y 31 fechas');
    }
    const [escolarizado, mixto, modalidades] = await Promise.all([
      this.obtenerActual(new Date(), 'ESCOLARIZADO'),
      this.obtenerActual(new Date(), 'MIXTO'),
      docenteId ? this.modalidadesDeDocente(docenteId) : [...MODALIDADES],
    ]);
    const rango = rangoDe({ escolarizado, mixto }, modalidades);
    for (const clave of fechas) {
      const fecha = parsearFechaClave(clave);
      if (!fecha || formatearFechaClave(fecha) !== clave) {
        throw new BadRequestException(`Fecha inválida: ${clave}`);
      }
      if (clave < rango.fechaInicio || clave > rango.fechaFin) {
        throw new BadRequestException(
          `${clave} está fuera del periodo escolar`,
        );
      }
    }
    return { motivo, fechas, periodo: escolarizado };
  }

  /**
   * Un día con una clase abierta o con lista ya pasada no se puede suspender:
   * habría asistencias de un día que "no existió". Sin `docenteId` revisa a
   * todos, que es lo que aplica a una suspensión institucional.
   */
  private async validarSinListasCapturadas(
    fechas: string[],
    docenteId?: number,
  ) {
    const sesiones = await this.prisma.claseSesion.findMany({
      where: {
        ...(docenteId ? { docenteId } : {}),
        fecha: {
          gte: obtenerInicioDelDia(parsearFechaClave(fechas[0]) as Date),
          lte: obtenerFinDelDia(
            parsearFechaClave(fechas[fechas.length - 1]) as Date,
          ),
        },
      },
      select: {
        fecha: true,
        activa: true,
        _count: { select: { asistencias: true } },
      },
    });
    for (const clave of fechas) {
      if (
        sesiones.some(
          (sesion) =>
            formatearFechaClave(sesion.fecha) === clave &&
            (sesion.activa || sesion._count.asistencias > 0),
        )
      ) {
        throw new ConflictException(
          `El ${clave} tiene una clase activa o asistencias capturadas`,
        );
      }
    }
  }
}

/**
 * Unión de las fechas de las modalidades indicadas. Una modalidad sin fechas
 * capturadas sólo cuenta cuando ninguna las tiene: su estimado abarca medio
 * año y taparía el calendario real de la otra.
 */
export function rangoDe(
  periodos: { escolarizado: PeriodoModalidad; mixto: PeriodoModalidad },
  modalidades: ModalidadGrupo[],
) {
  const propios = (modalidades.length ? modalidades : ['ESCOLARIZADO']).map(
    (modalidad) =>
      modalidad === 'MIXTO' ? periodos.mixto : periodos.escolarizado,
  );
  const configurados = propios.filter((periodo) => periodo.configurado);
  const base = configurados.length ? configurados : propios;
  return {
    fechaInicio: base.map((p) => p.fechaInicio).sort()[0],
    fechaFin: base
      .map((p) => p.fechaFin)
      .sort()
      .at(-1) as string,
  };
}

/** Claves de los sábados entre dos fechas, ambas incluidas. */
function sabadosEntre(inicio: Date, fin: Date) {
  const claves: string[] = [];
  let dia = sumarDias(inicio, (6 - inicio.getDay() + 7) % 7);
  for (; dia <= fin; dia = sumarDias(dia, 7)) {
    claves.push(formatearFechaClave(dia));
  }
  return claves;
}

/**
 * Sábados del semestre mixto: cuántos caen en el rango, cuáles quedan sin
 * clase y por cuál va. Si los festivos dejan menos de {@link SABADOS_POR_SEMESTRE}
 * con clase, `finSugerido` es el sábado en que se completarían.
 */
export function contarSabados(
  periodo: { fechaInicio: string; fechaFin: string },
  suspensiones: Array<{
    fecha: string;
    motivo: string;
    institucional: boolean;
  }>,
  hoy = new Date(),
): ResumenSabados {
  const inicio = parsearFechaClave(periodo.fechaInicio) as Date;
  const fin = parsearFechaClave(periodo.fechaFin) as Date;
  const suspendidos = new Map(suspensiones.map((item) => [item.fecha, item]));
  const hoyClave = formatearFechaClave(hoy);

  const sabados = sabadosEntre(inicio, fin);
  const sinClases = sabados
    .filter((clave) => suspendidos.has(clave))
    .map((clave) => {
      const { fecha, motivo, institucional } = suspendidos.get(clave)!;
      return { fecha, motivo, institucional };
    });
  const conClase = sabados.filter((clave) => !suspendidos.has(clave));

  let finSugerido: string | null = null;
  let faltan = SABADOS_POR_SEMESTRE - conClase.length;
  for (let dia = sumarDias(fin, 1); faltan > 0; dia = sumarDias(dia, 1)) {
    if (dia.getDay() !== 6 || suspendidos.has(formatearFechaClave(dia))) {
      continue;
    }
    faltan -= 1;
    if (faltan === 0) finSugerido = formatearFechaClave(dia);
  }

  return {
    requeridos: SABADOS_POR_SEMESTRE,
    total: sabados.length,
    conClase: conClase.length,
    transcurridos: conClase.filter((clave) => clave <= hoyClave).length,
    sinClases,
    finSugerido,
  };
}
