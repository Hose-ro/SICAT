import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAsistencia, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CalificacionesService } from '../calificaciones/calificaciones.service';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import {
  combinarFechaYHora,
  formatearFechaClave,
  horarioAplicaEnFecha,
  obtenerInicioDelDia,
  sumarDias,
} from '../clases/clases.utils';
import { IncorporarAlumnoDto } from './dto/incorporar-alumno.dto';
import {
  coincidenHorarios,
  estadoCaptura,
  fechaSupervision,
  grupoPerteneceAPeriodo,
  horasSemanal,
  periodoCanonicoDeGrupo,
  periodoSupervision,
  rangoPeriodo,
  resumenCierre,
} from './supervision.utils';

const persona = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  numeroControl: true,
  semestre: true,
  grupoId: true,
} as const;
const grupoCampos = {
  id: true,
  nombre: true,
  semestre: true,
  modalidad: true,
  periodo: true,
  carreraId: true,
} as const;
const horarioInclude = {
  materia: { select: { id: true, nombre: true, clave: true } },
  docente: { select: persona },
  grupo: { select: grupoCampos },
  aula: { select: { id: true, nombre: true } },
} as const;
type Consulta = { carreraId: number; periodo?: string };
type HorarioSupervision = Prisma.HorarioMateriaGetPayload<{
  include: typeof horarioInclude;
}>;
type FilaReporte = Awaited<
  ReturnType<CalificacionesService['obtenerReporteJefatura']>
>['rows'][number];
type ClaseSupervision = Pick<
  HorarioSupervision,
  'horaInicio' | 'horaFin' | 'docente' | 'materia' | 'aula'
> & {
  grupo: NonNullable<HorarioSupervision['grupo']>;
  id: string;
  horarioId: number;
  fecha: string;
  estado: ReturnType<typeof estadoCaptura>;
  elegible: boolean;
  calendarioConfigurado: boolean;
  alumnos: number;
  registros: number;
  sesionId: number | null;
  capturadaEn: Date | null;
  unidad: { id: number; nombre: string; orden: number } | null;
  suspensionMotivo: string | null;
  conflictos: string[];
};
type CausaRiesgo = {
  materia: { id: number; nombre: string; clave: string };
  grupo: { id: number; nombre: string };
  unidad: FilaReporte['unidad'];
  motivos: FilaReporte['motivos'];
  calificacion: FilaReporte['calificacionFinal'];
  asistencia: FilaReporte['asistencia'];
};

@Injectable()
export class SupervisionService {
  constructor(
    private prisma: PrismaService,
    private calificaciones: CalificacionesService,
  ) {}

  private async alcance(usuarioId: number, carreraId: number) {
    if (!Number.isInteger(carreraId) || carreraId < 1)
      throw new BadRequestException('Selecciona una carrera');
    const asignacion = await this.prisma.jefeCarreraAsignacion.findFirst({
      where: { usuarioId, carreraId, activa: true },
      select: { id: true },
    });
    if (!asignacion)
      throw new ForbiddenException('Carrera fuera de tu alcance');
  }

  async contexto(usuarioId: number) {
    const carreras = await this.prisma.carrera.findMany({
      where: { jefes: { some: { usuarioId, activa: true } } },
      select: { id: true, nombre: true, codigo: true },
      orderBy: { nombre: 'asc' },
    });
    const grupos = await this.prisma.grupo.findMany({
      where: { carreraId: { in: carreras.map((c) => c.id) } },
      select: { periodo: true, createdAt: true },
    });
    return {
      carreras,
      periodoActual: getCurrentAcademicPeriod(),
      periodos: [
        ...new Set([
          getCurrentAcademicPeriod(),
          ...grupos
            .map((grupo) =>
              periodoCanonicoDeGrupo(grupo.periodo, grupo.createdAt),
            )
            .filter((p): p is string => Boolean(p)),
        ]),
      ]
        .sort()
        .reverse(),
    };
  }

