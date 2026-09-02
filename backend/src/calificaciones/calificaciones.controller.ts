import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportesService } from '../reportes/reportes.service';
import { CalificacionesService } from './calificaciones.service';
import { GuardarCalificacionManualDto } from './dto/guardar-calificacion-manual.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calificaciones')
export class CalificacionesController {
  constructor(
    private readonly calificacionesService: CalificacionesService,
    private readonly reportesService: ReportesService,
  ) {}

  @Get('docente')
  @Roles('DOCENTE', 'ADMIN')
  docente(
    @Req() req,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('docenteId') docenteId?: string,
    @Query('pesoTareas') pesoTareas?: string,
    @Query('pesoAsistencia') pesoAsistencia?: string,
  ) {
    if (!materiaId) {
      throw new BadRequestException('La materia es obligatoria');
    }

    return this.calificacionesService.obtenerReporteDocente(req.user, {
      materiaId: Number(materiaId),
      grupoId: grupoId ? Number(grupoId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
      docenteId: docenteId ? Number(docenteId) : undefined,
      pesoTareas: pesoTareas ? Number(pesoTareas) : undefined,
      pesoAsistencia: pesoAsistencia ? Number(pesoAsistencia) : undefined,
    });
  }

  @Get('alumno')
  @Roles('ALUMNO')
  alumno(
    @Req() req,
    @Query('materiaId') materiaId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('pesoTareas') pesoTareas?: string,
    @Query('pesoAsistencia') pesoAsistencia?: string,
  ) {
    return this.calificacionesService.obtenerReporteAlumno(req.user.id, {
      materiaId: materiaId ? Number(materiaId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
      pesoTareas: pesoTareas ? Number(pesoTareas) : undefined,
      pesoAsistencia: pesoAsistencia ? Number(pesoAsistencia) : undefined,
    });
  }

  @Patch('manual')
  @Roles('DOCENTE', 'ADMIN')
  guardarManual(
    @Req() req,
    @Body() dto: GuardarCalificacionManualDto,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('pesoTareas') pesoTareas?: string,
    @Query('pesoAsistencia') pesoAsistencia?: string,
  ) {
    return this.calificacionesService.guardarManual(req.user, dto, {
      grupoId: grupoId ? Number(grupoId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
      pesoTareas: pesoTareas ? Number(pesoTareas) : undefined,
      pesoAsistencia: pesoAsistencia ? Number(pesoAsistencia) : undefined,
    });
  }

  @Get('exportar')
  @Roles('DOCENTE', 'ADMIN')
  async exportar(
    @Req() req,
    @Res() res,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('docenteId') docenteId?: string,
    @Query('pesoTareas') pesoTareas?: string,
    @Query('pesoAsistencia') pesoAsistencia?: string,
    @Query('formato') formato = 'excel',
  ) {
    if (!materiaId) {
      throw new BadRequestException('La materia es obligatoria');
    }

    const reporte = await this.calificacionesService.obtenerReporteDocente(
      req.user,
      {
        materiaId: Number(materiaId),
        grupoId: grupoId ? Number(grupoId) : undefined,
        unidadId: unidadId ? Number(unidadId) : undefined,
        docenteId: docenteId ? Number(docenteId) : undefined,
        pesoTareas: pesoTareas ? Number(pesoTareas) : undefined,
        pesoAsistencia: pesoAsistencia ? Number(pesoAsistencia) : undefined,
      },
    );

    const suffix = [
      reporte.materia?.clave ?? `materia-${materiaId}`,
      reporte.unidadSeleccionada?.orden
        ? `unidad-${reporte.unidadSeleccionada.orden}`
        : 'unidades',
      reporte.grupoSeleccionado?.nombre
        ? reporte.grupoSeleccionado.nombre.replace(/\s+/g, '-')
        : null,
    ]
      .filter(Boolean)
      .join('-')
      .toLowerCase();

    if (formato === 'csv') {
      const buffer =
        await this.reportesService.generarCsvCalificacionesCaptura(reporte);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=calificaciones-captura-${suffix}.csv`,
      );
      return res.send(buffer);
    }

    const buffer =
      await this.reportesService.generarExcelCalificacionesCaptura(reporte);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=calificaciones-captura-${suffix}.xlsx`,
    );
    return res.send(buffer);
  }
}
