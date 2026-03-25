import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AsistenciasService } from './asistencias.service';
import { ReportesService } from '../reportes/reportes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PasarListaDto } from './dto/pasar-lista.dto';
import { ActualizarAsistenciaDto } from './dto/actualizar-asistencia.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asistencias')
export class AsistenciasController {
  constructor(
    private readonly asistenciasService: AsistenciasService,
    private readonly reportesService: ReportesService,
  ) {}

  @Post('pasar-lista')
  @Roles('DOCENTE', 'ADMIN')
  pasarLista(@Req() req, @Body() dto: PasarListaDto) {
    return this.asistenciasService.pasarLista(req.user, dto);
  }

  @Get('sesion/:claseSesionId')
  @Roles('DOCENTE', 'ADMIN')
  listaSesion(@Param('claseSesionId', ParseIntPipe) id: number, @Req() req) {
    return this.asistenciasService.obtenerListaSesion(id, req.user);
  }

  @Get('materia/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  resumenMateria(
    @Req() req,
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Query('unidadId') unidadId?: string,
  ) {
    return this.asistenciasService.obtenerResumenMateria(
      materiaId,
      req.user,
      unidadId ? parseInt(unidadId, 10) : undefined,
    );
  }

  @Get('alumno/:alumnoId/materia/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  asistenciasAlumno(
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Param('materiaId', ParseIntPipe) materiaId: number,
  ) {
    return this.asistenciasService.obtenerAsistenciasAlumno(
      alumnoId,
      materiaId,
    );
  }

  @Get('mis-asistencias/:materiaId')
  @Roles('ALUMNO')
  misAsistencias(
    @Req() req,
    @Param('materiaId', ParseIntPipe) materiaId: number,
  ) {
    return this.asistenciasService.obtenerAsistenciasAlumno(
      req.user.id,
      materiaId,
    );
  }

  @Post(':id/justificar')
  @Roles('ALUMNO')
  @UseInterceptors(FileInterceptor('archivo'))
  justificar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Body('justificacion') justificacion: string,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.asistenciasService.justificarFalta(
      id,
      req.user.id,
      justificacion,
      archivo?.filename,
    );
  }

  @Get('reporte/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  datosReporte(
    @Req() req,
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Query('sesionId') sesionId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('fecha') fecha?: string,
    @Query('semana') semana?: string,
    @Query('unidadId') unidadId?: string,
    @Query('docenteId') docenteId?: string,
  ) {
    return this.asistenciasService.obtenerDatosReporte(req.user, materiaId, {
      sesionId: sesionId ? parseInt(sesionId, 10) : undefined,
      grupoId: grupoId ? parseInt(grupoId, 10) : undefined,
      fecha,
      semana,
      unidadId: unidadId ? parseInt(unidadId, 10) : undefined,
      docenteId: docenteId ? parseInt(docenteId, 10) : undefined,
    });
  }

  @Get('historial')
  @Roles('DOCENTE', 'ADMIN')
  historial(
    @Req() req,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('fecha') fecha?: string,
    @Query('semana') semana?: string,
    @Query('unidadId') unidadId?: string,
    @Query('docenteId') docenteId?: string,
  ) {
    return this.asistenciasService.obtenerHistorial(req.user, {
      materiaId: materiaId ? parseInt(materiaId, 10) : undefined,
      grupoId: grupoId ? parseInt(grupoId, 10) : undefined,
      fecha,
      semana,
      unidadId: unidadId ? parseInt(unidadId, 10) : undefined,
      docenteId: docenteId ? parseInt(docenteId, 10) : undefined,
    });
  }

  @Patch(':id')
  @Roles('DOCENTE', 'ADMIN')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: ActualizarAsistenciaDto,
  ) {
    return this.asistenciasService.actualizarAsistencia(id, req.user, dto);
  }

  @Get('exportar/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  async exportar(
    @Req() req,
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Query('formato') formato: string = 'excel',
    @Query('sesionId') sesionId: string,
    @Query('grupoId') grupoId: string,
    @Query('fecha') fecha: string,
    @Query('semana') semana: string,
    @Query('unidadId') unidadId: string,
    @Query('docenteId') docenteId: string,
    @Res() res,
  ) {
    const datos = await this.asistenciasService.obtenerDatosReporte(
      req.user,
      materiaId,
      {
        formato,
        sesionId: sesionId ? parseInt(sesionId, 10) : undefined,
        grupoId: grupoId ? parseInt(grupoId, 10) : undefined,
        fecha,
        semana,
        unidadId: unidadId ? parseInt(unidadId, 10) : undefined,
        docenteId: docenteId ? parseInt(docenteId, 10) : undefined,
      },
    );
    if (formato === 'pdf') {
      const buffer = await this.reportesService.generarPdfAsistencias(datos);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=asistencias.pdf',
      );
      return res.send(buffer);
    }
    const buffer = await this.reportesService.generarExcelAsistencias(datos);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=asistencias.xlsx',
    );
    return res.send(buffer);
  }
}