  private async calendarios(periodo: string) {
    const guardados = await this.prisma.periodoAcademico.findMany({
      where: { clave: periodo },
    });
    const rango = rangoPeriodo(periodo);
    return (['ESCOLARIZADO', 'MIXTO'] as const).map((modalidad) => {
      const real = guardados.find((p) => p.modalidad === modalidad);
      return {
        modalidad,
        configurado: !!real,
        inicio: real?.fechaInicio ?? rango.inicio,
        fin: real?.fechaFin ?? rango.fin,
      };
    });
  }

  private async gruposDelPeriodo(carreraId: number, periodo: string) {
    const grupos = await this.prisma.grupo.findMany({
      where: { carreraId, activo: true },
      select: { id: true, periodo: true, createdAt: true },
    });
    return grupos.filter((grupo) => grupoPerteneceAPeriodo(grupo, periodo));
  }

  private async ofertas(carreraId: number, grupoIds?: number[]) {
    const gruposActivos = {
      carreraId,
      activo: true,
      ...(grupoIds ? { id: { in: grupoIds } } : {}),
    };
    const materias = await this.prisma.materia.findMany({
      where: {
        carreraId,
        grupos: { some: gruposActivos },
      },
      include: {
        docente: { select: persona },
        unidades: { orderBy: { orden: 'asc' } },
        grupos: {
          where: gruposActivos,
          select: grupoCampos,
        },
        horarios: {
          where: { activo: true, grupo: gruposActivos },
          include: horarioInclude,
        },
      },
      orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
    });
    return materias.flatMap((m) =>
      m.grupos.map((grupo) => {
        const horarios = m.horarios.filter((h) => h.grupoId === grupo.id);
        const docentes = [
          ...new Map(
            [
              ...horarios.map((h) => h.docente),
              ...(m.docente ? [m.docente] : []),
            ].map((d) => [d.id, d]),
          ).values(),
        ];
        return {
          id: `${m.id}:${grupo.id}`,
          materia: {
            id: m.id,
            nombre: m.nombre,
            clave: m.clave,
            semestre: m.semestre,
          },
          grupo,
          docentes,
          horarios,
          unidades: m.unidades,
        };
      }),
    );
  }

