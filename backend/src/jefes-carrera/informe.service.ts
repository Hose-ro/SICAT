import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import {
  bordesExcel,
  cabeceraExcel,
  crearPdfInstitucional,
  encabezadoExcel,
  firmas,
  observaciones,
  tabla,
  tablaDatos,
  tituloSeccion,
} from '../reportes/formato-institucional';
import { letraSexo } from '../common/sexo';
import {
  formatearFechaClave,
  obtenerFinDelDia,
  parsearFechaClave,
} from '../clases/clases.utils';
import { SupervisionService } from './supervision.service';
import { SeguimientosService } from './seguimientos.service';
import { fechaSupervision, periodoSupervision } from './supervision.utils';

type ConsultaInforme = {
  carreraId: number;
  periodo?: string;
  desde: string;
  hasta: string;
};
type Informe = Awaited<ReturnType<InformeService['informe']>>;
/** Forma de los alumnos en riesgo del resumen de supervisión. */
type RiesgoResumen = {
  id: number;
  nombre: string;
  numeroControl: string | null;
  sexo: string | null;
  causas: Array<{
    materia: { nombre: string };
    grupo: { nombre: string };
    motivos: string[];
  }>;
};
type Fila = Array<string | number>;

const MOTIVOS: Record<string, string> = {
  CALIFICACION_BAJA: 'Calificación reprobatoria',
  ASISTENCIA: 'Faltas y retardos ≥ 30 %',
  ENTREGAS: 'Tareas vencidas sin entregar ≥ 30 %',
};
const ESTADO_LISTA: Record<string, string> = {
  SIN_CAPTURA: 'Sin captura',
  CAPTURA_PARCIAL: 'Captura parcial',
};
const ESTADO_UNIDAD: Record<string, string> = {
  PENDIENTE: 'pendiente',
  ACTIVA: 'en curso',
  FINALIZADA: 'cerrada',
};
const ESTADO_SEGUIMIENTO: Record<string, string> = {
  NUEVA: 'Abierto',
  REVISADA: 'Abierto',
  EN_SEGUIMIENTO: 'Abierto',
  CERRADA: 'Cerrado',
};
const COMPLETAS = new Set(['LISTA_COMPLETA', 'REGISTRO_TARDIO']);
const NOTA_EVIDENCIA =
  'El registro en SICAT es evidencia de captura; no confirma presencia física del docente.';

const fechaLarga = (clave: string) =>
  parsearFechaClave(clave)!.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
const fechaCorta = (clave: string) =>
  parsearFechaClave(clave)!.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
const periodoTexto = (periodo: string) =>
  `${periodo.endsWith('A') ? 'Ene–Jun' : 'Ago–Dic'} ${periodo.slice(0, 4)}`;
const porcentaje = (valor: number | null) =>
  valor == null ? 'Sin clases' : `${valor} %`;

/**
 * Informe del periodo para juntas académicas y evidencia institucional. Reúne
 * las mismas cifras que la supervisión en pantalla, acotadas a un intervalo.
 */
@Injectable()
export class InformeService {
  constructor(
    private prisma: PrismaService,
    private supervision: SupervisionService,
    private seguimientos: SeguimientosService,
  ) {}

