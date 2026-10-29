import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAsistencia, EstadoUnidad } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CalificacionesService } from '../calificaciones/calificaciones.service';
import { CALIFICACION_APROBATORIA } from '../common/desempeno.util';
import { getCurrentAcademicPeriod } from '../common/periodo.util';
import { PrismaService } from '../prisma.service';
import type { ReporteParcialQueryDto } from './dto/reporte-parcial.dto';
import {
  filtroGrupoVigente,
  grupoPerteneceAPeriodo,
  periodoSupervision,
  rangoPeriodo,
} from './supervision.utils';

type Actor = { id: number; nombre: string; rol: 'DOCENTE' | 'JEFE_CARRERA' };
type Conteo = {
  hombres: number;
  mujeres: number;
  sinDato: number;
  total: number;
};
type Reporte = Awaited<ReturnType<ReporteParcialService['reporte']>>;
type AlumnoReporte = {
  id: number;
  nombre: string;
  numeroControl?: string | null;
  sexo?: string | null;
};
type CalificacionReporte = {
  alumno: AlumnoReporte;
  unidad: { id: number | null } | null;
  calificacionFinal: number | null;
};
type UnidadOferta = {
  id: number;
  nombre: string;
  orden: number;
  status: EstadoUnidad;
};
type MateriaOferta = {
  id: number;
  nombre: string;
  clave: string;
  semestre: number | null;
  docenteId: number | null;
  unidades: UnidadOferta[];
};
type GrupoOferta = {
  id: number;
  nombre: string;
  semestre: number;
  modalidad: 'ESCOLARIZADO' | 'MIXTO';
  periodo: string;
};
type FilaParcial = {
  materia: { id: number; nombre: string; clave: string };
  unidad: UnidadOferta | null;
  semestre: number;
  grupo: { id: number; nombre: string };
  total: Conteo;
  po: Conteo;
  so: Conteo;
  acreditados: Conteo;
  porcentajeAcreditados: Conteo;
  noAcreditados: Conteo;
  porcentajeNoAcreditados: Conteo;
  desertores: Conteo;
  porcentajeDesertores: Conteo;
  pendientes: number;
};
type TotalesParcial = Omit<
  FilaParcial,
  'materia' | 'unidad' | 'semestre' | 'grupo'
>;
type FilaValores = Pick<
  FilaParcial,
  | 'total'
  | 'po'
  | 'so'
  | 'porcentajeAcreditados'
  | 'noAcreditados'
  | 'porcentajeNoAcreditados'
  | 'desertores'
  | 'porcentajeDesertores'
> & {
  materia: { nombre: string };
  unidad: { orden: number } | null;
  semestre: number | string;
  grupo: { nombre: string };
};

function rutaActivo(nombre: string) {
  const candidatos = [
    join(process.cwd(), 'src/reportes/assets', nombre),
    join(process.cwd(), 'dist/reportes/assets', nombre),
    join(__dirname, '../../reportes/assets', nombre),
  ];
  return candidatos.find((ruta) => existsSync(ruta)) ?? candidatos[0];
}

const TECNM_SIMBOLO = rutaActivo('tecnm-simbolo.png');
const TECNM = rutaActivo('tecnm.png');
const ESCUDO = rutaActivo('escudo-cosamaloapan.png');
// El escudo tal como viene incrustado en el formato del SGI.
const ESCUDO_SGI = rutaActivo('escudo-sgi.png');

const periodoTexto = (periodo: string) =>
  `${periodo.endsWith('A') ? 'ENERO - JUNIO' : 'AGOSTO - DICIEMBRE'} ${periodo.slice(0, 4)}`;
const fechaClave = (fecha: Date) => fecha.toISOString().slice(0, 10);
const fechaLarga = (fecha: Date | string) =>
  new Date(fecha).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
/** "31 de agosto", como en el formato del SGI. */
const fechaDiaMes = (fecha: string) =>
  new Date(fecha).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
const ROMANOS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];
const romano = (semestre: number | null) =>
  semestre ? (ROMANOS[semestre - 1] ?? String(semestre)) : '';

function contar(personas: Array<{ sexo?: string | null }>): Conteo {
  const hombres = personas.filter((p) => p.sexo === 'HOMBRE').length;
  const mujeres = personas.filter((p) => p.sexo === 'MUJER').length;
  return {
    hombres,
    mujeres,
    sinDato: personas.length - hombres - mujeres,
    total: personas.length,
  };
}

function sumarConteos(conteos: Conteo[]): Conteo {
  return conteos.reduce(
    (total, item) => ({
      hombres: total.hombres + item.hombres,
      mujeres: total.mujeres + item.mujeres,
      sinDato: total.sinDato + item.sinDato,
      total: total.total + item.total,
    }),
    { hombres: 0, mujeres: 0, sinDato: 0, total: 0 },
  );
}

function porcentaje(numerador: Conteo, denominador: Conteo): Conteo {
  const valor = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  return {
    hombres: valor(numerador.hombres, denominador.hombres),
    mujeres: valor(numerador.mujeres, denominador.mujeres),
    sinDato: valor(numerador.sinDato, denominador.sinDato),
    total: valor(numerador.total, denominador.total),
  };
}

