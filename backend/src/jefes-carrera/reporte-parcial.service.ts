import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAsistencia, EstadoUnidad } from '@prisma/client';
import * as ExcelJS from 'exceljs';
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
const ESCUDO = rutaActivo('escudo-cosamaloapan.png');
const AZUL = '153A6B';
const AZUL_CLARO = 'EAF0F7';

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

  private async excel(reporte: Reporte) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SICAT';
    workbook.subject = 'Reporte parcial del semestre';
    const hoja = workbook.addWorksheet('Reporte parcial', {
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        paperSize: 9,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.4,
          bottom: 0.4,
          header: 0.1,
          footer: 0.1,
        },
      },
      views: [{ state: 'frozen', ySplit: 17 }],
    });
    const tecnm = workbook.addImage({
      filename: TECNM_SIMBOLO,
      extension: 'png',
    });
    const escudo = workbook.addImage({ filename: ESCUDO, extension: 'png' });
    hoja.addImage(tecnm, {
      tl: { col: 0.15, row: 0.1 },
      ext: { width: 78, height: 78 },
    });
    hoja.addImage(escudo, {
      tl: { col: 18.15, row: 0.05 },
      ext: { width: 88, height: 88 },
    });
    hoja.mergeCells('B1:C3');
    hoja.getCell('B1').value = 'TECNOLÓGICO\nNACIONAL DE MÉXICO';
    hoja.getCell('B1').font = { bold: true, color: { argb: AZUL }, size: 9 };
    hoja.getCell('B1').alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true,
    };
    hoja.mergeCells('D1:R1');
    hoja.getCell('D1').value = reporte.institucion;
    hoja.mergeCells('D2:R2');
    hoja.getCell('D2').value =
      'Nombre del formato: Reporte parcial del semestre del SGI del G3';
    hoja.mergeCells('D3:J3');
    hoja.getCell('D3').value = 'Página 1 de 1';
    hoja.mergeCells('K3:R3');
    hoja.getCell('K3').value = `Versión ${reporte.version}`;
    ['D1', 'D2', 'D3', 'K3'].forEach((celda) => {
      hoja.getCell(celda).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      hoja.getCell(celda).font = { bold: true, size: celda === 'D1' ? 13 : 10 };
    });
    for (let r = 1; r <= 3; r += 1) hoja.getRow(r).height = r === 1 ? 30 : 24;
    hoja.mergeCells('A5:T5');
    hoja.getCell('A5').value = reporte.institucion.toUpperCase();
    hoja.mergeCells('A6:T6');
    hoja.getCell('A6').value = reporte.area.toUpperCase();
    hoja.mergeCells('A8:T8');
    hoja.getCell('A8').value =
      `DIVISIÓN DE: ${reporte.carrera.nombre.toUpperCase()}`;
    hoja.mergeCells('B10:F10');
    hoja.getCell('A10').value = 'REPORTE:';
    hoja.getCell('B10').value = 'PARCIAL';
    hoja.mergeCells('G10:J10');
    hoja.mergeCells('K10:T10');
    hoja.getCell('G10').value = 'SEMESTRE:';
    hoja.getCell('K10').value = reporte.periodoTexto;
    hoja.mergeCells('B11:F11');
    hoja.getCell('A11').value = 'PERIODO:';
    hoja.getCell('B11').value =
      `${fechaLarga(reporte.intervalo.desde)} al ${fechaLarga(reporte.intervalo.hasta)}`;
    hoja.mergeCells('B12:T12');
    hoja.getCell('A12').value = 'PROFESOR(A):';
    hoja.getCell('B12').value = reporte.docente.nombre.toUpperCase();
    hoja.mergeCells('B13:F13');
    hoja.getCell('A13').value = 'GRUPOS ATENDIDOS:';
    hoja.getCell('B13').value = reporte.gruposAtendidos;
    hoja.mergeCells('G13:J13');
    hoja.mergeCells('K13:T13');
    hoja.getCell('G13').value = 'ASIGNATURAS DIFERENTES:';
    hoja.getCell('K13').value = reporte.asignaturasDiferentes;
    ['A5', 'A6', 'A8'].forEach((celda) => {
      hoja.getCell(celda).font = { bold: true, size: celda === 'A5' ? 12 : 10 };
      hoja.getCell(celda).alignment = { horizontal: 'center' };
    });

    hoja.mergeCells('A15:A17');
    hoja.mergeCells('B15:B17');
    hoja.mergeCells('C15:C17');
    hoja.mergeCells('D15:D17');
    hoja.getCell('A15').value = 'Asignatura';
    hoja.getCell('B15').value = 'Unidad';
    hoja.getCell('C15').value = 'Semestre';
    hoja.getCell('D15').value = 'Grupo';
    const grupos = [
      ['E15:F15', 'A', 'Alumnos'],
      ['G15:J15', 'B', 'Acreditados'],
      ['K15:L15', 'C', '% acreditados'],
      ['M15:N15', 'D', 'No acreditados'],
      ['O15:P15', 'E', '% no acreditados'],
      ['Q15:R15', 'F', 'Desertores'],
      ['S15:T15', 'G', '% desertores'],
    ];
    grupos.forEach(([rango, letra, titulo]) => {
      hoja.mergeCells(rango);
      const celda = hoja.getCell(rango.split(':')[0]);
      celda.value = `${letra} · ${titulo}`;
    });
    hoja.mergeCells('G16:H16');
    hoja.mergeCells('I16:J16');
    hoja.getCell('G16').value = 'PO';
    hoja.getCell('I16').value = 'SO';
    hoja.mergeCells('E16:F16');
    hoja.getCell('E16').value = 'Sexo';
    [
      ['E17', 'F17'],
      ['G17', 'H17'],
      ['I17', 'J17'],
      ['K17', 'L17'],
      ['M17', 'N17'],
      ['O17', 'P17'],
      ['Q17', 'R17'],
      ['S17', 'T17'],
    ].forEach(([hombres, mujeres]) => {
      hoja.getCell(hombres).value = 'H';
      hoja.getCell(mujeres).value = 'M';
    });
    const encabezado = hoja.getRows(15, 3)!;
    encabezado.forEach((fila) => {
      fila.height = 22;
      fila.eachCell({ includeEmpty: true }, (celda) => {
        celda.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: AZUL },
        };
        celda.font = { color: { argb: 'FFFFFF' }, bold: true, size: 8 };
        celda.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        celda.border = this.bordeExcel();
      });
    });
    let filaNumero = 18;
    reporte.filas.forEach((fila) => {
      const row = hoja.getRow(filaNumero++);
      row.values = this.valoresFila(fila);
      row.height = 28;
      row.eachCell({ includeEmpty: true }, (celda, col) => {
        celda.alignment = {
          vertical: 'middle',
          horizontal: col === 1 ? 'left' : 'center',
          wrapText: true,
        };
        celda.border = this.bordeExcel();
        celda.font = { size: 8 };
        if ([11, 12, 15, 16, 19, 20].includes(col)) celda.numFmt = '0%';
      });
    });
    const totalRow = hoja.getRow(filaNumero++);
    totalRow.values = [
      'TOTAL',
      '',
      '',
      '',
      ...this.valoresFila({
        ...reporte.totales,
        materia: { nombre: '' },
        unidad: null,
        semestre: '',
        grupo: { nombre: '' },
      }).slice(4),
    ];
    totalRow.height = 24;
    totalRow.eachCell({ includeEmpty: true }, (celda, col) => {
      celda.font = {
        bold: true,
        size: 8,
        color: { argb: col === 1 ? 'FFFFFF' : '000000' },
      };
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: col === 1 ? AZUL : AZUL_CLARO },
      };
      celda.alignment = {
        horizontal: col === 1 ? 'left' : 'center',
        vertical: 'middle',
      };
      celda.border = this.bordeExcel();
      if ([11, 12, 15, 16, 19, 20].includes(col)) celda.numFmt = '0%';
    });
    hoja.mergeCells(filaNumero, 1, filaNumero, 20);
    hoja.getCell(filaNumero, 1).value =
      `Pendientes de calificación: ${reporte.totales.pendientes}. Alumnos sin sexo registrado: ${reporte.totales.total.sinDato}.`;
    hoja.getCell(filaNumero, 1).font = { italic: true, size: 8 };
    filaNumero += 2;
    reporte.notas.forEach((nota, index) => {
      hoja.mergeCells(filaNumero + index, 1, filaNumero + index, 20);
      hoja.getCell(filaNumero + index, 1).value = `${index + 1}. ${nota}`;
      hoja.getCell(filaNumero + index, 1).font = { size: 8 };
      hoja.getCell(filaNumero + index, 1).alignment = { wrapText: true };
      hoja.getRow(filaNumero + index).height = 24;
    });
    const filaFirma = filaNumero + reporte.notas.length + 3;
    const firmas = [
      {
        rango: `B${filaFirma}:H${filaFirma}`,
        nombre: reporte.docente.nombre,
        cargo: 'DOCENTE',
        columna: 2,
      },
      {
        rango: `M${filaFirma}:S${filaFirma}`,
        nombre: reporte.jefeDivision?.nombre ?? 'SIN JEFE ASIGNADO',
        cargo: 'JEFE(A) DE DIVISIÓN',
        columna: 13,
      },
    ];
    firmas.forEach(({ rango, nombre, cargo, columna }) => {
      hoja.mergeCells(rango);
      hoja.getCell(filaFirma, columna).border = {
        bottom: { style: 'thin', color: { argb: '44556A' } },
      };
      hoja.mergeCells(filaFirma + 1, columna, filaFirma + 1, columna + 6);
      hoja.getCell(filaFirma + 1, columna).value = nombre.toUpperCase();
      hoja.mergeCells(filaFirma + 2, columna, filaFirma + 2, columna + 6);
      hoja.getCell(filaFirma + 2, columna).value = cargo;
      [filaFirma + 1, filaFirma + 2].forEach((fila) => {
        hoja.getCell(fila, columna).alignment = { horizontal: 'center' };
        hoja.getCell(fila, columna).font = {
          bold: fila === filaFirma + 2,
          size: 8,
          color: { argb: fila === filaFirma + 2 ? AZUL : '000000' },
        };
      });
    });
    hoja.getRow(filaFirma).height = 30;
    hoja.columns = [34, 9, 10, 12, ...Array.from({ length: 16 }, () => 7)].map(
      (width) => ({ width }),
    );
    hoja.pageSetup.printArea = `A1:T${filaFirma + 2}`;
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private bordeExcel(): Partial<ExcelJS.Borders> {
    const borde = { style: 'thin' as const, color: { argb: '9AA5B1' } };
    return { top: borde, left: borde, bottom: borde, right: borde };
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
