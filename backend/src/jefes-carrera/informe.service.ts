import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma.service';
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
  CALIFICACION_LIMITE: 'Calificación entre 70 y 79',
  ASISTENCIA: 'Faltas y retardos ≥ 30 %',
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
    return formato === 'pdf'
      ? {
          buffer: await this.pdf(informe),
          contentType: 'application/pdf',
          filename: `${base}.pdf`,
        }
      : {
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
      ['Notas de seguimiento registradas', t.seguimientos],
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
        filas: informe.docentes.map(
          (d): Fila => [
            d.nombre,
            d.horasSemanales,
            d.esperadas,
            d.completas,
            d.parciales,
            d.sinCaptura,
            d.tardias,
            porcentaje(d.cobertura),
          ],
        ),
        vacio: 'Sin docentes con clases en la carrera.',
      },
      {
        titulo: 'Listas sin captura o parciales',
        columnas: ['Fecha', 'Horario', 'Materia', 'Grupo', 'Docente', 'Estado'],
        anchos: [16, 14, 32, 10, 28, 22],
        filas: informe.listasPendientes.map(
          (l): Fila => [
            fechaCorta(l.fecha),
            `${l.horaInicio}–${l.horaFin}`,
            l.materia,
            l.grupo,
            l.docente,
            l.estado === 'CAPTURA_PARCIAL'
              ? `Captura parcial (${l.registros} de ${l.alumnos})`
              : ESTADO_LISTA[l.estado],
          ],
        ),
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
        ],
        anchos: [30, 10, 26, 44, 14, 14],
        filas: informe.avance.map(
          (o): Fila => [
            o.materia,
            o.grupo,
            o.docentes.join(', ') || 'Sin docente asignado',
            o.unidades
              .map((u) => `U${u.orden} ${ESTADO_UNIDAD[u.status] ?? u.status}`)
              .join(' · ') || 'Sin unidades',
            o.calificacionesPendientes,
            o.entregasPendientes,
          ],
        ),
        vacio: 'Sin materias ofertadas en el periodo.',
      },
      {
        titulo: 'Alumnos en riesgo (al corte)',
        columnas: ['Alumno', 'Control', 'Sexo', 'Grupo', 'Materias', 'Motivos'],
        anchos: [28, 12, 7, 10, 34, 38],
        filas: informe.riesgos.map(
          (a): Fila => [
            a.nombre,
            a.numeroControl ?? '—',
            letraSexo(a.sexo) || '—',
            a.grupos.join(', '),
            a.materias.join(', '),
            a.motivos.join(' · '),
          ],
        ),
        vacio: 'Sin alumnos en riesgo con el criterio vigente.',
      },
      {
        titulo: 'Seguimientos registrados en el intervalo',
        columnas: ['Fecha', 'Caso', 'Nota', 'Estado', 'Registró'],
        anchos: [16, 36, 48, 11, 22],
        filas: informe.seguimientos.map(
          (n): Fila => [
            new Date(n.fecha).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
            }),
            n.caso,
            n.texto,
            ESTADO_SEGUIMIENTO[n.estado] ?? n.estado,
            n.autor,
          ],
        ),
        vacio: 'Sin notas de seguimiento en el intervalo.',
      },
    ];
  }

  private async excel(informe: Informe) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SICAT';
    const resumen = workbook.addWorksheet('Resumen');
    resumen.addRow(['Informe de jefatura de carrera']).font = {
      bold: true,
      size: 14,
    };
    this.encabezado(informe).forEach((fila) => resumen.addRow(fila));
    resumen.addRow([]);
    resumen.addRow(['Indicador', 'Valor']).font = { bold: true };
    this.filasTotales(informe).forEach((fila) => resumen.addRow(fila));
    resumen.addRow([]);
    resumen.addRow([NOTA_EVIDENCIA]).font = { italic: true };
    resumen.getColumn(1).width = 46;
    resumen.getColumn(2).width = 48;

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

  private pdf(informe: Informe): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'LETTER',
        layout: 'landscape',
        bufferPages: true,
        info: {
          Title: `Informe ${informe.carrera.codigo} ${informe.periodo}`,
          Author: 'SICAT',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const tinta = '#222f49';
      const tenue = '#6a7790';
      const linea = '#dde2ee';
      const izquierda = doc.page.margins.left;
      const ancho = doc.page.width - izquierda - doc.page.margins.right;
      const limite = () => doc.page.height - doc.page.margins.bottom;

      doc.fillColor(tinta).font('Helvetica-Bold').fontSize(16);
      doc.text('Informe de jefatura de carrera', izquierda);
      doc.moveDown(0.4).font('Helvetica').fontSize(9).fillColor(tenue);
      this.encabezado(informe).forEach(([clave, valor]) =>
        doc.text(`${clave}: ${valor}`),
      );

      doc.moveDown(0.8).fillColor(tinta).font('Helvetica-Bold').fontSize(11);
      doc.text('Resumen');
      doc.moveDown(0.3).font('Helvetica').fontSize(9);
      this.filasTotales(informe).forEach(([clave, valor]) =>
        doc.text(`${clave}: ${valor}`),
      );
      doc.moveDown(0.3).fillColor(tenue).fontSize(8).text(NOTA_EVIDENCIA);

      for (const seccion of this.secciones(informe)) {
        if (doc.y > limite() - 60) doc.addPage();
        doc.moveDown(1).fillColor(tinta).font('Helvetica-Bold').fontSize(11);
        doc.text(seccion.titulo, izquierda);
        doc.moveDown(0.3);
        if (!seccion.filas.length) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(tenue)
            .text(seccion.vacio);
          continue;
        }
        const total = seccion.anchos.reduce((a, b) => a + b, 0);
        const anchos = seccion.anchos.map((a) => (a / total) * ancho);
        const fila = (celdas: Array<string | number>, negrita = false) => {
          doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
          const alto =
            Math.max(
              ...celdas.map((c, i) =>
                doc.heightOfString(String(c), { width: anchos[i] - 6 }),
              ),
            ) + 6;
          if (doc.y + alto > limite()) doc.addPage();
          const y = doc.y;
          let x = izquierda;
          celdas.forEach((c, i) => {
            doc
              .fillColor(negrita ? tenue : tinta)
              .text(String(c), x + 3, y + 3, { width: anchos[i] - 6 });
            x += anchos[i];
          });
          doc
            .moveTo(izquierda, y + alto)
            .lineTo(izquierda + ancho, y + alto)
            .strokeColor(linea)
            .lineWidth(0.5)
            .stroke();
          doc.x = izquierda;
          doc.y = y + alto;
        };
        fila(seccion.columnas, true);
        seccion.filas.forEach((celdas) => fila(celdas));
      }

      const paginas = doc.bufferedPageRange();
      for (let i = 0; i < paginas.count; i++) {
        doc.switchToPage(paginas.start + i);
        // Sin margen inferior, el pie no provoca una página nueva.
        const margen = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(tenue)
          .text(
            `SICAT · ${informe.carrera.codigo} · ${periodoTexto(informe.periodo)} · página ${i + 1} de ${paginas.count}`,
            izquierda,
            doc.page.height - doc.page.margins.bottom + 14,
            { width: ancho, align: 'right', lineBreak: false },
          );
        doc.page.margins.bottom = margen;
      }
      doc.end();
    });
  }
}
