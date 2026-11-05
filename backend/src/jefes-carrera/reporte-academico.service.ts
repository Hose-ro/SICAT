import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import { letraSexo } from '../common/sexo';
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
import { SupervisionService } from './supervision.service';
import { ReporteAcademicoQueryDto } from './dto/reporte-academico.dto';

type Reporte = Awaited<ReturnType<ReporteAcademicoService['reporte']>>;
const media = (valores: Array<number | null>) => {
  const numeros = valores.filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n),
  );
  return numeros.length
    ? Math.round((numeros.reduce((s, n) => s + n, 0) / numeros.length) * 10) /
        10
    : null;
};
const claveUnidad = (
  u: { id?: number | null; orden?: number } | null | undefined,
) => u?.id ?? `orden:${u?.orden ?? ''}`;
const ESTADO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ACTIVA: 'En curso',
  FINALIZADA: 'Cerrada',
};
const NOTA =
  'Las calificaciones de unidades abiertas son provisionales salvo captura manual. El promedio considera solo unidades con calificación; las pendientes no equivalen a cero. La asistencia se calcula con registros de asistencia, sin inferir faltas de listas no capturadas. El avance de unidades es compartido por los grupos de la materia.';

@Injectable()
export class ReporteAcademicoService {
  constructor(
    private supervision: SupervisionService,
    private prisma: PrismaService,
  ) {}

