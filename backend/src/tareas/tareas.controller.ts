import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { TareasService } from './tareas.service';
import { ReportesService } from '../reportes/reportes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CrearTareaDto } from './dto/crear-tarea.dto';
import { EntregarTareaDto } from './dto/entregar-tarea.dto';
import { RevisarEntregaDto } from './dto/revisar-entrega.dto';
import { CalificarEntregaDto } from './dto/calificar-entrega.dto';
import { DevolverEntregaDto } from './dto/devolver-entrega.dto';
import { BulkRevisarEntregasDto } from './dto/bulk-revisar-entregas.dto';
import { buildZipArchive } from './tareas.archive';
import {
  collectUploadedFiles,
  getUploadAbsolutePath,
  tareasUploadOptions,
} from './tareas.storage';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tareas')
export class TareasController {
  constructor(
    private readonly tareasService: TareasService,
    private readonly reportesService: ReportesService,
  ) {}

  @Post()
  @Roles('DOCENTE', 'ADMIN')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'archivos', maxCount: 12 },
        { name: 'archivo', maxCount: 12 },
        { name: 'firma', maxCount: 12 },
      ],
      tareasUploadOptions,
    ),
  )
  crear(
    @Req() req,
    @Body() dto: CrearTareaDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    return this.tareasService.crear(
      req.user.id,
      dto,
      collectUploadedFiles(files),
      req.user.rol,
    );
  }

  @Get('docente')
  @Roles('DOCENTE', 'ADMIN')
  listarDocente(
    @Req() req,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('estado') estado?: any,
    @Query('fecha') fecha?: string,
    @Query('alumnoId') alumnoId?: string,
    @Query('docenteId') docenteId?: string,
  ) {
    return this.tareasService.listarDocente(req.user, {
      materiaId: materiaId ? Number(materiaId) : undefined,
      grupoId: grupoId ? Number(grupoId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
      estado,
      fecha,
      alumnoId: alumnoId ? Number(alumnoId) : undefined,
      docenteId: docenteId ? Number(docenteId) : undefined,
    });
  }

  @Get('mis-tareas')
  @Roles('ALUMNO')
  misTareas(@Req() req, @Query('materiaId') materiaId?: string) {
    return this.tareasService.obtenerMisTareas(
      req.user.id,
      materiaId ? Number(materiaId) : undefined,
    );
  }

  @Get('mis-tareas/:materiaId')
  @Roles('ALUMNO')
  misTareasPorMateria(
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Req() req,
  ) {
    return this.tareasService.obtenerMisTareas(req.user.id, materiaId);
  }

  @Get('materia/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  porMateria(@Param('materiaId', ParseIntPipe) materiaId: number, @Req() req) {
    return this.tareasService.obtenerPorMateria(
      materiaId,
      req.user.id,
      req.user.rol,
    );
  }

  @Get('reporte/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  resumenMateria(
    @Req() req,
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Query('unidadId') unidadId?: string,
  ) {
    return this.tareasService.obtenerResumenMateria(
      materiaId,
      req.user,
      unidadId ? parseInt(unidadId, 10) : undefined,
    );
  }

  @Get('reportes')
  @Roles('DOCENTE', 'ADMIN')
  reporte(
    @Req() req,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('alumnoId') alumnoId?: string,
    @Query('estado') estado?: any,
    @Query('fecha') fecha?: string,
    @Query('docenteId') docenteId?: string,
  ) {
    return this.tareasService.obtenerDatosReporteDocente(req.user, {
      materiaId: materiaId ? Number(materiaId) : undefined,
      grupoId: grupoId ? Number(grupoId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
      alumnoId: alumnoId ? Number(alumnoId) : undefined,
      estado,
      fecha,
      docenteId: docenteId ? Number(docenteId) : undefined,
    });
  }

  @Get('exportar')
  @Roles('DOCENTE', 'ADMIN')
  async exportar(
    @Req() req,
    @Res() res,
    @Query('formato') formato = 'excel',
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('alumnoId') alumnoId?: string,
    @Query('estado') estado?: any,
    @Query('fecha') fecha?: string,
    @Query('docenteId') docenteId?: string,
  ) {
    const reporte = await this.tareasService.obtenerDatosReporteDocente(
      req.user,
      {
        materiaId: materiaId ? Number(materiaId) : undefined,
        grupoId: grupoId ? Number(grupoId) : undefined,
        unidadId: unidadId ? Number(unidadId) : undefined,
        alumnoId: alumnoId ? Number(alumnoId) : undefined,
        estado,
        fecha,
        docenteId: docenteId ? Number(docenteId) : undefined,
      },
    );

    if (formato === 'pdf') {
      const buffer =
        await this.reportesService.generarPdfReporteTareas(reporte);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=tareas.pdf');
      return res.send(buffer);
    }

    const buffer =
      await this.reportesService.generarExcelReporteTareas(reporte);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=tareas.xlsx');
    return res.send(buffer);
  }

  @Get('unidad/:unidadId/descargar')
  @Roles('DOCENTE', 'ADMIN')
  async descargarCierreUnidad(
    @Req() req,
    @Param('unidadId', ParseIntPipe) unidadId: number,
    @Res() res,
  ) {
    const cierre = await this.tareasService.obtenerDatosCierreUnidad(
      req.user,
      unidadId,
    );
    const excel = await this.reportesService.generarExcelReporteTareas(
      cierre.reporte,
    );
    const pdf = await this.reportesService.generarPdfReporteTareas(
      cierre.reporte,
    );

    const entries = [
      { name: 'resumen/reporte.xlsx', data: excel },
      { name: 'resumen/reporte.pdf', data: pdf },
      {
        name: 'resumen/datos.json',
        data: JSON.stringify(cierre.reporte, null, 2),
      },
      ...cierre.evidencias.map((archivo) => ({
        name: `evidencias/${archivo.entrega.tarea.titulo}/${archivo.entrega.alumno.nombre}/${archivo.nombre}`,
        path: getUploadAbsolutePath(archivo.url.split('/').pop() ?? ''),
      })),
    ];

    const buffer = await buildZipArchive(entries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=cierre-unidad-${unidadId}.zip`,
    );
    return res.send(buffer);
  }

  @Patch('entregas/masivo/revisar')
  @Roles('DOCENTE', 'ADMIN')
  revisarMasivo(
    @Req() req,
    @Body() dto: BulkRevisarEntregasDto,
    @Query('tareaId', ParseIntPipe) tareaId: number,
  ) {
    return this.tareasService.revisarMasivo(
      tareaId,
      req.user.id,
      dto,
      req.user.rol,
    );
  }

  @Patch('entregas/:entregaId/revisar')
  @Roles('DOCENTE', 'ADMIN')
  revisar(
    @Param('entregaId', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: RevisarEntregaDto,
  ) {
    return this.tareasService.revisar(id, req.user.id, dto, req.user.rol);
  }

  @Patch('entregas/:entregaId/calificar')
  @Roles('DOCENTE', 'ADMIN')
  calificar(
    @Param('entregaId', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: CalificarEntregaDto,
  ) {
    return this.tareasService.calificar(id, req.user.id, dto, req.user.rol);
  }

  @Patch('entregas/:entregaId/incorrecta')
  @Roles('DOCENTE', 'ADMIN')
  marcarIncorrecta(
    @Param('entregaId', ParseIntPipe) id: number,
    @Req() req,
    @Body('observacion') observacion: string,
  ) {
    return this.tareasService.marcarIncorrecta(
      id,
      req.user.id,
      observacion,
      req.user.rol,
    );
  }

  @Patch('entregas/:entregaId/devolver')
  @Roles('DOCENTE', 'ADMIN')
  devolver(
    @Param('entregaId', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: DevolverEntregaDto,
  ) {
    return this.tareasService.devolverParaCorreccion(
      id,
      req.user.id,
      dto,
      req.user.rol,
    );
  }

  @Get(':id/exportar')
  @Roles('DOCENTE', 'ADMIN')
  async exportarTarea(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato = 'excel',
    @Res() res,
  ) {
    const reporte = await this.tareasService.obtenerDatosReporteTarea(
      req.user,
      id,
    );
    if (formato === 'pdf') {
      const buffer =
        await this.reportesService.generarPdfReporteTareas(reporte);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=tarea-${id}.pdf`,
      );
      return res.send(buffer);
    }

    const buffer =
      await this.reportesService.generarExcelReporteTareas(reporte);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=tarea-${id}.xlsx`,
    );
    return res.send(buffer);
  }

  @Post(':id/descargar-entregas')
  @Roles('DOCENTE', 'ADMIN')
  async descargarEntregas(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body('entregaIds') entregaIds: number[] | undefined,
    @Res() res,
  ) {
    const { entregas, tarea } = await this.tareasService.obtenerEntregas(
      id,
      req.user,
    );
    const selectedIds = Array.isArray(entregaIds)
      ? entregaIds.map((item) => Number(item))
      : [];
    const seleccionadas = selectedIds.length
      ? entregas.filter(
          (item) =>
            !item.esSintetica &&
            typeof item.id === 'number' &&
            selectedIds.includes(item.id),
        )
      : entregas.filter((item) => !item.esSintetica);

    const entries = [
      {
        name: 'resumen/seleccion.json',
        data: JSON.stringify(
          {
            tarea: { id: tarea.id, titulo: tarea.titulo },
            entregas: seleccionadas.map((item) => ({
              id: item.id,
              alumno: item.alumno,
              estado: item.estadoRevision,
              fechaEntrega: item.fechaEntrega,
              fueTardia: item.fueTardia,
            })),
          },
          null,
          2,
        ),
      },
      ...seleccionadas.flatMap((entrega) =>
        entrega.archivos.map((archivo) => ({
          name: `entregas/${entrega.alumno.nombre}/${archivo.nombre}`,
          path: getUploadAbsolutePath(archivo.url.split('/').pop() ?? ''),
        })),
      ),
    ];

    const buffer = await buildZipArchive(entries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=tarea-${id}-evidencias.zip`,
    );
    return res.send(buffer);
  }

  @Get('entregas/:entregaId')
  @Roles('DOCENTE', 'ADMIN')
  obtenerEntregasLegado(
    @Param('entregaId', ParseIntPipe) tareaId: number,
    @Req() req,
  ) {
    return this.tareasService.obtenerEntregas(tareaId, req.user);
  }

  @Patch(':id/publicar')
  @Roles('DOCENTE', 'ADMIN')
  publicar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.tareasService.publicar(id, req.user);
  }

  @Patch(':id/cerrar')
  @Roles('DOCENTE', 'ADMIN')
  cerrar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.tareasService.cerrar(id, req.user);
  }

  @Patch(':id/reabrir')
  @Roles('DOCENTE', 'ADMIN')
  reabrir(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.tareasService.reabrir(id, req.user);
  }

  @Patch(':id')
  @Roles('DOCENTE', 'ADMIN')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'archivos', maxCount: 12 },
        { name: 'archivo', maxCount: 12 },
        { name: 'firma', maxCount: 12 },
      ],
      tareasUploadOptions,
    ),
  )
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: Partial<CrearTareaDto>,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    return this.tareasService.editar(
      id,
      req.user.id,
      dto,
      collectUploadedFiles(files),
      req.user.rol,
    );
  }

  @Delete(':id')
  @Roles('DOCENTE', 'ADMIN')
  desactivar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.tareasService.desactivar(id, req.user.id, req.user.rol);
  }

  @Post(':id/entregar')
  @Roles('ALUMNO')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'archivos', maxCount: 12 },
        { name: 'archivo', maxCount: 12 },
        { name: 'firma', maxCount: 12 },
      ],
      tareasUploadOptions,
    ),
  )
  entregar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: EntregarTareaDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    return this.tareasService.entregar(
      id,
      req.user.id,
      dto,
      collectUploadedFiles(files),
    );
  }

  @Patch(':id/mi-entrega')
  @Roles('ALUMNO')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'archivos', maxCount: 12 },
        { name: 'archivo', maxCount: 12 },
        { name: 'firma', maxCount: 12 },
      ],
      tareasUploadOptions,
    ),
  )
  editarMiEntrega(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: EntregarTareaDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    return this.tareasService.editarEntrega(
      id,
      req.user.id,
      dto,
      collectUploadedFiles(files),
    );
  }

  @Post(':tareaId/marcar-entrega-presencial')
  @Roles('DOCENTE', 'ADMIN')
  marcarPresencial(
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @Req() req,
    @Body('alumnoId', ParseIntPipe) alumnoId: number,
  ) {
    return this.tareasService.marcarEntregaPresencial(
      tareaId,
      req.user.id,
      alumnoId,
      req.user.rol,
    );
  }

  @Get(':id/entregas')
  @Roles('DOCENTE', 'ADMIN')
  entregas(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Query('estado') estado?: string,
    @Query('tardia') tardia?: string,
    @Query('q') q?: string,
  ) {
    return this.tareasService.obtenerEntregas(id, req.user, {
      estado,
      tardia: tardia ? ['true', '1'].includes(tardia) : false,
      q,
    });
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.tareasService.obtenerDetalle(id, req.user);
  }
}