  async informe(usuarioId: number, consulta: ConsultaInforme) {
    const periodo = periodoSupervision(consulta.periodo);
    const desde = fechaSupervision(consulta.desde);
    const hasta = fechaSupervision(consulta.hasta);
    if (hasta < desde)
      throw new BadRequestException(
        'La fecha final debe ser igual o posterior a la inicial',
      );
    // resumen() valida el alcance de la carrera antes de cualquier otra consulta.
    const resumen = await this.supervision.resumen(usuarioId, {
      carreraId: consulta.carreraId,
      periodo,
    });
    const inicioPeriodo = formatearFechaClave(
      resumen.calendarios.reduce(
        (a, c) => (c.inicio < a ? c.inicio : a),
        resumen.calendarios[0].inicio,
      ),
    );
    const finPeriodo = formatearFechaClave(
      resumen.calendarios.reduce(
        (a, c) => (c.fin > a ? c.fin : a),
        resumen.calendarios[0].fin,
      ),
    );
    if (consulta.desde < inicioPeriodo || consulta.hasta > finPeriodo)
      throw new BadRequestException(
        `El intervalo debe quedar dentro del periodo (${inicioPeriodo} a ${finPeriodo})`,
      );

    const [carrera, clases, notas] = await Promise.all([
      this.prisma.carrera.findUniqueOrThrow({
        where: { id: consulta.carreraId },
        select: { id: true, nombre: true, codigo: true },
      }),
      this.supervision.clases(
        usuarioId,
        { carreraId: consulta.carreraId, periodo },
        consulta.desde,
        consulta.hasta,
      ),
      this.seguimientos.notasEnRango(
        consulta.carreraId,
        periodo,
        desde,
        obtenerFinDelDia(hasta),
      ),
    ]);
    const elegibles = clases.filter((c) => c.elegible);

    const docentes = resumen.docentes
      .map((d) => {
        const propias = elegibles.filter((c) => c.docente.id === d.id);
        const completas = propias.filter((c) => COMPLETAS.has(c.estado));
        return {
          id: d.id,
          nombre: d.nombre,
          horasSemanales: d.horasSemanales,
          esperadas: propias.length,
          completas: completas.length,
          parciales: propias.filter((c) => c.estado === 'CAPTURA_PARCIAL')
            .length,
          sinCaptura: propias.filter((c) => c.estado === 'SIN_CAPTURA').length,
          tardias: propias.filter((c) => c.estado === 'REGISTRO_TARDIO').length,
          cobertura: propias.length
            ? Math.round((completas.length / propias.length) * 100)
            : null,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const listasPendientes = elegibles
      .filter((c) => c.estado in ESTADO_LISTA)
      .map((c) => ({
        fecha: c.fecha,
        horaInicio: c.horaInicio,
        horaFin: c.horaFin,
        materia: c.materia.nombre,
        grupo: c.grupo.nombre,
        docente: c.docente.nombre,
        estado: c.estado,
        registros: c.registros,
        alumnos: c.alumnos,
      }));

    const avance = resumen.ofertas.map((o) => ({
      materia: o.materia.nombre,
      clave: o.materia.clave,
      grupo: o.grupo.nombre,
      modalidad: o.grupo.modalidad,
      docentes: o.docentes.map((d) => d.nombre),
      unidades: o.unidades.map((u) => ({
        orden: u.orden,
        nombre: u.nombre,
        status: u.status,
      })),
      calificacionesPendientes: Number(o.resumen.calificacionesPendientes),
      entregasPendientes: Number(o.resumen.entregasPendientes),
      cierre: o.cierre
        ? {
            cerradoEn: o.cierre.cerradoEn,
            total: o.cierre.total,
            acreditados: o.cierre.acreditados,
            noAcreditados: o.cierre.noAcreditados,
          }
        : null,
    }));

    const riesgos = (resumen.riesgos as RiesgoResumen[])
      .map((a) => ({
        id: a.id,
        nombre: a.nombre,
        numeroControl: a.numeroControl,
        sexo: a.sexo,
        materias: [...new Set(a.causas.map((c) => c.materia.nombre))],
        grupos: [...new Set(a.causas.map((c) => c.grupo.nombre))],
        motivos: [...new Set(a.causas.flatMap((c) => c.motivos))].map(
          (m: string) => MOTIVOS[m] ?? m,
        ),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const completas = elegibles.filter((c) => COMPLETAS.has(c.estado)).length;
    return {
      generadoEn: new Date().toISOString(),
      carrera,
      periodo,
      intervalo: { desde: consulta.desde, hasta: consulta.hasta },
      limites: { inicio: inicioPeriodo, fin: finPeriodo },
      totales: {
        clasesEsperadas: elegibles.length,
        listasCompletas: completas,
        listasPendientes: listasPendientes.length,
        cobertura: elegibles.length
          ? Math.round((completas / elegibles.length) * 100)
          : null,
        alumnosRiesgo: riesgos.length,
        calificacionesPendientes: resumen.indicadores.calificacionesPendientes,
        seguimientos: notas.length,
      },
      docentes,
      listasPendientes,
      avance,
      riesgos,
      seguimientos: notas,
    };
  }

  async exportar(
    usuarioId: number,
    consulta: ConsultaInforme,
    formato: 'excel' | 'pdf' = 'excel',
  ) {
    const informe = await this.informe(usuarioId, consulta);
    const base = [
      'SICAT',
      informe.carrera.codigo,
      informe.periodo,
      informe.intervalo.desde,
      informe.intervalo.hasta,
    ]
      .join('_')
      .replace(/[^\w.-]+/g, '-');
    if (formato === 'pdf') {
      const jefe = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true },
      });
      return {
        buffer: await this.pdf(informe, jefe?.nombre ?? null),
        contentType: 'application/pdf',
        filename: `${base}.pdf`,
      };
    }
    return {
      buffer: await this.excel(informe),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${base}.xlsx`,
    };
  }

  private encabezado(informe: Informe) {
    return [
      ['Carrera', `${informe.carrera.nombre} (${informe.carrera.codigo})`],
      ['Periodo', periodoTexto(informe.periodo)],
      [
        'Intervalo',
        `${fechaLarga(informe.intervalo.desde)} al ${fechaLarga(informe.intervalo.hasta)}`,
      ],
      [
        'Generado',
        new Date(informe.generadoEn).toLocaleString('es-MX', {
          dateStyle: 'long',
          timeStyle: 'short',
        }),
      ],
    ];
  }

  private filasTotales(informe: Informe): Array<[string, string | number]> {
    const t = informe.totales;
    return [
      ['Clases con lista esperada', t.clasesEsperadas],
      ['Listas completas', t.listasCompletas],
      ['Listas sin captura o parciales', t.listasPendientes],
      ['Cobertura de captura', porcentaje(t.cobertura)],
      [
        'Calificaciones de unidad pendientes (al corte)',
        t.calificacionesPendientes,
      ],
      ['Alumnos en riesgo (al corte)', t.alumnosRiesgo],
      ['Observaciones registradas', t.seguimientos],
    ];
  }

  private secciones(informe: Informe) {
    return [
      {
        titulo: 'Cobertura de captura por docente',
        columnas: [
          'Docente',
          'Horas/semana',
          'Esperadas',
          'Completas',
          'Parciales',
          'Sin captura',
          'Tardías',
          'Cobertura',
        ],
        anchos: [30, 12, 11, 11, 11, 12, 10, 12],
        filas: informe.docentes.map((d): Fila => [
          d.nombre,
          d.horasSemanales,
          d.esperadas,
          d.completas,
          d.parciales,
          d.sinCaptura,
          d.tardias,
          porcentaje(d.cobertura),
        ]),
        vacio: 'Sin docentes con clases en la carrera.',
      },
      {
        titulo: 'Listas sin captura o parciales',
        columnas: ['Fecha', 'Horario', 'Materia', 'Grupo', 'Docente', 'Estado'],
        anchos: [16, 14, 32, 10, 28, 22],
        filas: informe.listasPendientes.map((l): Fila => [
          fechaCorta(l.fecha),
          `${l.horaInicio}–${l.horaFin}`,
          l.materia,
          l.grupo,
          l.docente,
          l.estado === 'CAPTURA_PARCIAL'
            ? `Captura parcial (${l.registros} de ${l.alumnos})`
            : ESTADO_LISTA[l.estado],
        ]),
        vacio: 'Todas las listas del intervalo están completas.',
      },
      {
        titulo: 'Avance de unidades por materia y grupo',
        columnas: [
          'Materia',
          'Grupo',
          'Docente',
          'Unidades',
          'Calif. pendientes',
          'Entregas sin revisar',
          'Cierre',
        ],
        anchos: [28, 9, 24, 38, 12, 12, 24],
        filas: informe.avance.map((o): Fila => [
          o.materia,
          o.grupo,
          o.docentes.join(', ') || 'Sin docente asignado',
          o.unidades
            .map((u) => `U${u.orden} ${ESTADO_UNIDAD[u.status] ?? u.status}`)
            .join(' · ') || 'Sin unidades',
          o.calificacionesPendientes,
          o.entregasPendientes,
          o.cierre
            ? `Cerrado el ${new Date(o.cierre.cerradoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${o.cierre.acreditados} de ${o.cierre.total} acreditados`
            : 'Sin cerrar',
        ]),
        vacio: 'Sin materias ofertadas en el periodo.',
      },
      {
        titulo: 'Alumnos en riesgo (al corte)',
        columnas: ['Alumno', 'Control', 'Sexo', 'Grupo', 'Materias', 'Motivos'],
        anchos: [28, 12, 7, 10, 34, 38],
        filas: informe.riesgos.map((a): Fila => [
          a.nombre,
          a.numeroControl ?? '—',
          letraSexo(a.sexo) || '—',
          a.grupos.join(', '),
          a.materias.join(', '),
          a.motivos.join(' · '),
        ]),
        vacio: 'Sin alumnos en riesgo con el criterio vigente.',
      },
      {
        titulo: 'Observaciones registradas en el intervalo',
        columnas: ['Fecha', 'Caso', 'Nota', 'Estado', 'Registró'],
        anchos: [16, 36, 48, 11, 22],
        filas: informe.seguimientos.map((n): Fila => [
          new Date(n.fecha).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
          }),
          n.caso,
          n.texto,
          ESTADO_SEGUIMIENTO[n.estado] ?? n.estado,
          n.autor,
        ]),
        vacio: 'Sin observaciones en el intervalo.',
      },
    ];
  }

  private async excel(informe: Informe) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SICAT';
    const resumen = workbook.addWorksheet('Resumen');
    resumen.getColumn(1).width = 46;
    resumen.getColumn(2).width = 48;
    encabezadoExcel(workbook, resumen, this.formato(informe), 2);
    this.encabezado(informe).forEach((fila) => resumen.addRow(fila));
    resumen.addRow([]);
    cabeceraExcel(resumen.addRow(['Indicador', 'Valor']));
    this.filasTotales(informe).forEach((fila) =>
      bordesExcel(resumen.addRow(fila), 2),
    );
    resumen.addRow([]);
    resumen.addRow([NOTA_EVIDENCIA]).font = { italic: true };

    for (const seccion of this.secciones(informe)) {
      const hoja = workbook.addWorksheet(seccion.titulo.slice(0, 31));
      hoja.addRow(seccion.columnas).font = { bold: true };
      hoja.views = [{ state: 'frozen', ySplit: 1 }];
      seccion.anchos.forEach(
        (ancho, i) => (hoja.getColumn(i + 1).width = ancho),
      );
      if (!seccion.filas.length) hoja.addRow([seccion.vacio]);
      seccion.filas.forEach((fila) => hoja.addRow(fila));
      hoja.eachRow(
        (row) => (row.alignment = { vertical: 'top', wrapText: true }),
      );
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private formato(informe: Informe) {
    return {
      titulo: 'Informe de jefatura de carrera',
      subtitulo: `${informe.carrera.nombre} · ${periodoTexto(informe.periodo)}`,
    };
  }

  private pdf(informe: Informe, jefe: string | null): Promise<Buffer> {
    const { doc, terminar } = crearPdfInstitucional(this.formato(informe), {
      layout: 'landscape',
    });
    tablaDatos(doc, this.encabezado(informe) as Array<[string, string]>);

    tituloSeccion(doc, 'Resumen');
    tabla(doc, {
      columnas: ['Indicador', 'Valor'],
      anchos: [70, 30],
      alinear: ['left', 'center'],
      filas: this.filasTotales(informe),
    });

    for (const seccion of this.secciones(informe)) {
      tituloSeccion(doc, seccion.titulo);
      tabla(doc, {
        columnas: seccion.columnas,
        anchos: seccion.anchos,
        filas: seccion.filas,
        tamano: 8,
        vacio: seccion.vacio,
      });
    }

    firmas(doc, [{ cargo: 'Jefe(a) de carrera', nombre: jefe }]);
    observaciones(doc, [NOTA_EVIDENCIA]);
    return terminar();
  }
}