  async reporte(
    usuarioId: number,
    consulta: Consulta,
    materiaId: number,
    grupoId: number,
  ) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    const grupoEncontrado = await this.prisma.grupo.findFirst({
      where: {
        id: grupoId,
        carreraId: consulta.carreraId,
        activo: true,
      },
      select: { ...grupoCampos, createdAt: true },
    });
    if (!grupoEncontrado || !grupoPerteneceAPeriodo(grupoEncontrado, periodo))
      throw new NotFoundException(
        'Grupo fuera de la carrera o periodo seleccionado',
      );
    const { createdAt: _createdAt, ...grupo } = grupoEncontrado;
    const calendarios = await this.calendarios(periodo);
    const calendario = calendarios.find(
      (c) => c.modalidad === grupo.modalidad,
    )!;
    const reporte = await this.calificaciones.obtenerReporteJefatura(
      usuarioId,
      consulta.carreraId,
      periodo,
      materiaId,
      grupoId,
      { inicio: calendario.inicio, fin: calendario.fin },
      [periodo, grupo.periodo],
    );
    return { ...reporte, periodo, grupo, calendario, avanceCompartido: true };
  }

  private resumenFilas(rows: FilaReporte[]) {
    const alumnos = new Set(rows.map((r) => r.alumno.id));
    const riesgos = new Set(
      rows.filter((r) => r.motivos.length).map((r) => r.alumno.id),
    );
    return {
      alumnos: alumnos.size,
      alumnosRiesgo: riesgos.size,
      calificacionesPendientes: rows.filter(
        (r) => r.unidad.status === 'FINALIZADA' && r.calificacionFinal == null,
      ).length,
      entregasPendientes: rows.reduce(
        (n, r) => n + (r.tareas.pendientesRevision ?? 0),
        0,
      ),
      sinEntrega: rows.reduce((n, r) => n + (r.tareas.sinEntregar ?? 0), 0),
    };
  }

  async resumen(usuarioId: number, consulta: Consulta) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    const gruposPeriodo = await this.gruposDelPeriodo(
      consulta.carreraId,
      periodo,
    );
    const grupoIdsPeriodo = gruposPeriodo.map((grupo) => grupo.id);
    const [
      ofertas,
      ofertasActivas,
      grupos,
      gruposActivos,
      calendarios,
      reticula,
      cierres,
    ] = await Promise.all([
      this.ofertas(consulta.carreraId, grupoIdsPeriodo),
      this.ofertas(consulta.carreraId),
      this.prisma.grupo.findMany({
        where: {
          carreraId: consulta.carreraId,
          id: { in: grupoIdsPeriodo },
          activo: true,
        },
        select: {
          ...grupoCampos,
          _count: { select: { alumnos: { where: { activo: true } } } },
        },
        orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.grupo.findMany({
        where: { carreraId: consulta.carreraId, activo: true },
        select: {
          ...grupoCampos,
          createdAt: true,
          _count: { select: { alumnos: { where: { activo: true } } } },
        },
        orderBy: [{ periodo: 'desc' }, { semestre: 'asc' }, { nombre: 'asc' }],
      }),
      this.calendarios(periodo),
      this.prisma.materia.findMany({
        where: { carreraId: consulta.carreraId },
        select: {
          id: true,
          clave: true,
          nombre: true,
          semestre: true,
          numUnidades: true,
        },
        orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.cierreCurso.findMany({
        where: {
          periodo,
          materia: { carreraId: consulta.carreraId },
          grupo: { carreraId: consulta.carreraId },
        },
        select: {
          materiaId: true,
          grupoId: true,
          cerradoEn: true,
          concentrado: true,
        },
      }),
    ]);
    // Limit concurrent calculations; each report uses the existing criteria engine.
    const reportes: Array<Awaited<ReturnType<SupervisionService['reporte']>>> =
      [];
    for (let i = 0; i < ofertas.length; i += 4) {
      reportes.push(
        ...(await Promise.all(
          ofertas
            .slice(i, i + 4)
            .map((o) =>
              this.reporte(
                usuarioId,
                { ...consulta, periodo },
                o.materia.id,
                o.grupo.id,
              ),
            ),
        )),
      );
    }
    const riesgo = new Map<
      number,
      FilaReporte['alumno'] & { causas: CausaRiesgo[] }
    >();
    for (const reporte of reportes)
      for (const row of reporte.rows) {
        if (!row.motivos.length) continue;
        const alumno = riesgo.get(row.alumno.id) ?? {
          ...row.alumno,
          causas: [],
        };
        alumno.causas.push({
          materia: reporte.materia,
          grupo: reporte.grupo,
          unidad: row.unidad,
          motivos: row.motivos,
          calificacion: row.calificacionFinal,
          asistencia: row.asistencia,
        });
        riesgo.set(row.alumno.id, alumno);
      }
    const enriquecidas = ofertas.map((o, i) => ({
      ...o,
      resumen: this.resumenFilas(reportes[i].rows),
      cierre: resumenCierre(
        cierres.find(
          (c) => c.materiaId === o.materia.id && c.grupoId === o.grupo.id,
        ),
      ),
    }));
    const limite = calendarios.reduce(
      (a, c) => (c.fin > a ? c.fin : a),
      calendarios[0].fin,
    );
    const fin = formatearFechaClave(limite < new Date() ? limite : new Date());
    const inicio = formatearFechaClave(
      calendarios.reduce(
        (a, c) => (c.inicio < a ? c.inicio : a),
        calendarios[0].inicio,
      ),
    );
    const clases =
      inicio <= fin
        ? await this.clases(usuarioId, { ...consulta, periodo }, inicio, fin)
        : [];
    const docentes = [
      ...new Map(
        ofertas.flatMap((o) => o.docentes).map((d) => [d.id, d]),
      ).values(),
    ].map((d) => {
      const propias = enriquecidas.filter((o) =>
        o.docentes.some((p) => p.id === d.id),
      );
      const horarios = [
        ...new Map(
          propias
            .flatMap((o) => o.horarios)
            .filter((h) => h.docenteId === d.id)
            .map((h) => [h.id, h]),
        ).values(),
      ];
      const elegibles = clases.filter(
        (c) => c.docente.id === d.id && c.elegible,
      );
      const completas = elegibles.filter((c) =>
        ['LISTA_COMPLETA', 'REGISTRO_TARDIO'].includes(c.estado),
      );
      const capturas = clases
        .filter((c) => c.docente.id === d.id)
        .flatMap((c) => (c.capturadaEn ? [c.capturadaEn.getTime()] : []));
      return {
        ...d,
        pertenencia: 'Imparte en esta carrera',
        ofertas: propias.map((o) => o.id),
        horasSemanales:
          Math.round(horarios.reduce((n, h) => n + horasSemanal(h), 0) * 10) /
          10,
        listasPendientes: elegibles.filter((c) =>
          ['SIN_CAPTURA', 'CAPTURA_PARCIAL'].includes(c.estado),
        ).length,
        clasesEsperadas: elegibles.length,
        listasCompletas: completas.length,
        registrosTardios: elegibles.filter(
          (c) => c.estado === 'REGISTRO_TARDIO',
        ).length,
        ultimaCaptura: capturas.length
          ? new Date(Math.max(...capturas)).toISOString()
          : null,
        intervalo: { desde: inicio, hasta: fin },
        cobertura: elegibles.length
          ? Math.round((completas.length / elegibles.length) * 100)
          : null,
        calificacionesPendientes: propias.reduce(
          (n, o) => n + o.resumen.calificacionesPendientes,
          0,
        ),
        entregasPendientes: propias.reduce(
          (n, o) => n + o.resumen.entregasPendientes,
          0,
        ),
        responsabilidadCompartida: propias.some((o) => o.docentes.length > 1),
      };
    });
    const docentesActivos = [
      ...new Map(
        ofertasActivas.flatMap((o) => o.docentes).map((d) => [d.id, d]),
      ).values(),
    ].map((d) => ({
      ...d,
      ofertas: ofertasActivas
        .filter((o) => o.docentes.some((docente) => docente.id === d.id))
        .map((o) => o.id),
    }));
    const periodoConsultaPorGrupo = new Map(
      gruposActivos.map((grupo) => [
        grupo.id,
        periodoCanonicoDeGrupo(grupo.periodo, grupo.createdAt),
      ]),
    );
    const catalogoOfertas = ofertasActivas.map((o) => ({
      id: o.id,
      materia: o.materia,
      grupo: {
        ...o.grupo,
        periodoConsulta: periodoConsultaPorGrupo.get(o.grupo.id) ?? null,
      },
      docentes: o.docentes,
      tieneHorario: o.horarios.length > 0,
    }));
    return {
      periodo,
      generadoEn: new Date().toISOString(),
      calendarios,
      ofertas: enriquecidas,
      docentes,
      intervalo: { desde: inicio, hasta: fin },
      reticula: reticula.map((m) => ({
        ...m,
        ofertas: enriquecidas
          .filter((o) => o.materia.id === m.id)
          .map((o) => o.id),
      })),
      grupos: grupos.map((g) => ({
        ...g,
        alumnosBase: g._count.alumnos,
        ofertas: enriquecidas
          .filter((o) => o.grupo.id === g.id)
          .map((o) => o.id),
        alumnosRiesgo: [...riesgo.values()].filter((a) =>
          a.causas.some((c) => c.grupo.id === g.id),
        ).length,
      })),
      riesgos: [...riesgo.values()],
      indicadores: {
        listasPendientes: clases.filter(
          (c) =>
            c.elegible && ['SIN_CAPTURA', 'CAPTURA_PARCIAL'].includes(c.estado),
        ).length,
        calificacionesPendientes: enriquecidas.reduce(
          (n, o) => n + o.resumen.calificacionesPendientes,
          0,
        ),
        entregasPendientes: enriquecidas.reduce(
          (n, o) => n + o.resumen.entregasPendientes,
          0,
        ),
        alumnosRiesgo: riesgo.size,
      },
      pendientes: clases.filter(
        (c) =>
          c.elegible && ['SIN_CAPTURA', 'CAPTURA_PARCIAL'].includes(c.estado),
      ),
      catalogo: {
        ofertas: catalogoOfertas,
        docentes: docentesActivos,
        grupos: gruposActivos.map(({ createdAt, ...g }) => ({
          ...g,
          periodoConsulta: periodoCanonicoDeGrupo(g.periodo, createdAt),
          alumnosBase: g._count.alumnos,
          ofertas: catalogoOfertas
            .filter((o) => o.grupo.id === g.id)
            .map((o) => o.id),
        })),
      },
    };
  }

  async clases(
    usuarioId: number,
    consulta: Consulta,
    desde: string,
    hasta: string,
    filtros: { docenteId?: number; grupoId?: number } = {},
  ) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    const grupoIdsPeriodo = (
      await this.gruposDelPeriodo(consulta.carreraId, periodo)
    ).map((grupo) => grupo.id);
    const inicio = fechaSupervision(desde),
      fin = fechaSupervision(hasta);
    if (fin < inicio || (fin.getTime() - inicio.getTime()) / 86400000 > 366)
      throw new BadRequestException(
        'El intervalo debe abarcar como máximo un año',
      );
    const finDia = new Date(fin);
    finDia.setHours(23, 59, 59, 999);
    const [
      horarios,
      sesiones,
      inscripciones,
      calendarios,
      institucionales,
      suspensiones,
      justificadas,
    ] = await Promise.all([
      this.prisma.horarioMateria.findMany({
        where: {
          activo: true,
          ...(filtros.docenteId ? { docenteId: filtros.docenteId } : {}),
          ...(filtros.grupoId ? { grupoId: filtros.grupoId } : {}),
          materia: { carreraId: consulta.carreraId },
          grupo: {
            id: { in: grupoIdsPeriodo },
            carreraId: consulta.carreraId,
            activo: true,
          },
        },
        include: horarioInclude,
      }),
      this.prisma.claseSesion.findMany({
        where: {
          materia: { carreraId: consulta.carreraId },
          grupo: {
            id: { in: grupoIdsPeriodo },
            carreraId: consulta.carreraId,
          },
          fecha: { gte: inicio, lte: finDia },
        },
        include: {
          asistencias: { select: { alumnoId: true } },
          unidadRef: { select: { id: true, nombre: true, orden: true } },
        },
      }),
      this.prisma.inscripcion.findMany({
        where: {
          periodo,
          estado: 'ACEPTADA',
          materia: { carreraId: consulta.carreraId },
          alumno: { carreraId: consulta.carreraId, activo: true },
        },
        select: {
          alumnoId: true,
          materiaId: true,
          grupoId: true,
          createdAt: true,
          aceptadaAt: true,
          alumno: { select: { grupoId: true } },
        },
      }),
      this.calendarios(periodo),
      this.prisma.suspensionInstitucional.findMany({
        where: { periodoClave: periodo, fecha: { gte: desde, lte: hasta } },
      }),
      this.prisma.suspensionClase.findMany({
        where: {
          periodoClave: periodo,
          fecha: { gte: desde, lte: hasta },
          docente: {
            horariosDocente: {
              some: {
                activo: true,
                grupo: {
                  id: { in: grupoIdsPeriodo },
                  carreraId: consulta.carreraId,
                },
              },
            },
          },
        },
      }),
      this.prisma.claseJustificada.findMany({
        where: {
          fecha: { gte: desde, lte: hasta },
          horario: {
            activo: true,
            grupo: {
              id: { in: grupoIdsPeriodo },
              carreraId: consulta.carreraId,
            },
          },
        },
        select: { horarioId: true, fecha: true, motivo: true },
      }),
    ]);
    const justificadaPorClase = new Map(
      justificadas.map((j) => [`${j.horarioId}:${j.fecha}`, j]),
    );
    const ahora = new Date();
    const resultado: ClaseSupervision[] = [];
    const sesionPorClase = new Map(
      sesiones.map((s) => [
        `${s.horarioMateriaId}:${formatearFechaClave(s.fecha)}`,
        s,
      ]),
    );
    for (let fecha = inicio; fecha <= fin; fecha = sumarDias(fecha, 1)) {
      const clave = formatearFechaClave(fecha);
      for (const horario of horarios) {
        const calendario = calendarios.find(
          (c) => c.modalidad === horario.grupo!.modalidad,
        )!;
        if (
          fecha < obtenerInicioDelDia(calendario.inicio) ||
          fecha > calendario.fin ||
          !horarioAplicaEnFecha(horario.dias, fecha)
        )
          continue;
        const suspension =
          institucionales.find((s) => s.fecha === clave) ??
          suspensiones.find(
            (s) => s.fecha === clave && s.docenteId === horario.docenteId,
          ) ??
          // La clase que el docente justificó por una reunión de academia.
          justificadaPorClase.get(`${horario.id}:${clave}`);
        const sesion = sesionPorClase.get(`${horario.id}:${clave}`);
        const inscritos = inscripciones.filter(
          (i) =>
            i.materiaId === horario.materiaId &&
            (i.grupoId ?? i.alumno.grupoId) === horario.grupoId &&
            (i.aceptadaAt ?? i.createdAt) <=
              combinarFechaYHora(fecha, horario.horaFin),
        );
        const registradas = new Set(
          sesion?.asistencias
            .filter((a) => inscritos.some((i) => i.alumnoId === a.alumnoId))
            .map((a) => a.alumnoId) ?? [],
        ).size;
        const futura = combinarFechaYHora(fecha, horario.horaInicio) > ahora;
        const concluida = combinarFechaYHora(fecha, horario.horaFin) < ahora;
        const elegible =
          calendario.configurado &&
          !suspension &&
          concluida &&
          fecha >= obtenerInicioDelDia(horario.createdAt) &&
          inscritos.length > 0;
        const estado = estadoCaptura({
          suspendida: !!suspension,
          futura,
          alumnos: inscritos.length,
          registros: registradas,
          activa: sesion?.activa ?? !concluida,
          tardia: !!sesion?.registroAtrasado,
        });
        resultado.push({
          id: `${horario.id}:${clave}`,
          horarioId: horario.id,
          fecha: clave,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
          grupo: horario.grupo!,
          docente: horario.docente,
          materia: horario.materia,
          aula: horario.aula,
          estado,
          elegible,
          calendarioConfigurado: calendario.configurado,
          alumnos: inscritos.length,
          registros: registradas,
          sesionId: sesion?.id ?? null,
          capturadaEn: sesion?.createdAt ?? null,
          unidad: sesion?.unidadRef ?? null,
          suspensionMotivo: suspension?.motivo ?? null,
          conflictos: [],
        });
      }
    }
    // Conflicts are evidence, independent of capture status.
    for (let i = 0; i < resultado.length; i++)
      for (
        let j = i + 1;
        j < resultado.length && resultado[j].fecha === resultado[i].fecha;
        j++
      ) {
        const a = resultado[i],
          b = resultado[j];
        if (
          a.estado === 'SUSPENDIDA' ||
          b.estado === 'SUSPENDIDA' ||
          !coincidenHorarios({ ...a, dias: 'dia' }, { ...b, dias: 'dia' })
        )
          continue;
        const tipos = [
          a.docente.id === b.docente.id ? 'Docente' : null,
          a.grupo.id === b.grupo.id ? 'Grupo' : null,
          a.aula?.id && a.aula.id === b.aula?.id ? 'Aula' : null,
        ].filter((tipo): tipo is string => tipo !== null);
        a.conflictos.push(...tipos);
        b.conflictos.push(...tipos);
      }
    return resultado.sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.horaInicio.localeCompare(b.horaInicio),
    );
  }

  /** Lista capturada de una sesión, solo si la materia pertenece a la carrera seleccionada. */
  async asistenciaSesion(
    usuarioId: number,
    consulta: Consulta,
    sesionId: number,
  ) {
    await this.alcance(usuarioId, consulta.carreraId);
    const sesion = await this.prisma.claseSesion.findFirst({
      where: { id: sesionId, materia: { carreraId: consulta.carreraId } },
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
    if (!sesion)
      throw new NotFoundException('Sesión no encontrada en esta carrera');
    const cuenta = (estado: EstadoAsistencia) =>
      sesion.asistencias.filter((a) => a.estado === estado).length;
    return {
      sesion: {
        id: sesion.id,
        fecha: formatearFechaClave(sesion.fecha),
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
      resumen: {
        asistencias: cuenta(EstadoAsistencia.ASISTENCIA),
        faltas: cuenta(EstadoAsistencia.FALTA),
        retardos: cuenta(EstadoAsistencia.RETARDO),
        justificadas: cuenta(EstadoAsistencia.JUSTIFICADA),
        total: sesion.asistencias.length,
      },
      asistencias: sesion.asistencias.map((registro) => ({
        id: registro.id,
        alumnoId: registro.alumnoId,
        nombre: registro.alumno.nombre,
        numeroControl: registro.alumno.numeroControl,
        sexo: registro.alumno.sexo,
        estado: registro.estado,
        observacion: registro.observacion,
      })),
    };
  }

  /** Alumnos del grupo base y los incorporados a sus ofertas, con todas sus inscripciones aceptadas del periodo. */
  async expedienteGrupo(
    usuarioId: number,
    consulta: Consulta,
    grupoId: number,
  ) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    const grupoEncontrado = await this.prisma.grupo.findFirst({
      where: {
        id: grupoId,
        carreraId: consulta.carreraId,
        activo: true,
      },
      select: { ...grupoCampos, createdAt: true },
    });
    if (!grupoEncontrado || !grupoPerteneceAPeriodo(grupoEncontrado, periodo))
      throw new NotFoundException(
        'Grupo fuera de la carrera o periodo seleccionado',
      );
    const { createdAt: _createdAt, ...grupo } = grupoEncontrado;
    const alumnoBase = {
      rol: 'ALUMNO' as const,
      activo: true,
      carreraId: consulta.carreraId,
    };
    const alumnos = await this.prisma.usuario.findMany({
      where: {
        ...alumnoBase,
        OR: [
          { grupoId },
          {
            inscripcionesAlumno: {
              some: { periodo, estado: 'ACEPTADA', grupoId },
            },
          },
        ],
      },
      select: {
        ...persona,
        sexo: true,
        grupo: { select: { id: true, nombre: true } },
        inscripcionesAlumno: {
          where: {
            periodo,
            estado: 'ACEPTADA',
            materia: { carreraId: consulta.carreraId },
          },
          select: {
            id: true,
            grupoId: true,
            materia: {
              select: { id: true, nombre: true, clave: true, semestre: true },
            },
            grupo: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return {
      periodo,
      grupo,
      alumnos: alumnos.map(({ inscripcionesAlumno: inscripciones, ...a }) => ({
        ...a,
        origen: a.grupoId === grupoId ? 'BASE' : 'INCORPORADO',
        inscripciones: inscripciones.map((i) => ({
          id: i.id,
          materia: i.materia,
          grupo: i.grupo ?? a.grupo ?? null,
        })),
      })),
    };
  }

  async buscarAlumnos(
    usuarioId: number,
    consulta: Consulta,
    q: string,
    materiaId?: number,
  ) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    if (q.trim().length < 2) return [];
    const alumnos = await this.prisma.usuario.findMany({
      where: {
        carreraId: consulta.carreraId,
        rol: 'ALUMNO',
        activo: true,
        OR: [
          { nombre: { contains: q.trim(), mode: 'insensitive' } },
          { numeroControl: { contains: q.trim(), mode: 'insensitive' } },
        ],
      },
      select: {
        ...persona,
        grupo: { select: { id: true, nombre: true } },
        inscripcionesAlumno: {
          where: { periodo, ...(materiaId ? { materiaId } : { id: -1 }) },
          select: { estado: true, grupoId: true },
        },
      },
      take: 30,
      orderBy: { nombre: 'asc' },
    });
    return alumnos.map(({ inscripcionesAlumno: inscripciones, ...a }) => ({
      ...a,
      inscripcionMateria: inscripciones[0] ?? null,
    }));
  }

  async incorporar(
    usuarioId: number,
    consulta: Consulta,
    dto: IncorporarAlumnoDto,
  ) {
    await this.alcance(usuarioId, consulta.carreraId);
    const periodo = periodoSupervision(consulta.periodo);
    if (periodo !== getCurrentAcademicPeriod())
      throw new BadRequestException(
        'Solo puedes incorporar alumnos al periodo actual',
      );
    if (dto.motivo.trim().length < 5)
      throw new BadRequestException('Escribe el motivo de incorporación');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const asignacion = await tx.jefeCarreraAsignacion.findFirst({
            where: { usuarioId, carreraId: consulta.carreraId, activa: true },
            select: { id: true },
          });
          if (!asignacion)
            throw new ForbiddenException('Carrera fuera de tu alcance');
          const [alumno, grupoEncontrado, materia] = await Promise.all([
            tx.usuario.findFirst({
              where: {
                id: dto.alumnoId,
                carreraId: consulta.carreraId,
                rol: 'ALUMNO',
                activo: true,
              },
              select: persona,
            }),
            tx.grupo.findFirst({
              where: {
                id: dto.grupoId,
                carreraId: consulta.carreraId,
                activo: true,
              },
              select: { ...grupoCampos, createdAt: true },
            }),
            tx.materia.findFirst({
              where: {
                id: dto.materiaId,
                carreraId: consulta.carreraId,
                grupos: {
                  some: {
                    id: dto.grupoId,
                    carreraId: consulta.carreraId,
                    activo: true,
                  },
                },
              },
              select: { id: true },
            }),
          ]);
          if (
            !alumno ||
            !grupoEncontrado ||
            !grupoPerteneceAPeriodo(grupoEncontrado, periodo) ||
            !materia
          )
            throw new NotFoundException(
              'Alumno u oferta fuera de tu carrera y periodo',
            );
          const { createdAt: _createdAt, ...grupo } = grupoEncontrado;
          const calendario = await tx.periodoAcademico.findUnique({
            where: {
              clave_modalidad: { clave: periodo, modalidad: grupo.modalidad },
            },
          });
          const ahora = new Date();
          if (
            !calendario ||
            ahora < calendario.fechaInicio ||
            ahora > calendario.fechaFin
          )
            throw new BadRequestException(
              'El calendario de esta modalidad debe estar configurado y abierto',
            );
          const existente = await tx.inscripcion.findUnique({
            where: {
              alumnoId_materiaId_periodo: {
                alumnoId: dto.alumnoId,
                materiaId: dto.materiaId,
                periodo,
              },
            },
          });
          if (existente?.estado === 'ACEPTADA')
            throw new ConflictException(
              'El alumno ya está inscrito en esta materia',
            );
          if (existente && !dto.resolverSolicitud)
            throw new ConflictException(
              'Existe una solicitud pendiente o rechazada; confirma su resolución',
            );
          const actuales = await tx.inscripcion.findMany({
            where: { alumnoId: dto.alumnoId, periodo, estado: 'ACEPTADA' },
            select: { materiaId: true, grupoId: true },
          });
          const destino = await tx.horarioMateria.findMany({
            where: {
              materiaId: dto.materiaId,
              grupoId: dto.grupoId,
              activo: true,
            },
          });
          if (!destino.length)
            throw new BadRequestException(
              'La oferta debe tener horario antes de incorporar alumnos',
            );
          const horariosActuales = await tx.horarioMateria.findMany({
            where: {
              activo: true,
              OR: actuales.map((i) => ({
                materiaId: i.materiaId,
                grupoId: i.grupoId ?? alumno.grupoId,
              })),
            },
          });
          if (
            destino.some((d) =>
              horariosActuales.some((h) => coincidenHorarios(d, h)),
            )
          )
            throw new ConflictException(
              'La materia tiene un choque con el horario del alumno',
            );
          const datos = {
            estado: 'ACEPTADA' as const,
            grupoId: dto.grupoId,
            aceptadaAt: ahora,
          };
          const inscripcion = existente
            ? await tx.inscripcion.update({
                where: { id: existente.id },
                data: datos,
              })
            : await tx.inscripcion.create({
                data: {
                  alumnoId: dto.alumnoId,
                  materiaId: dto.materiaId,
                  periodo,
                  ...datos,
                },
              });
          await tx.incorporacionJefatura.create({
            data: {
              inscripcionId: inscripcion.id,
              actorId: usuarioId,
              motivo: dto.motivo.trim(),
              estadoAnterior: existente?.estado ?? null,
            },
          });
          return {
            inscripcion,
            alumno,
            grupo,
            mensaje: 'Alumno incorporado. Su grupo de origen se conserva.',
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'La inscripción cambió durante la operación. Recarga y revisa antes de continuar.',
        );
      throw error;
    }
  }
}