  async reporte(usuarioId: number, consulta: ReporteAcademicoQueryDto) {
    // Reutiliza las comprobaciones de carrera, grupo, oferta y periodo de supervisión.
    const fuente = await this.supervision.reporte(
      usuarioId,
      consulta,
      consulta.materiaId,
      consulta.grupoId,
      true,
    );
    const carrera = await this.prisma.carrera.findUniqueOrThrow({
      where: { id: consulta.carreraId },
      select: { id: true, nombre: true, codigo: true },
    });
    const todas = fuente.unidades;
    if (consulta.unidadId && !todas.some((u) => u.id === consulta.unidadId))
      throw new BadRequestException(
        'La unidad no pertenece a la materia seleccionada',
      );
    // Unidades futuras sin actividad no reducen el promedio acumulado.
    const unidades = todas.filter((u) =>
      consulta.unidadId
        ? u.id === consulta.unidadId
        : u.status !== 'PENDIENTE' ||
          fuente.rows.some(
            (r) =>
              r.unidad?.id === u.id &&
              (r.calificacionFinal != null || r.asistencia?.registradas > 0),
          ),
    );
    const ids = new Set(unidades.map(claveUnidad));
    const alumnos = new Map<number, typeof fuente.rows>();
    // Todos los inscritos aparecen, aunque todavía no exista una unidad con actividad.
    for (const row of fuente.rows) {
      if (!alumnos.has(row.alumno.id)) alumnos.set(row.alumno.id, []);
      if (ids.has(claveUnidad(row.unidad)))
        alumnos.get(row.alumno.id)!.push(row);
    }
    const filas = [...alumnos]
      .map(([id, rows]) => {
        const alumno = fuente.rows.find((r) => r.alumno.id === id)!.alumno;
        const notas = unidades.map((u) => {
          const row = rows.find(
            (r) => claveUnidad(r.unidad) === claveUnidad(u),
          );
          return {
            unidadId: u.id,
            orden: u.orden,
            calificacion: row?.calificacionFinal ?? null,
            tipo:
              row?.calificacionFinal == null
                ? 'SIN_CAPTURA'
                : u.status === 'FINALIZADA' || row.calificacionManual != null
                  ? 'REAL'
                  : 'PROVISIONAL',
          };
        });
        const registradas = rows.reduce(
          (s, r) => s + (r.asistencia?.registradas ?? 0),
          0,
        );
        const asistencias = rows.reduce(
          (s, r) => s + (r.asistencia?.asistencias ?? 0),
          0,
        );
        return {
          alumno,
          notas,
          promedio: media(notas.map((n) => n.calificacion)),
          provisional: notas.some((n) => n.tipo === 'PROVISIONAL'),
          pendientes: notas.filter((n) => n.calificacion == null).length,
          asistencia: {
            registradas,
            asistencias,
            porcentaje: registradas
              ? Math.round((asistencias / registradas) * 100)
              : null,
          },
        };
      })
      .sort((a, b) => a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'));
    const registradas = filas.reduce((s, r) => s + r.asistencia.registradas, 0);
    const asistencias = filas.reduce((s, r) => s + r.asistencia.asistencias, 0);
    const cerradas = todas.filter((u) => u.status === 'FINALIZADA').length;
    return {
      generadoEn: fuente.generatedAt,
      periodo: fuente.periodo,
      carrera,
      materia: fuente.materia,
      grupo: fuente.grupo,
      unidadId: consulta.unidadId ?? null,
      unidades,
      avance: {
        cerradas,
        total: todas.length,
        porcentaje: todas.length
          ? Math.round((cerradas / todas.length) * 100)
          : null,
        unidades: todas.map((u) => ({
          id: u.id,
          orden: u.orden,
          nombre: u.nombre,
          status: u.status,
        })),
      },
      filas,
      resumen: {
        alumnos: filas.length,
        promedio: media(filas.map((f) => f.promedio)),
        asistencia: registradas
          ? Math.round((asistencias / registradas) * 100)
          : null,
        registradas,
      },
      nota: NOTA,
    };
  }

  private detalle(reporte: Reporte) {
    return {
      columnas: [
        'Alumno',
        'Control',
        'Sexo',
        ...reporte.unidades.map((u) => `U${u.orden}`),
        'Promedio',
        'Asistencia',
        'Registros',
        'Pendientes',
      ],
      filas: reporte.filas.map((f) => [
        f.alumno.nombre,
        f.alumno.numeroControl ?? '—',
        letraSexo(f.alumno.sexo) || '—',
        ...f.notas.map((n) =>
          n.calificacion == null
            ? 'Sin captura'
            : `${n.calificacion}${n.tipo === 'PROVISIONAL' ? ' (P)' : ''}`,
        ),
        f.promedio == null
          ? 'Sin captura'
          : `${f.promedio}${f.provisional ? ' (P)' : ''}`,
        f.asistencia.porcentaje == null
          ? 'Sin registros'
          : `${f.asistencia.porcentaje} %`,
        f.asistencia.registradas,
        f.pendientes,
      ]),
    };
  }

  async exportar(
    usuarioId: number,
    consulta: ReporteAcademicoQueryDto,
    formato: 'pdf' | 'excel' = 'pdf',
  ) {
    const r = await this.reporte(usuarioId, consulta);
    const unidad = r.unidades.find((u) => u.id === r.unidadId);
    const alcance = unidad
      ? `Unidad ${unidad.orden}: ${unidad.nombre}`
      : 'Acumulado a la fecha';
    const metadatos: Array<[string, string]> = [
      ['Carrera', r.carrera.nombre],
      ['Periodo', r.periodo],
      ['Materia', `${r.materia.clave} · ${r.materia.nombre}`],
      ['Grupo', r.grupo.nombre],
      ['Consulta', alcance],
      [
        'Generado',
        new Date(r.generadoEn).toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
        }),
      ],
      [
        'Avance de unidades',
        `${r.avance.cerradas} de ${r.avance.total} cerradas`,
      ],
      [
        'Asistencia registrada',
        r.resumen.asistencia == null
          ? 'Sin registros'
          : `${r.resumen.asistencia} %`,
      ],
    ];
    const configuracion = {
      titulo: 'Reporte de calificaciones y asistencia',
      subtitulo: `${r.materia.nombre} · Grupo ${r.grupo.nombre}`,
    };
    const detalle = this.detalle(r);
    const nombre =
      `SICAT_calificaciones_${r.carrera.codigo}_${r.periodo}_${r.grupo.nombre}_${r.materia.clave}_${unidad ? `U${unidad.orden}` : 'acumulado'}`.replace(
        /[^\w.-]+/g,
        '-',
      );
    if (formato === 'excel') {
      const libro = new ExcelJS.Workbook();
      libro.creator = 'SICAT';
      const resumen = libro.addWorksheet('Resumen');
      resumen.columns = [{ width: 32 }, { width: 60 }];
      encabezadoExcel(libro, resumen, configuracion, 2);
      metadatos.forEach((fila) => resumen.addRow(fila));
      resumen.addRow([NOTA]);
      const hoja = libro.addWorksheet('Calificaciones');
      cabeceraExcel(hoja.addRow(detalle.columnas));
      detalle.filas.forEach((fila) =>
        bordesExcel(hoja.addRow(fila), detalle.columnas.length),
      );
      hoja.columns.forEach((c, i) => {
        c.width = i === 0 ? 32 : 18;
      });
      hoja.views = [{ state: 'frozen', ySplit: 1 }];
      hoja.eachRow((row) => {
        row.alignment = { vertical: 'top', wrapText: true };
      });
      const avance = libro.addWorksheet('Avance de unidades');
      cabeceraExcel(avance.addRow(['Unidad', 'Nombre', 'Estado']));
      r.avance.unidades.forEach((u) =>
        avance.addRow([
          u.orden ?? '—',
          u.nombre,
          ESTADO[u.status ?? ''] ?? 'Sin definir',
        ]),
      );
      avance.columns = [{ width: 12 }, { width: 40 }, { width: 20 }];
      return {
        buffer: Buffer.from(await libro.xlsx.writeBuffer()),
        filename: `${nombre}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    const { doc, terminar } = crearPdfInstitucional(configuracion, {
      layout: 'landscape',
    });
    tablaDatos(doc, metadatos);
    // El PDF separa unidades para mantener la lectura aun en cursos con muchas unidades.
    for (const u of r.unidades) {
      tituloSeccion(doc, `Unidad ${u.orden}: ${u.nombre}`);
      tabla(doc, {
        columnas: [
          'Alumno',
          'Control',
          'Sexo',
          'Calificación',
          'Asistencia del alcance',
        ],
        anchos: [32, 16, 7, 20, 25],
        filas: r.filas.map((f) => {
          const n = f.notas.find((n) =>
            u.id != null ? n.unidadId === u.id : n.orden === u.orden,
          )!;
          return [
            f.alumno.nombre,
            f.alumno.numeroControl ?? '—',
            letraSexo(f.alumno.sexo) || '—',
            n.calificacion == null
              ? 'Sin captura'
              : `${n.calificacion}${n.tipo === 'PROVISIONAL' ? ' (P)' : ''}`,
            f.asistencia.porcentaje == null
              ? 'Sin registros'
              : `${f.asistencia.porcentaje} %`,
          ];
        }),
        vacio: 'Sin alumnos inscritos.',
      });
    }
    tituloSeccion(doc, 'Resumen por alumno');
    tabla(doc, {
      columnas: [
        'Alumno',
        'Promedio',
        'Asistencia registrada',
        'Calificaciones pendientes',
      ],
      anchos: [40, 20, 20, 20],
      filas: r.filas.map((f) => [
        f.alumno.nombre,
        f.promedio == null
          ? 'Sin captura'
          : `${f.promedio}${f.provisional ? ' (P)' : ''}`,
        f.asistencia.porcentaje == null
          ? 'Sin registros'
          : `${f.asistencia.porcentaje} %`,
        f.pendientes,
      ]),
      vacio: 'Sin alumnos inscritos.',
    });
    tituloSeccion(doc, 'Avance de unidades de la materia');
    tabla(doc, {
      columnas: ['Unidad', 'Nombre', 'Estado'],
      anchos: [15, 55, 30],
      filas: r.avance.unidades.map((u) => [
        u.orden ?? '—',
        u.nombre,
        ESTADO[u.status ?? ''] ?? 'Sin definir',
      ]),
    });
    const jefe = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true },
    });
    firmas(doc, [
      { cargo: 'Jefe(a) de carrera', nombre: jefe?.nombre ?? null },
    ]);
    observaciones(doc, [`(P): provisional. ${NOTA}`]);
    return {
      buffer: await terminar(),
      filename: `${nombre}.pdf`,
      contentType: 'application/pdf',
    };
  }
}
