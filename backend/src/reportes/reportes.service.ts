import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { letraSexo } from '../common/sexo';
import { zonaHoraria } from '../common/zona-horaria.util';
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
} from './formato-institucional';

@Injectable()
export class ReportesService {
  async generarExcelAsistencias(datosReporte: {
    materia: any;
    filtros?: any;
    sesiones: any[];
    alumnos: any[];
    asistencias: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Asistencias');

    const { materia, filtros, sesiones, alumnos, asistencias } = datosReporte;

    const totalColumnas = 3 + sesiones.length + 5;
    for (let col = 1; col <= totalColumnas; col++) {
      sheet.getColumn(col).width = col === 3 ? 6 : 14;
    }
    encabezadoExcel(
      workbook,
      sheet,
      { titulo: 'Reporte de asistencias', subtitulo: materia.nombre },
      totalColumnas,
    );

    const info = sheet.addRow([
      `Materia: ${materia.nombre} | Docente: ${materia.docente?.nombre ?? ''}`,
    ]);
    sheet.mergeCells(info.number, 1, info.number, Math.min(totalColumnas, 5));
    info.font = { bold: true, size: 12 };

    const descripcion = this.descripcionFiltros(filtros, ': ');
    if (descripcion) {
      const fila = sheet.addRow([descripcion]);
      sheet.mergeCells(fila.number, 1, fila.number, Math.min(totalColumnas, 5));
      fila.font = { italic: true, size: 11 };
    }

    // Column headers
    const headerRow = sheet.addRow([
      'Alumno',
      'Num. Control',
      'Sexo',
      ...sesiones.map(
        (s) =>
          `${new Date(s.fecha).toLocaleDateString('es-MX', { timeZone: zonaHoraria() })}${s.suspensionMotivo ? ' · Sin clases' : ''}`,
      ),
      'A',
      'F',
      'R',
      'J',
      '%',
    ]);
    cabeceraExcel(headerRow);
    sesiones.forEach((sesion, index) => {
      if (!sesion.suspensionMotivo) return;
      const cell = headerRow.getCell(index + 4);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCE8E8' },
      };
      cell.font = { bold: true, color: { argb: 'FFB91C1C' } };
      cell.note = `Sin clases: ${sesion.suspensionMotivo}`;
    });

    // Build attendance map
    const mapaAsist = new Map<string, string>();
    for (const a of asistencias) {
      mapaAsist.set(`${a.alumnoId}_${a.claseSesionId}`, a.estado);
    }

    const estadoColores: Record<string, string> = {
      ASISTENCIA: 'FF92D050',
      FALTA: 'FFFF0000',
      RETARDO: 'FFFFFF00',
      JUSTIFICADA: 'FF4472C4',
    };

    for (const alumno of alumnos) {
      let a = 0,
        f = 0,
        r = 0,
        j = 0;
      const estados = sesiones.map((s) => {
        const estado = s.suspensionMotivo
          ? ''
          : (mapaAsist.get(`${alumno.id}_${s.id}`) ?? '');
        if (estado === 'ASISTENCIA') a++;
        else if (estado === 'FALTA') f++;
        else if (estado === 'RETARDO') r++;
        else if (estado === 'JUSTIFICADA') j++;
        return estado;
      });

      const total = a + f + r + j;
      const pct = total > 0 ? Math.round((a / total) * 100) : 0;
      const row = sheet.addRow([
        alumno.nombre,
        alumno.numeroControl ?? '',
        letraSexo(alumno.sexo),
        ...estados,
        a,
        f,
        r,
        j,
        `${pct}%`,
      ]);
      bordesExcel(row, totalColumnas);

      // Color cells by attendance state
      estados.forEach((estado, idx) => {
        const cell = row.getCell(4 + idx);
        cell.value = sesiones[idx].suspensionMotivo
          ? 'SC'
          : estado.charAt(0) || '';
        if (sesiones[idx].suspensionMotivo) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFCE8E8' },
          };
          return;
        }
        if (estadoColores[estado]) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: estadoColores[estado] },
          };
        }
      });
    }

    // Totals row
    const totalRow = sheet.addRow([
      'TOTALES',
      '',
      '',
      ...sesiones.map(() => ''),
    ]);
    totalRow.font = { bold: true };

    const suspendidas = sesiones.filter((sesion) => sesion.suspensionMotivo);
    if (suspendidas.length) {
      sheet.addRow([]);
      sheet.addRow(['Días sin clases', 'Motivo']);
      suspendidas.forEach((sesion) =>
        sheet.addRow([
          new Date(sesion.fecha).toLocaleDateString('es-MX', {
            timeZone: zonaHoraria(),
          }),
          sesion.suspensionMotivo,
        ]),
      );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarPdfAsistencias(datosReporte: {
    materia: any;
    filtros?: any;
    sesiones: any[];
    alumnos: any[];
    asistencias: any[];
  }): Promise<Buffer> {
    const { materia, filtros, sesiones, alumnos, asistencias } = datosReporte;
    const { doc, terminar } = crearPdfInstitucional(
      { titulo: 'Reporte de asistencias', subtitulo: materia.nombre },
      { layout: 'landscape' },
    );

    const descripcion = this.descripcionFiltros(filtros, ' ');
    tablaDatos(doc, [
      ['Materia', materia.nombre],
      ['Docente', materia.docente?.nombre ?? ''],
      ...(descripcion ? [['Filtro', descripcion] as const] : []),
    ]);

    const mapaAsist = new Map<string, string>();
    for (const a of asistencias) {
      mapaAsist.set(`${a.alumnoId}_${a.claseSesionId}`, a.estado);
    }

    const visibles = sesiones.slice(0, 10);
    const rojo = '#B91C1C';
    tituloSeccion(doc, 'Registro de asistencia');
    tabla(doc, {
      columnas: [
        'Alumno',
        'Sexo',
        ...visibles.map((s) =>
          new Date(s.fecha).toLocaleDateString('es-MX', {
            timeZone: zonaHoraria(),
            month: '2-digit',
            day: '2-digit',
          }),
        ),
      ],
      anchos: [150, 30, ...visibles.map(() => 45)],
      alinear: ['left', 'center', ...visibles.map(() => 'center' as const)],
      tamano: 8,
      vacio: 'Sin alumnos en el padrón.',
      filas: alumnos.map((alumno) => [
        alumno.nombre,
        letraSexo(alumno.sexo) || '-',
        ...visibles.map((s) => {
          if (s.suspensionMotivo) return { texto: 'SC', color: rojo };
          const estado = mapaAsist.get(`${alumno.id}_${s.id}`);
          return (
            { ASISTENCIA: 'A', FALTA: 'F', RETARDO: 'R', JUSTIFICADA: 'J' }[
              estado ?? ''
            ] ?? '-'
          );
        }),
      ]),
    });

    firmas(doc, [{ cargo: 'Docente', nombre: materia.docente?.nombre }]);

    const suspendidas = sesiones.filter((sesion) => sesion.suspensionMotivo);
    observaciones(doc, [
      'A: asistencia · F: falta · R: retardo · J: justificada · SC: sin clases.',
      ...suspendidas.map(
        (sesion) =>
          `Sin clases el ${new Date(sesion.fecha).toLocaleDateString('es-MX', { timeZone: zonaHoraria() })}: ${sesion.suspensionMotivo}.`,
      ),
      sesiones.length > visibles.length
        ? `Se muestran las primeras ${visibles.length} de ${sesiones.length} sesiones; el Excel trae todas.`
        : '',
    ]);

    return terminar();
  }

  /** "Grupo 3 | Fecha 2026-09-18" a partir de los filtros del reporte. */
  private descripcionFiltros(filtros: any, separador: string) {
    if (!filtros) return '';
    return [
      filtros.grupoId ? `Grupo${separador}${filtros.grupoId}` : null,
      filtros.fecha ? `Fecha${separador}${filtros.fecha}` : null,
      filtros.semana ? `Semana${separador}${filtros.semana}` : null,
      filtros.mes ? `Mes${separador}${filtros.mes}` : null,
      filtros.unidadId ? `Unidad${separador}${filtros.unidadId}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
  }

  async generarExcelTareas(
    materia: any,
    tareas: any[],
    entregas: any[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tareas');

    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = `Reporte de Tareas: ${materia.nombre}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    const headerRow = sheet.addRow([
      'Alumno',
      'Num. Control',
      'Sexo',
      ...tareas.map((t) => t.titulo),
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };

    const mapaEntregas = new Map<string, any>();
    for (const e of entregas) {
      mapaEntregas.set(`${e.alumnoId}_${e.tareaId}`, e);
    }

    const alumnos = [
      ...new Map(entregas.map((e) => [e.alumnoId, e.alumno])).values(),
    ];
    for (const alumno of alumnos) {
      const celdas = tareas.map((t) => {
        const entrega = mapaEntregas.get(`${alumno.id}_${t.id}`);
        if (!entrega) return '-';
        return entrega.calificacion != null
          ? entrega.calificacion
          : entrega.estadoRevision;
      });
      sheet.addRow([
        alumno.nombre,
        alumno.numeroControl ?? '',
        letraSexo(alumno.sexo),
        ...celdas,
      ]);
    }

    sheet.columns.forEach((col) => {
      col.width = 16;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarExcelReporteTareas(reporte: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const resumen = workbook.addWorksheet('Resumen');
    const alumnos = workbook.addWorksheet('Alumnos');
    const matriz = workbook.addWorksheet('Matriz');

    for (let col = 1; col <= 12; col++) resumen.getColumn(col).width = 18;
    encabezadoExcel(workbook, resumen, { titulo: 'Reporte de tareas' }, 12);
    resumen.addRow([
      'Generado en',
      new Date(reporte.generatedAt).toLocaleString('es-MX', {
        timeZone: zonaHoraria(),
      }),
    ]);
    resumen.addRow([
      'Porcentaje de entrega',
      `${reporte.metrics?.porcentajeEntrega ?? 0}%`,
    ]);
    resumen.addRow(['Tareas vencidas', reporte.metrics?.tareasVencidas ?? 0]);
    resumen.addRow(['Entregas tardías', reporte.metrics?.entregasTardias ?? 0]);
    resumen.addRow([
      'Pendientes de revisión',
      reporte.metrics?.pendientesRevision ?? 0,
    ]);

    resumen.addRow([]);
    const taskHeader = resumen.addRow([
      'Tarea',
      'Materia',
      'Grupo',
      'Unidad',
      'Estado',
      '% Entrega',
      'Entregadas',
      'No entregadas',
      'Tardías',
      'Pendientes',
      'Promedio',
      'Fecha límite',
    ]);
    cabeceraExcel(taskHeader);

    for (const task of reporte.tasks ?? []) {
      const fila = resumen.addRow([
        task.titulo,
        task.materia?.nombre ?? '',
        task.grupo?.nombre ?? '',
        task.unidadRef?.nombre ??
          (task.unidad ? `Unidad ${task.unidad}` : 'Sin unidad'),
        task.estado,
        `${task.porcentajeEntrega ?? 0}%`,
        task.entregadas ?? 0,
        task.noEntregadas ?? 0,
        task.entregasTardias ?? 0,
        task.pendientesRevision ?? 0,
        task.promedio ?? '',
        task.fechaLimite
          ? new Date(task.fechaLimite).toLocaleString('es-MX', {
              timeZone: zonaHoraria(),
            })
          : 'Sin límite',
      ]);
      bordesExcel(fila, 12);
    }

    const studentHeader = alumnos.addRow([
      'Alumno',
      'No. control',
      'Sexo',
      'Pendientes',
      'Entregadas',
      'Tardías',
      'Promedio',
    ]);
    studentHeader.font = { bold: true };
    studentHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5E8D5' },
    };
    for (const student of reporte.students ?? []) {
      alumnos.addRow([
        student.nombre,
        student.numeroControl ?? '',
        letraSexo(student.sexo),
        student.pendientes ?? 0,
        student.entregadas ?? 0,
        student.tardias ?? 0,
        student.promedio ?? '',
      ]);
    }
    alumnos.columns.forEach((column) => {
      column.width = 18;
    });

    const taskColumns = [
      'Alumno',
      'No. control',
      'Sexo',
      ...(reporte.tasks ?? []).map((task) => task.titulo),
    ];
    const matrixHeader = matriz.addRow(taskColumns);
    matrixHeader.font = { bold: true };
    matrixHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDDEBF7' },
    };
    for (const student of reporte.students ?? []) {
      const byTask = new Map(
        (student.tasks ?? []).map((task) => [task.tareaId, task]),
      );
      const row = (reporte.tasks ?? []).map((task) => {
        const status: any = byTask.get(task.id);
        if (!status) return '-';
        if (typeof status.calificacion === 'number') return status.calificacion;
        return status.estado;
      });
      matriz.addRow([
        student.nombre,
        student.numeroControl ?? '',
        letraSexo(student.sexo),
        ...row,
      ]);
    }
    matriz.columns.forEach((column) => {
      column.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarPdfReporteTareas(reporte: any): Promise<Buffer> {
    const tareas: any[] = reporte.tasks ?? [];
    const materias = [
      ...new Set(tareas.map((task) => task.materia?.nombre).filter(Boolean)),
    ];
    const { doc, terminar } = crearPdfInstitucional({
      titulo: 'Reporte de tareas',
      subtitulo: materias.length === 1 ? materias[0] : undefined,
    });

    tablaDatos(doc, [
      [
        'Generado',
        new Date(reporte.generatedAt).toLocaleString('es-MX', {
          timeZone: zonaHoraria(),
        }),
      ],
      ['Porcentaje de entrega', `${reporte.metrics?.porcentajeEntrega ?? 0}%`],
      ['Tareas vencidas', String(reporte.metrics?.tareasVencidas ?? 0)],
      ['Entregas tardías', String(reporte.metrics?.entregasTardias ?? 0)],
      [
        'Pendientes de revisión',
        String(reporte.metrics?.pendientesRevision ?? 0),
      ],
    ]);

    tituloSeccion(doc, 'Tareas');
    tabla(doc, {
      columnas: [
        'Tarea',
        'Materia / grupo',
        'Unidad',
        'Estado',
        'Entrega',
        'Tardías',
        'Promedio',
      ],
      anchos: [30, 24, 14, 12, 9, 9, 10],
      alinear: ['left', 'left', 'left', 'left', 'center', 'center', 'center'],
      tamano: 8,
      vacio: 'Sin tareas con los filtros elegidos.',
      filas: tareas.map((task) => [
        task.titulo,
        [task.materia?.nombre, task.grupo?.nombre].filter(Boolean).join(' · '),
        task.unidadRef?.nombre ??
          (task.unidad ? `Unidad ${task.unidad}` : 'Sin unidad'),
        task.estado ?? '',
        `${task.porcentajeEntrega ?? 0}%`,
        task.entregasTardias ?? 0,
        task.promedio ?? '-',
      ]),
    });

    tituloSeccion(doc, 'Alumnos con más pendientes');
    tabla(doc, {
      columnas: [
        'Alumno',
        'No. control',
        'Sexo',
        'Pendientes',
        'Tardías',
        'Promedio',
      ],
      anchos: [40, 18, 8, 12, 10, 12],
      alinear: ['left', 'left', 'center', 'center', 'center', 'center'],
      tamano: 8,
      vacio: 'Sin alumnos con tareas pendientes.',
      filas: (reporte.alumnosConMasPendientes ?? [])
        .slice(0, 20)
        .map((student) => [
          student.nombre,
          student.numeroControl ?? '-',
          letraSexo(student.sexo) || '-',
          student.pendientes ?? 0,
          student.tardias ?? 0,
          student.promedio ?? '-',
        ]),
    });

    return terminar();
  }

  async generarExcelCalificacionesCaptura(reporte: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const captura = workbook.addWorksheet('Captura');
    const respaldo = workbook.addWorksheet('Respaldo SICAT');

    captura.views = [{ state: 'frozen', ySplit: 1 }];
    const capturaHeader = captura.addRow([
      'No. control',
      'Alumno',
      'Sexo',
      'Calificacion',
      'Unidad',
      'Estado',
    ]);
    capturaHeader.font = { bold: true };
    capturaHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDDEBF7' },
    };

    for (const row of reporte.rows ?? []) {
      captura.addRow([
        row.alumno?.numeroControl ?? '',
        row.alumno?.nombre ?? '',
        letraSexo(row.alumno?.sexo),
        this.valorCalificacion(this.obtenerCalificacionFinal(row)),
        row.unidad?.nombre ?? '',
        this.estadoCalificacionLabel(row.estado),
      ]);
    }

    captura.columns = [
      { width: 18 },
      { width: 34 },
      { width: 8 },
      { width: 18 },
      { width: 16 },
      { width: 20 },
    ];
    captura.autoFilter = 'A1:F1';

    respaldo.mergeCells('A1:U1');
    respaldo.getCell('A1').value = 'Calificaciones para captura';
    respaldo.getCell('A1').font = { bold: true, size: 16 };
    respaldo.addRow([
      'Materia',
      `${reporte.materia?.clave ?? ''} ${reporte.materia?.nombre ?? ''}`.trim(),
    ]);
    respaldo.addRow(['Docente', reporte.materia?.docente?.nombre ?? '']);
    respaldo.addRow([
      'Grupo',
      reporte.grupoSeleccionado?.nombre ?? 'Todos los grupos',
    ]);
    respaldo.addRow([
      'Unidad',
      reporte.unidadSeleccionada?.nombre ?? 'Todas las unidades',
    ]);
    respaldo.addRow([
      'Generado',
      new Date(reporte.generatedAt).toLocaleString('es-MX', {
        timeZone: zonaHoraria(),
      }),
    ]);
    respaldo.addRow([]);

    const respaldoHeader = respaldo.addRow([
      'No. control',
      'Alumno',
      'Sexo',
      'Grupo',
      'Unidad',
      'Calificacion final',
      'Manual',
      'Calculada',
      'Origen',
      'Promedio tareas',
      'Estado',
      'Tareas calificadas',
      'Tareas entregadas',
      'Total tareas',
      'Asistencia %',
      'Asistencias',
      'Faltas',
      'Retardos',
      'Justificadas',
      'Sin registro',
      'Observaciones',
    ]);
    respaldoHeader.font = { bold: true };
    respaldoHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7EEF8' },
    };

    for (const row of reporte.rows ?? []) {
      respaldo.addRow([
        row.alumno?.numeroControl ?? '',
        row.alumno?.nombre ?? '',
        letraSexo(row.alumno?.sexo),
        row.grupo?.nombre ?? '',
        row.unidad?.nombre ?? '',
        this.valorCalificacion(this.obtenerCalificacionFinal(row)),
        this.valorCalificacion(row.calificacionManual),
        this.valorCalificacion(row.calificacionCalculada),
        this.origenCalificacionLabel(row.fuenteCalificacion),
        this.valorCalificacion(row.promedioTareas),
        this.estadoCalificacionLabel(row.estado),
        row.tareas?.calificadas ?? 0,
        row.tareas?.entregadas ?? 0,
        row.tareas?.total ?? 0,
        `${row.asistencia?.porcentaje ?? 0}%`,
        row.asistencia?.asistencias ?? 0,
        row.asistencia?.faltas ?? 0,
        row.asistencia?.retardos ?? 0,
        row.asistencia?.justificadas ?? 0,
        row.asistencia?.sinRegistro ?? 0,
        (row.observaciones ?? []).join(' | '),
      ]);
    }

    respaldo.columns.forEach((column) => {
      column.width = 18;
    });
    respaldo.getColumn(2).width = 34;
    respaldo.getColumn(3).width = 8;
    respaldo.getColumn(21).width = 42;
    respaldo.autoFilter = 'A8:U8';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarCsvCalificacionesCaptura(reporte: any): Promise<Buffer> {
    const rows = [
      ['No. control', 'Alumno', 'Sexo', 'Calificacion', 'Unidad', 'Estado'],
      ...(reporte.rows ?? []).map((row) => [
        row.alumno?.numeroControl ?? '',
        row.alumno?.nombre ?? '',
        letraSexo(row.alumno?.sexo),
        this.valorCalificacion(this.obtenerCalificacionFinal(row)),
        row.unidad?.nombre ?? '',
        this.estadoCalificacionLabel(row.estado),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => this.csvCell(cell)).join(','))
      .join('\n');
    return Buffer.from(`\uFEFF${csv}`, 'utf8');
  }

  private valorCalificacion(value: unknown) {
    return typeof value === 'number' ? value : '';
  }

  private obtenerCalificacionFinal(row: any) {
    return row.calificacionFinal ?? row.calificacionSugerida;
  }

  private origenCalificacionLabel(origen?: string) {
    if (origen === 'MANUAL') return 'Manual';
    if (origen === 'CALCULADA') return 'Calculada';
    return 'Pendiente';
  }

  private estadoCalificacionLabel(estado?: string) {
    if (estado === 'APROBADO') return 'Aprobado';
    if (estado === 'REQUIERE_ATENCION') return 'Requiere atencion';
    return 'Pendiente';
  }

  private csvCell(value: unknown) {
    const text = String(value ?? '');
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
  }
}