@Injectable()
export class ReporteParcialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calificaciones: CalificacionesService,
  ) {}

  async contexto(actor: Actor, periodoElegido?: string) {
    const periodo = periodoSupervision(periodoElegido);
    if (actor.rol === 'DOCENTE' && periodo !== getCurrentAcademicPeriod()) {
      throw new BadRequestException(
        'El docente solo puede generar el reporte parcial del periodo actual',
      );
    }
    const carreras =
      actor.rol === 'JEFE_CARRERA'
        ? await this.prisma.carrera.findMany({
            where: { jefes: { some: { usuarioId: actor.id, activa: true } } },
            select: { id: true, nombre: true, codigo: true },
            orderBy: { nombre: 'asc' },
          })
        : await this.carrerasDelDocente(actor.id, periodo);
    const docentes =
      actor.rol === 'JEFE_CARRERA'
        ? await this.docentesDeCarreras(
            carreras.map((c) => c.id),
            periodo,
          )
        : [
            {
              id: actor.id,
              nombre: actor.nombre,
              carreraIds: carreras.map((c) => c.id),
            },
          ];
    return {
      rol: actor.rol,
      periodo,
      periodoTexto: periodoTexto(periodo),
      carreras,
      docentes,
      seleccion: {
        carreraId: carreras[0]?.id ?? null,
        docenteId: actor.rol === 'DOCENTE' ? actor.id : null,
      },
    };
  }

  async reporte(actor: Actor, consulta: ReporteParcialQueryDto) {
    const contexto = await this.contexto(actor, consulta.periodo);
    const periodo = contexto.periodo;
    const carreraId = consulta.carreraId ?? contexto.seleccion.carreraId;
    const docenteId =
      actor.rol === 'DOCENTE'
        ? actor.id
        : (consulta.docenteId ?? contexto.seleccion.docenteId);
    if (!carreraId) throw new BadRequestException('Selecciona una carrera');
    if (!docenteId) throw new BadRequestException('Selecciona un docente');
    const carrera = contexto.carreras.find((item) => item.id === carreraId);
    if (!carrera) throw new ForbiddenException('Carrera fuera de tu alcance');
    if (
      actor.rol === 'JEFE_CARRERA' &&
      !contexto.docentes.some(
        (item) => item.id === docenteId && item.carreraIds.includes(carreraId),
      )
    ) {
      throw new ForbiddenException('Docente fuera de tu carrera');
    }
    const [docente, jefatura] = await Promise.all([
      this.prisma.usuario.findFirst({
        where: { id: docenteId, rol: 'DOCENTE', activo: true },
        select: { id: true, nombre: true },
      }),
      this.prisma.jefeCarreraAsignacion.findFirst({
        where: {
          carreraId,
          activa: true,
          usuario: { activo: true, rol: 'JEFE_CARRERA' },
        },
        orderBy: { updatedAt: 'desc' },
        select: { usuario: { select: { id: true, nombre: true } } },
      }),
    ]);
    if (!docente) throw new NotFoundException('No se encontró al docente');

    const grupos = (
      await this.prisma.grupo.findMany({
        where: { carreraId, ...filtroGrupoVigente(periodo) },
        select: {
          id: true,
          nombre: true,
          semestre: true,
          modalidad: true,
          periodo: true,
          createdAt: true,
        },
      })
    ).filter((grupo) => grupoPerteneceAPeriodo(grupo, periodo));
    const grupoIds = grupos.map((grupo) => grupo.id);
    const materias = grupoIds.length
      ? await this.prisma.materia.findMany({
          where: {
            carreraId,
            OR: [
              { docenteId },
              {
                horarios: {
                  some: { docenteId, activo: true, grupoId: { in: grupoIds } },
                },
              },
            ],
          },
          include: {
            unidades: { orderBy: { orden: 'asc' } },
            grupos: { where: { id: { in: grupoIds } } },
            horarios: {
              where: { activo: true, grupoId: { in: grupoIds } },
              select: { docenteId: true, grupoId: true },
            },
          },
          orderBy: [{ semestre: 'asc' }, { nombre: 'asc' }],
        })
      : [];
    const ofertas = materias.flatMap((materia) =>
      materia.grupos
        .filter(
          (grupo) =>
            materia.docenteId === docenteId ||
            materia.horarios.some(
              (horario) =>
                horario.grupoId === grupo.id && horario.docenteId === docenteId,
            ),
        )
        .map((grupo) => ({ materia, grupo })),
    );
    if (!ofertas.length) {
      throw new NotFoundException(
        'El docente no tiene materias asignadas en esta carrera y periodo',
      );
    }

    const calendarios = await this.calendarios(periodo);
    const filas = await Promise.all(
      ofertas.map(({ materia, grupo }) => {
        const calendario = calendarios.find(
          (item) => item.modalidad === grupo.modalidad,
        )!;
        return this.fila(actor, docenteId, carreraId, periodo, {
          materia,
          grupo,
          inicio: calendario.inicio,
          fin: calendario.fin,
        });
      }),
    );
    const inicio = new Date(
      Math.min(...calendarios.map((item) => item.inicio.getTime())),
    );
    const finPeriodo = new Date(
      Math.max(...calendarios.map((item) => item.fin.getTime())),
    );
    const corte = new Date(Math.min(Date.now(), finPeriodo.getTime()));
    const totales = this.totalizar(filas);
    return {
      institucion: 'Instituto Tecnológico Superior de Cosamaloapan',
      area: 'Subdirección Académica',
      formato: 'Reporte parcial del semestre',
      version: 2,
      carrera,
      docente,
      jefeDivision: jefatura?.usuario ?? null,
      periodo,
      periodoTexto: periodoTexto(periodo),
      intervalo: { desde: fechaClave(inicio), hasta: fechaClave(corte) },
      generadoEn: new Date(),
      gruposAtendidos: new Set(filas.map((fila) => fila.grupo.id)).size,
      asignaturasDiferentes: new Set(filas.map((fila) => fila.materia.id)).size,
      filas,
      totales,
      notas: [
        'A = alumnos inscritos; B = acreditados en primera (PO) o segunda oportunidad (SO); C = porcentaje acreditado.',
        'D y E = alumnos no acreditados al corte y su porcentaje; F y G = alumnos que no se presentaron en ninguna lista capturada y su porcentaje.',
        'Una lista sin captura no se usa para clasificar deserción. Las filas con calificación pendiente permanecen dentro de no acreditados al corte.',
      ],
    };
  }

  async exportar(
    actor: Actor,
    consulta: ReporteParcialQueryDto,
    formato: 'excel' | 'pdf' = 'excel',
  ) {
    const reporte = await this.reporte(actor, consulta);
    const base = `reporte-parcial-${reporte.docente.nombre}-${reporte.periodo}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    return formato === 'pdf'
      ? {
          buffer: await this.pdf(reporte),
          contentType: 'application/pdf',
          filename: `${base}.pdf`,
        }
      : {
          buffer: await this.excel(reporte),
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: `${base}.xlsx`,
        };
  }

  private async carrerasDelDocente(docenteId: number, periodo: string) {
    const candidatas = await this.prisma.carrera.findMany({
      where: {
        OR: [
          { materias: { some: { docenteId } } },
          {
            grupos: {
              some: { horarios: { some: { docenteId, activo: true } } },
            },
          },
        ],
      },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        grupos: {
          where: filtroGrupoVigente(periodo),
          select: { periodo: true, createdAt: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return candidatas
      .filter((carrera) =>
        carrera.grupos.some((grupo) => grupoPerteneceAPeriodo(grupo, periodo)),
      )
      .map((carrera) => ({
        id: carrera.id,
        nombre: carrera.nombre,
        codigo: carrera.codigo,
      }));
  }

  private async docentesDeCarreras(carreraIds: number[], periodo: string) {
    if (!carreraIds.length) return [];
    const grupos = await this.prisma.grupo.findMany({
      where: { carreraId: { in: carreraIds }, ...filtroGrupoVigente(periodo) },
      select: { id: true, carreraId: true, periodo: true, createdAt: true },
    });
    const vigentes = grupos.filter((grupo) =>
      grupoPerteneceAPeriodo(grupo, periodo),
    );
    const grupoIds = vigentes.map((grupo) => grupo.id);
    const carreraDeGrupo = new Map(
      vigentes.map((grupo) => [grupo.id, grupo.carreraId]),
    );
    const [horarios, materias] = await Promise.all([
      this.prisma.horarioMateria.findMany({
        where: { activo: true, grupoId: { in: grupoIds } },
        select: {
          docente: { select: { id: true, nombre: true } },
          grupoId: true,
        },
      }),
      this.prisma.materia.findMany({
        where: {
          carreraId: { in: carreraIds },
          docenteId: { not: null },
          grupos: { some: { id: { in: grupoIds } } },
        },
        select: {
          docente: { select: { id: true, nombre: true } },
          carreraId: true,
        },
      }),
    ]);
    const mapa = new Map<
      number,
      { id: number; nombre: string; carreraIds: Set<number> }
    >();
    for (const item of horarios) {
      const carreraId = item.grupoId ? carreraDeGrupo.get(item.grupoId) : null;
      if (!item.docente || !carreraId) continue;
      const actual = mapa.get(item.docente.id) ?? {
        ...item.docente,
        carreraIds: new Set<number>(),
      };
      actual.carreraIds.add(carreraId);
      mapa.set(item.docente.id, actual);
    }
    for (const item of materias) {
      if (!item.docente) continue;
      const actual = mapa.get(item.docente.id) ?? {
        ...item.docente,
        carreraIds: new Set<number>(),
      };
      actual.carreraIds.add(item.carreraId!);
      mapa.set(item.docente.id, actual);
    }
    return [...mapa.values()]
      .map((item) => ({ ...item, carreraIds: [...item.carreraIds] }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  private async calendarios(periodo: string) {
    const guardados = await this.prisma.periodoAcademico.findMany({
      where: { clave: periodo },
    });
    const predeterminado = rangoPeriodo(periodo);
    return (['ESCOLARIZADO', 'MIXTO'] as const).map((modalidad) => {
      const real = guardados.find((item) => item.modalidad === modalidad);
      return {
        modalidad,
        inicio: real?.fechaInicio ?? predeterminado.inicio,
        fin: real?.fechaFin ?? predeterminado.fin,
      };
    });
  }

  private async fila(
    actor: Actor,
    docenteId: number,
    carreraId: number,
    periodo: string,
    oferta: {
      materia: MateriaOferta;
      grupo: GrupoOferta;
      inicio: Date;
      fin: Date;
    },
  ): Promise<FilaParcial> {
    const unidad =
      oferta.materia.unidades.find(
        (item: { status: EstadoUnidad }) => item.status === EstadoUnidad.ACTIVA,
      ) ??
      [...oferta.materia.unidades]
        .reverse()
        .find(
          (item: { status: EstadoUnidad }) =>
            item.status === EstadoUnidad.FINALIZADA,
        ) ??
      oferta.materia.unidades[0];
    const reporte =
      actor.rol === 'DOCENTE'
        ? await this.calificaciones.obtenerReporteDocente(actor, {
            materiaId: oferta.materia.id,
            grupoId: oferta.grupo.id,
            unidadId: unidad?.id,
          })
        : await this.calificaciones.obtenerReporteJefatura(
            actor.id,
            carreraId,
            periodo,
            oferta.materia.id,
            oferta.grupo.id,
            { inicio: oferta.inicio, fin: oferta.fin },
            [periodo, oferta.grupo.periodo],
          );
    const filas = (reporte.rows as unknown as CalificacionReporte[]).filter(
      (item) => !unidad || item.unidad?.id === unidad.id,
    );
    const alumnos = [
      ...new Map(filas.map((item) => [item.alumno.id, item.alumno])).values(),
    ];
    const alumnoIds = alumnos.map((alumno) => alumno.id);
    const segundas =
      alumnoIds.length && unidad
        ? await this.prisma.calificacionUnidad.findMany({
            where: {
              materiaId: oferta.materia.id,
              grupoId: oferta.grupo.id,
              unidadId: unidad.id,
              periodo,
              alumnoId: { in: alumnoIds },
            },
            select: {
              alumnoId: true,
              calificacionSegunda: true,
              segundaNoPresento: true,
            },
          })
        : [];
    const asistencias = alumnoIds.length
      ? await this.prisma.asistencia.findMany({
          where: {
            alumnoId: { in: alumnoIds },
            claseSesion: {
              materiaId: oferta.materia.id,
              grupoId: oferta.grupo.id,
              fecha: { gte: oferta.inicio, lte: oferta.fin },
            },
          },
          select: { alumnoId: true, estado: true },
        })
      : [];
    const filaDe = new Map(filas.map((item) => [item.alumno.id, item]));
    const segundaDe = new Map(
      segundas.map((item) => [item.alumnoId, item] as const),
    );
    const asistenciaDe = new Map<number, EstadoAsistencia[]>();
    for (const item of asistencias) {
      asistenciaDe.set(item.alumnoId, [
        ...(asistenciaDe.get(item.alumnoId) ?? []),
        item.estado,
      ]);
    }
    const primera = alumnos.filter(
      (alumno) =>
        typeof filaDe.get(alumno.id)?.calificacionFinal === 'number' &&
        (filaDe.get(alumno.id)?.calificacionFinal as number) >=
          CALIFICACION_APROBATORIA,
    );
    const segunda = alumnos.filter((alumno) => {
      const primeraNota = filaDe.get(alumno.id)?.calificacionFinal;
      const segundaNota = segundaDe.get(alumno.id)?.calificacionSegunda;
      return (
        typeof primeraNota === 'number' &&
        primeraNota < CALIFICACION_APROBATORIA &&
        typeof segundaNota === 'number' &&
        segundaNota >= CALIFICACION_APROBATORIA
      );
    });
    const acreditadoIds = new Set([...primera, ...segunda].map((a) => a.id));
    const noAcreditados = alumnos.filter(
      (alumno) => !acreditadoIds.has(alumno.id),
    );
    const desertores = alumnos.filter((alumno) => {
      const estados = asistenciaDe.get(alumno.id) ?? [];
      return (
        estados.length > 0 &&
        estados.every((estado) => estado === EstadoAsistencia.FALTA)
      );
    });
    const pendientes = alumnos.filter(
      (alumno) => typeof filaDe.get(alumno.id)?.calificacionFinal !== 'number',
    ).length;
    const total = contar(alumnos);
    const po = contar(primera);
    const so = contar(segunda);
    const acreditados = contar(alumnos.filter((a) => acreditadoIds.has(a.id)));
    const noAcreditadosConteo = contar(noAcreditados);
    const desertoresConteo = contar(desertores);
    return {
      materia: {
        id: oferta.materia.id,
        nombre: oferta.materia.nombre,
        clave: oferta.materia.clave,
      },
      unidad: unidad
        ? {
            id: unidad.id,
            nombre: unidad.nombre,
            orden: unidad.orden,
            status: unidad.status,
          }
        : null,
      semestre: oferta.materia.semestre ?? oferta.grupo.semestre,
      grupo: { id: oferta.grupo.id, nombre: oferta.grupo.nombre },
      total,
      po,
      so,
      acreditados,
      porcentajeAcreditados: porcentaje(acreditados, total),
      noAcreditados: noAcreditadosConteo,
      porcentajeNoAcreditados: porcentaje(noAcreditadosConteo, total),
      desertores: desertoresConteo,
      porcentajeDesertores: porcentaje(desertoresConteo, total),
      pendientes,
    };
  }

  private totalizar(filas: FilaParcial[]): TotalesParcial {
    const total = sumarConteos(filas.map((fila) => fila.total));
    const po = sumarConteos(filas.map((fila) => fila.po));
    const so = sumarConteos(filas.map((fila) => fila.so));
    const acreditados = sumarConteos(filas.map((fila) => fila.acreditados));
    const noAcreditados = sumarConteos(filas.map((fila) => fila.noAcreditados));
    const desertores = sumarConteos(filas.map((fila) => fila.desertores));
    return {
      total,
      po,
      so,
      acreditados,
      porcentajeAcreditados: porcentaje(acreditados, total),
      noAcreditados,
      porcentajeNoAcreditados: porcentaje(noAcreditados, total),
      desertores,
      porcentajeDesertores: porcentaje(desertores, total),
      pendientes: filas.reduce((suma, fila) => suma + fila.pendientes, 0),
    };
  }

  private valoresFila(fila: FilaValores): Array<string | number> {
    return [
      fila.materia.nombre,
      fila.unidad?.orden ?? '—',
      fila.semestre ?? '—',
      fila.grupo.nombre,
      fila.total.hombres,
      fila.total.mujeres,
      fila.po.hombres,
      fila.po.mujeres,
      fila.so.hombres,
      fila.so.mujeres,
      fila.porcentajeAcreditados.hombres / 100,
      fila.porcentajeAcreditados.mujeres / 100,
      fila.noAcreditados.hombres,
      fila.noAcreditados.mujeres,
      fila.porcentajeNoAcreditados.hombres / 100,
      fila.porcentajeNoAcreditados.mujeres / 100,
      fila.desertores.hombres,
      fila.desertores.mujeres,
      fila.porcentajeDesertores.hombres / 100,
      fila.porcentajeDesertores.mujeres / 100,
    ];
  }

  // Calca el formato institucional "Reporte 1.xlsx" (SGI G3, versión 2):
  // mismas celdas, combinaciones, anchos, fuentes y fórmulas. Solo crecen las
  // filas de asignaturas cuando hay más de las 8 que trae la plantilla.
  private async excel(reporte: Reporte) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SICAT';
    workbook.subject = 'Reporte parcial del semestre';
    const hoja = workbook.addWorksheet('Reporte parcial', {
      properties: { defaultRowHeight: 15 },
    });
    const negro = { argb: 'FF000000' };
    const linea = { style: 'thin' as const, color: negro };
    const fuente = (
      size: number,
      extra: Partial<ExcelJS.Font> = {},
    ): Partial<ExcelJS.Font> => ({
      name: 'Arial',
      family: 2,
      size,
      color: negro,
      ...extra,
    });
    const centro: Partial<ExcelJS.Alignment> = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    const escribir = (
      celda: string,
      valor: ExcelJS.CellValue,
      font: Partial<ExcelJS.Font>,
      alignment: Partial<ExcelJS.Alignment> = {},
    ) => {
      const destino = hoja.getCell(celda);
      destino.value = valor;
      destino.font = font;
      destino.alignment = alignment;
      return destino;
    };
    // Recuadro exterior de un rango (combinado o no): cada celda lleva su lado.
    const recuadro = (rango: string) => {
      const [desde, hasta = desde] = rango.split(':');
      const [inicio, fin] = [hoja.getCell(desde), hoja.getCell(hasta)];
      const [c1, r1, c2, r2] = [
        Number(inicio.col),
        Number(inicio.row),
        Number(fin.col),
        Number(fin.row),
      ];
      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) {
          const celda = hoja.getCell(r, c);
          celda.border = {
            ...celda.border,
            ...(c === c1 ? { left: linea } : {}),
            ...(c === c2 ? { right: linea } : {}),
            ...(r === r1 ? { top: linea } : {}),
            ...(r === r2 ? { bottom: linea } : {}),
          };
        }
      }
    };
    const subrayar = (rango: string) => {
      const [desde, hasta = desde] = rango.split(':');
      const [inicio, fin] = [hoja.getCell(desde), hoja.getCell(hasta)];
      for (let c = Number(inicio.col); c <= Number(fin.col); c += 1) {
        const celda = hoja.getCell(Number(inicio.row), c);
        celda.border = { ...celda.border, bottom: linea };
      }
    };
    const combinar = (rango: string) => {
      if (rango.includes(':')) hoja.mergeCells(rango);
    };

    hoja.columns = [
      41.78, 8.78, 8.78, 5, 4.11, 5.11, 5.11, 4.66, 4.66, 4.66, 4.66, 6.66,
      6.66, 5.66, 5.66, 6.33, 5.66, 5.78, 5.44, 6.78, 5.66,
    ].map((width) => ({ width }));

    // Encabezado del SGI: logotipos a los lados y tres renglones al centro.
    hoja.getRow(2).height = 27.75;
    hoja.getRow(3).height = 27;
    hoja.getRow(4).height = 27;
    const encabezado: Array<[string, string]> = [
      ['B2:O2', reporte.institucion],
      [
        'B3:O3',
        'Nombre del Formato: Reporte Parcial del Semestre del SGI del G3',
      ],
      ['B4:H4', 'Página 1 de 1'],
      ['I4:O4', `Versión ${reporte.version}`],
    ];
    ['A2:A4', 'P2:U4'].forEach((rango) => {
      combinar(rango);
      recuadro(rango);
    });
    encabezado.forEach(([rango, texto]) => {
      combinar(rango);
      escribir(rango.split(':')[0], texto, fuente(10, { bold: true }), centro);
      recuadro(rango);
    });
    // Mismas anclas (EMU) que las imágenes de la plantilla.
    const ancla = ([col, colOff, row, rowOff]: number[]) => ({
      nativeCol: col,
      nativeColOff: colOff,
      nativeRow: row,
      nativeRowOff: rowOff,
    });
    const logos: Array<[string, number[], number[]]> = [
      [TECNM, [0, 174625, 1, 127000], [0, 1452563, 3, 134937]],
      [ESCUDO_SGI, [16, 323850, 1, 28575], [19, 91167, 3, 323850]],
    ];
    // Posición y tamaño (EMU) de cada logotipo en la plantilla, en orden.
    const marcos = [
      [174625, 317500, 1277938, 703262],
      [7753350, 219075, 900792, 990600],
    ];
    logos.forEach(([archivo, desde, hasta]) => {
      hoja.addImage(
        workbook.addImage({ filename: archivo, extension: 'png' }),
        {
          tl: ancla(desde),
          br: ancla(hasta),
          editAs: 'oneCell',
        } as unknown as ExcelJS.ImageRange,
      );
    });

    for (let r = 6; r <= 16; r += 1) hoja.getRow(r).height = 14.4;
    combinar('A7:U7');
    escribir(
      'A7',
      reporte.institucion.toUpperCase(),
      fuente(10, { bold: true }),
      {
        horizontal: 'center',
      },
    );
    combinar('A8:U8');
    escribir('A8', reporte.area.toUpperCase(), fuente(10), {
      horizontal: 'center',
    });
    combinar('A10:U10');
    escribir(
      'A10',
      {
        richText: [
          { text: 'DIVISIÓN DE: ', font: fuente(10, { bold: true }) },
          { text: reporte.carrera.nombre.toUpperCase(), font: fuente(10) },
        ],
      },
      fuente(10, { bold: true }),
      { horizontal: 'center', wrapText: true },
    );

    const etiqueta = (celda: string, texto: string, horizontal?: 'center') =>
      escribir(celda, texto, fuente(9), horizontal ? { horizontal } : {});
    const dato = (
      rango: string,
      valor: ExcelJS.CellValue,
      extra: Partial<ExcelJS.Font> = {},
      size = 10,
    ) => {
      combinar(rango);
      escribir(rango.split(':')[0], valor, fuente(size, extra), {
        horizontal: 'center',
      });
      subrayar(rango);
    };
    etiqueta('A12', 'REPORTE:');
    dato('B12:F12', 'PARCIAL');
    etiqueta('J12', 'SEMESTRE:', 'center');
    dato('L12:R12', reporte.periodoTexto);
    etiqueta('A13', 'PERIODO: ');
    dato('B13:F13', fechaDiaMes(reporte.intervalo.desde));
    recuadro('B13:F13');
    combinar('H13:J13');
    etiqueta('H13', 'AL', 'center');
    dato('L13:R13', fechaDiaMes(reporte.intervalo.hasta));
    etiqueta('A14', 'PROFESOR (A): ');
    dato('C14:R14', reporte.docente.nombre.toUpperCase(), { bold: true });
    etiqueta('A15', 'NO. DE GRUPOS ATENDIDOS:');
    dato('B15:F15', String(reporte.gruposAtendidos));
    etiqueta('H15', 'NO. DE ASIGNATURAS DIFERENTES:');
    dato('N15', String(reporte.asignaturasDiferentes), {}, 9);

    // Encabezado de la tabla (filas 17 a 19).
    hoja.getRow(17).height = 14.55;
    hoja.getRow(18).height = 14.4;
    hoja.getRow(19).height = 14.4;
    const columnasTabla: Array<[string, string]> = [
      ['A17:A19', 'Asignatura'],
      ['B17:B19', 'Unidad'],
      ['C17:C19', 'Semestre'],
      ['D17:E19', 'Grupo'],
      ['F17:G18', 'A'],
      ['H17:K17', 'B'],
      ['H18:I18', 'PO'],
      ['J18:K18', 'SO'],
      ['L17:M18', 'C'],
      ['N17:O18', 'D'],
      ['P17:Q18', 'E'],
      ['R17:S18', 'F'],
      ['T17:U18', 'G'],
    ];
    columnasTabla.forEach(([rango, texto]) => {
      combinar(rango);
      escribir(rango.split(':')[0], texto, fuente(9), centro);
      recuadro(rango);
    });
    for (let c = 6; c <= 21; c += 1) {
      const celda = hoja.getCell(19, c);
      escribir(celda.address, c % 2 === 0 ? 'H' : 'M', fuente(9), centro);
      recuadro(celda.address);
    }

    // Filas de asignaturas: al menos las 8 de la plantilla, en blanco si sobran.
    const primera = 20;
    const renglones = Math.max(8, reporte.filas.length);
    const totalFila = primera + renglones;
    const porcentajeF = '0%';
    const contable = '_-* #,##0_-;-* #,##0_-;_-* "-"??_-;_-@_-';
    const division = (
      fila: number,
      numerador: string,
      denominador: string,
      resultado: number | undefined,
    ) =>
      ({
        formula: `IF(${denominador}${fila}=0,0,(${numerador})/${denominador}${fila})`,
        result: resultado,
      }) as ExcelJS.CellFormulaValue;
    const formatoColumna = (c: number) =>
      [12, 13, 16, 17, 20, 21].includes(c)
        ? porcentajeF
        : c === 14 || c === 15
          ? contable
          : c === 19
            ? '0'
            : undefined;
    for (let i = 0; i < renglones; i += 1) {
      const r = primera + i;
      const fila = reporte.filas[i];
      const nombre = fila?.materia.nombre.toUpperCase() ?? null;
      // row.values recrea las celdas: primero valores, luego formato.
      if (fila) {
        const pct = (valor: number) => valor / 100;
        hoja.getRow(r).values = [
          nombre,
          fila.unidad ? String(fila.unidad.orden) : '',
          romano(fila.semestre),
          fila.grupo.nombre,
          undefined,
          fila.total.hombres,
          fila.total.mujeres,
          fila.po.hombres,
          fila.po.mujeres,
          fila.so.hombres,
          fila.so.mujeres,
          division(
            r,
            `H${r}+J${r}`,
            'F',
            pct(fila.porcentajeAcreditados.hombres),
          ),
          division(
            r,
            `I${r}+K${r}`,
            'G',
            pct(fila.porcentajeAcreditados.mujeres),
          ),
          fila.noAcreditados.hombres,
          fila.noAcreditados.mujeres,
          division(r, `N${r}`, 'F', pct(fila.porcentajeNoAcreditados.hombres)),
          division(r, `O${r}`, 'G', pct(fila.porcentajeNoAcreditados.mujeres)),
          fila.desertores.hombres,
          fila.desertores.mujeres,
          division(r, `R${r}`, 'F', pct(fila.porcentajeDesertores.hombres)),
          division(r, `S${r}`, 'G', pct(fila.porcentajeDesertores.mujeres)),
        ];
      }
      hoja.getRow(r).height = nombre && nombre.length > 48 ? 24 : 14.4;
      hoja.mergeCells(`D${r}:E${r}`);
      for (let c = 1; c <= 21; c += 1) {
        const celda = hoja.getCell(r, c);
        celda.font = fuente(c === 1 && nombre && nombre.length > 34 ? 8 : 9);
        celda.alignment =
          c === 1
            ? { horizontal: 'left', vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle' };
        const formato = formatoColumna(c);
        if (formato) celda.numFmt = formato;
        if (c <= 4) celda.numFmt = '@';
      }
      [1, 2, 3, ...Array.from({ length: 16 }, (_, k) => k + 6)].forEach((c) =>
        recuadro(hoja.getCell(r, c).address),
      );
      recuadro(`D${r}:E${r}`);
    }

    // TOTAL: sumas y porcentajes con las fórmulas de la plantilla.
    const t = totalFila;
    const ultima = totalFila - 1;
    const totales = reporte.totales;
    const suma = (col: string, resultado: number) => ({
      formula: `SUM(${col}${primera}:${col}${ultima})`,
      result: resultado,
    });
    hoja.getRow(t).values = [
      'TOTAL',
      undefined,
      undefined,
      undefined,
      undefined,
      suma('F', totales.total.hombres),
      suma('G', totales.total.mujeres),
      suma('H', totales.po.hombres),
      suma('I', totales.po.mujeres),
      suma('J', totales.so.hombres),
      suma('K', totales.so.mujeres),
      division(
        t,
        `H${t}+J${t}`,
        'F',
        totales.porcentajeAcreditados.hombres / 100,
      ),
      division(
        t,
        `I${t}+K${t}`,
        'G',
        totales.porcentajeAcreditados.mujeres / 100,
      ),
      { formula: `F${t}-(H${t}+J${t})`, result: totales.noAcreditados.hombres },
      { formula: `G${t}-(I${t}+K${t})`, result: totales.noAcreditados.mujeres },
      division(t, `N${t}`, 'F', totales.porcentajeNoAcreditados.hombres / 100),
      division(t, `O${t}`, 'G', totales.porcentajeNoAcreditados.mujeres / 100),
      suma('R', totales.desertores.hombres),
      suma('S', totales.desertores.mujeres),
      division(t, `R${t}`, 'F', totales.porcentajeDesertores.hombres / 100),
      division(t, `S${t}`, 'G', totales.porcentajeDesertores.mujeres / 100),
    ];
    hoja.getRow(t).height = 15.75;
    hoja.mergeCells(`A${t}:E${t}`);
    for (let c = 1; c <= 21; c += 1) {
      const celda = hoja.getCell(t, c);
      celda.font = fuente(9, c <= 5 ? { bold: true } : {});
      celda.alignment = { horizontal: 'center', vertical: 'middle' };
      const formato = formatoColumna(c);
      if (formato) celda.numFmt = formato;
      if (c >= 6) recuadro(celda.address);
    }
    recuadro(`A${t}:E${t}`);

    // Claves de las columnas, notas, firmas y pie, igual que la plantilla.
    const claves = [
      'A= TOTAL DE ALUMNOS POR MATERIA',
      'B= No. DE ALUMNOS ACREDITADOS',
      'C= % DE ALUMNOS ACREDITADOS',
      'D= No. DE ALUMNOS NO ACREDITADOS',
      'E= % DE ALUMNOS NO ACREDITADOS',
      'F= No. DE ALUMNOS QUE DESERTARON DURANTE EL SEMESTRE EN LA MATERIA',
      'G= % DE ALUMNOS QUE DESERTARON EN LA MATERIA',
    ];
    for (let r = t + 1; r <= t + 18; r += 1) hoja.getRow(r).height = 15.75;
    claves.forEach((texto, i) => {
      const r = t + 1 + i;
      combinar(`A${r}:N${r}`);
      escribir(`A${r}`, texto, fuente(9), { horizontal: 'left' });
    });
    for (let c = 1; c <= 14; c += 1) {
      hoja.getCell(t + 1, c).border = { top: linea };
    }

    const filaNotas = t + 10;
    const sinSexo = totales.total.sinDato;
    const notas = [
      '1. Se entregará un reporte por división',
      '2. Se entenderá como alumno desertor el que no se presentó durante el periodo que se está reportando.',
      ...(sinSexo
        ? [
            `3. ${sinSexo} alumno${sinSexo === 1 ? '' : 's'} sin sexo registrado no se cuenta${sinSexo === 1 ? '' : 'n'} en las columnas H y M.`,
          ]
        : []),
    ];
    hoja.getRow(filaNotas).height = sinSexo ? 58 : 45.75;
    escribir(`A${filaNotas}`, 'NOTAS.', fuente(9, { bold: true }), {
      horizontal: 'left',
      vertical: 'middle',
    });
    combinar(`B${filaNotas}:U${filaNotas}`);
    escribir(`B${filaNotas}`, notas.join('\n'), fuente(9), {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true,
    });

    const filaCargo = t + 12;
    const filaNombre = t + 14;
    const firmas: Array<[string, string, string]> = [
      ['A', 'E', 'Docente'],
      ['I', 'Q', 'Jefe (a) de División'],
    ];
    const nombres = [
      reporte.docente.nombre.toUpperCase(),
      (reporte.jefeDivision?.nombre ?? '').toUpperCase(),
    ];
    firmas.forEach(([desde, hasta, cargo], i) => {
      combinar(`${desde}${filaCargo}:${hasta}${filaCargo}`);
      escribir(`${desde}${filaCargo}`, cargo, fuente(9, { bold: true }), {
        horizontal: 'center',
      });
      combinar(`${desde}${filaNombre}:${hasta}${filaNombre}`);
      const nombre = escribir(
        `${desde}${filaNombre}`,
        nombres[i],
        fuente(9, { bold: true }),
        { horizontal: 'center' },
      );
      nombre.numFmt = '@';
      subrayar(`${desde}${filaNombre}:${hasta}${filaNombre}`);
    });

    const filaPie = t + 18;
    combinar(`A${filaPie}:B${filaPie}`);
    escribir(
      `A${filaPie}`,
      'REPORTE PARCIAL DEL SEMESTRE',
      fuente(8, { bold: true }),
      { horizontal: 'left' },
    );
    combinar(`T${filaPie}:U${filaPie}`);
    escribir(`T${filaPie}`, 'Rev. 1', fuente(8, { bold: true }), {
      horizontal: 'right',
    });

    // Impresión: carta horizontal, centrada, sin cuadrícula. Con más de 8
    // asignaturas se ajusta a una hoja para conservar "Página 1 de 1".
    hoja.pageSetup = {
      orientation: 'landscape',
      ...(reporte.filas.length > 8
        ? { fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
        : { fitToPage: false, scale: 78 }),
      horizontalCentered: true,
      verticalCentered: true,
      showGridLines: false,
      margins: {
        left: 0.7086614173228347,
        right: 0,
        top: 0,
        bottom: 0.15748031496062992,
        header: 0,
        footer: 0,
      },
      printArea: `A1:U${filaPie}`,
    };
    // exceljs deja posición y tamaño de cada imagen en 0. Excel se guía por las
    // anclas, pero Vista Rápida, Numbers y otros visores leen esos valores.
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const dibujo = 'xl/drawings/drawing1.xml';
    const xml = await zip.file(dibujo)?.async('string');
    if (xml) {
      let i = 0;
      zip.file(
        dibujo,
        xml.replace(/<a:off x="0" y="0"\/><a:ext cx="0" cy="0"\/>/g, () => {
          const [x, y, cx, cy] = marcos[i++] ?? [0, 0, 0, 0];
          return `<a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/>`;
        }),
      );
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  private pdf(reporte: Reporte): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 28,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const izquierda = doc.page.margins.left;
      const ancho = doc.page.width - izquierda - doc.page.margins.right;
      const tinta = '#18324d';
      const tenue = '#617083';
      doc.image(TECNM_SIMBOLO, izquierda, 17, { fit: [62, 62] });
      doc
        .font('Helvetica-Bold')
        .fontSize(7.2)
        .fillColor('#153a6b')
        .text('TECNOLÓGICO\nNACIONAL DE MÉXICO', izquierda + 58, 32, {
          width: 82,
          lineGap: 0.5,
        });
      doc.image(ESCUDO, doc.page.width - doc.page.margins.right - 68, 12, {
        fit: [68, 68],
      });
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(tinta)
        .text(reporte.institucion, izquierda + 145, 25, {
          width: ancho - 220,
          align: 'center',
        });
      doc
        .fontSize(8)
        .text(
          'Nombre del formato: Reporte parcial del semestre del SGI del G3',
          izquierda + 145,
          44,
          { width: ancho - 220, align: 'center' },
        );
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(tenue)
        .text(`Página 1 · Versión ${reporte.version}`, izquierda + 145, 59, {
          width: ancho - 220,
          align: 'center',
        });
      doc
        .moveTo(izquierda, 78)
        .lineTo(izquierda + ancho, 78)
        .strokeColor('#9aa5b1')
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(tinta)
        .text(reporte.institucion.toUpperCase(), izquierda, 88, {
          width: ancho,
          align: 'center',
        });
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(reporte.area.toUpperCase(), { align: 'center' });
      doc
        .moveDown(0.7)
        .font('Helvetica-Bold')
        .text(`DIVISIÓN DE: ${reporte.carrera.nombre.toUpperCase()}`, {
          align: 'center',
        });
      doc.moveDown(0.8).font('Helvetica').fontSize(7.5).fillColor(tinta);
      const info = [
        `REPORTE: PARCIAL`,
        `SEMESTRE: ${reporte.periodoTexto}`,
        `PERIODO: ${fechaLarga(reporte.intervalo.desde)} AL ${fechaLarga(reporte.intervalo.hasta)}`,
        `PROFESOR(A): ${reporte.docente.nombre.toUpperCase()}`,
        `GRUPOS: ${reporte.gruposAtendidos} · ASIGNATURAS: ${reporte.asignaturasDiferentes}`,
      ];
      doc.text(
        info.slice(0, 2).join('                                      '),
        izquierda,
      );
      doc.text(info[2], izquierda);
      doc.font('Helvetica-Bold').text(info[3], izquierda);
      doc.font('Helvetica').text(info[4], izquierda);
      doc.moveDown(0.6);

      const columnas = [
        ['Asignatura', 118],
        ['U', 20],
        ['Sem.', 25],
        ['Grupo', 42],
        ['A H', 24],
        ['A M', 24],
        ['PO H', 24],
        ['PO M', 24],
        ['SO H', 24],
        ['SO M', 24],
        ['C H', 27],
        ['C M', 27],
        ['D H', 24],
        ['D M', 24],
        ['E H', 27],
        ['E M', 27],
        ['F H', 24],
        ['F M', 24],
        ['G H', 27],
        ['G M', 27],
      ] as const;
      const escala = ancho / columnas.reduce((s, [, w]) => s + w, 0);
      const widths = columnas.map(([, w]) => w * escala);
      const dibujarFila = (
        valores: Array<string | number>,
        header = false,
        total = false,
      ) => {
        const y = doc.y;
        const font = header || total ? 'Helvetica-Bold' : 'Helvetica';
        const size = header ? 6.4 : 6.2;
        doc.font(font).fontSize(size);
        const alto = Math.max(
          18,
          ...valores.map(
            (v, i) =>
              doc.heightOfString(String(v), { width: widths[i] - 4 }) + 6,
          ),
        );
        if (y + alto > doc.page.height - 54) {
          doc.addPage();
          doc.y = 36;
        }
        const actualY = doc.y;
        let x = izquierda;
        valores.forEach((valor, i) => {
          if (header || total)
            doc
              .rect(x, actualY, widths[i], alto)
              .fill(header ? '#153a6b' : '#eaf0f7');
          doc
            .fillColor(header ? '#ffffff' : tinta)
            .text(String(valor), x + 2, actualY + 3, {
              width: widths[i] - 4,
              align: i === 0 ? 'left' : 'center',
            });
          doc
            .rect(x, actualY, widths[i], alto)
            .strokeColor('#9aa5b1')
            .lineWidth(0.35)
            .stroke();
          x += widths[i];
        });
        doc.x = izquierda;
        doc.y = actualY + alto;
      };
      dibujarFila(
        columnas.map(([label]) => label),
        true,
      );
      reporte.filas.forEach((fila) =>
        dibujarFila(
          this.valoresFila(fila).map((v, i) =>
            [10, 11, 14, 15, 18, 19].includes(i)
              ? `${Math.round(Number(v) * 100)}%`
              : v,
          ),
        ),
      );
      const totalValores = this.valoresFila({
        ...reporte.totales,
        materia: { nombre: 'TOTAL' },
        unidad: null,
        semestre: '',
        grupo: { nombre: '' },
      });
      dibujarFila(
        totalValores.map((v, i) =>
          [10, 11, 14, 15, 18, 19].includes(i)
            ? `${Math.round(Number(v) * 100)}%`
            : v,
        ),
        false,
        true,
      );
      doc.moveDown(0.5).font('Helvetica').fontSize(6.8).fillColor(tenue);
      doc.text(
        `Pendientes de calificación: ${reporte.totales.pendientes}. Alumnos sin sexo registrado: ${reporte.totales.total.sinDato}.`,
        izquierda,
        doc.y,
        { width: ancho },
      );
      reporte.notas.forEach((nota, index) =>
        doc.text(`${index + 1}. ${nota}`, izquierda, doc.y + 2, {
          width: ancho,
        }),
      );
      if (doc.y + 72 > doc.page.height - 28) {
        doc.addPage();
        doc.y = 42;
      }
      const firmaY = doc.y + 38;
      const anchoFirma = 245;
      const izquierdaFirma = izquierda + 58;
      const derechaFirma = izquierda + ancho - anchoFirma - 58;
      [
        {
          x: izquierdaFirma,
          nombre: reporte.docente.nombre,
          cargo: 'DOCENTE',
        },
        {
          x: derechaFirma,
          nombre: reporte.jefeDivision?.nombre ?? 'SIN JEFE ASIGNADO',
          cargo: 'JEFE(A) DE DIVISIÓN',
        },
      ].forEach(({ x, nombre, cargo }) => {
        doc
          .moveTo(x, firmaY)
          .lineTo(x + anchoFirma, firmaY)
          .strokeColor('#44556a')
          .lineWidth(0.55)
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(tinta)
          .text(nombre.toUpperCase(), x, firmaY + 5, {
            width: anchoFirma,
            align: 'center',
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor('#153a6b')
          .text(cargo, x, firmaY + 17, {
            width: anchoFirma,
            align: 'center',
          });
      });
      const paginas = doc.bufferedPageRange();
      for (let i = 0; i < paginas.count; i += 1) {
        doc.switchToPage(paginas.start + i);
        doc
          .font('Helvetica')
          .fontSize(6)
          .fillColor(tenue)
          .text(
            `SICAT · ${reporte.carrera.codigo} · ${reporte.periodo} · página ${i + 1} de ${paginas.count}`,
            izquierda,
            doc.page.height - doc.page.margins.bottom - 7,
            { width: ancho, align: 'right', lineBreak: false },
          );
      }
      doc.end();
    });
  }
}
