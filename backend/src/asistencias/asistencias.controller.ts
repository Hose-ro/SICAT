import {
  Controller, Post, Get, Param, Body, UseGuards, Req,
  ParseIntPipe, Query, UploadedFile, UseInterceptors, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AsistenciasService } from './asistencias.service';
import { ReportesService } from '../reportes/reportes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PasarListaDto } from './dto/pasar-lista.dto';

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
    return this.asistenciasService.pasarLista(req.user.id, dto);
  }

  @Get('sesion/:claseSesionId')
  @Roles('DOCENTE', 'ADMIN')
  listaSesion(@Param('claseSesionId', ParseIntPipe) id: number) {
    return this.asistenciasService.obtenerListaSesion(id);
  }

  @Get('materia/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  resumenMateria(@Param('materiaId', ParseIntPipe) materiaId: number, @Query('unidad') unidad?: string) {
    return this.asistenciasService.obtenerResumenMateria(materiaId, unidad ? parseInt(unidad) : undefined);
  }

  @Get('alumno/:alumnoId/materia/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  asistenciasAlumno(
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Param('materiaId', ParseIntPipe) materiaId: number,
  ) {
    return this.asistenciasService.obtenerAsistenciasAlumno(alumnoId, materiaId);
  }

  @Get('mis-asistencias/:materiaId')
  @Roles('ALUMNO')
  misAsistencias(@Req() req, @Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.asistenciasService.obtenerAsistenciasAlumno(req.user.id, materiaId);
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
    return this.asistenciasService.justificarFalta(id, req.user.id, justificacion, archivo?.filename);
  }

  @Get('reporte/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  datosReporte(@Param('materiaId', ParseIntPipe) materiaId: number, @Query('unidad') unidad?: string) {
    return this.asistenciasService.obtenerDatosReporte(materiaId, unidad ? parseInt(unidad) : undefined);
  }

  @Get('exportar/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  async exportar(
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Query('formato') formato: string = 'excel',
    @Query('unidad') unidad: string,
    @Res() res,
  ) {
    const datos = await this.asistenciasService.obtenerDatosReporte(materiaId, unidad ? parseInt(unidad) : undefined);
    if (formato === 'pdf') {
      const buffer = await this.reportesService.generarPdfAsistencias(datos);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=asistencias.pdf');
      return res.send(buffer);
    }
    const buffer = await this.reportesService.generarExcelAsistencias(datos);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=asistencias.xlsx');
    return res.send(buffer);
  }
}
