import {
  Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Req,
  ParseIntPipe, Query, UploadedFile, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { TareasService } from './tareas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CrearTareaDto } from './dto/crear-tarea.dto';
import { EntregarTareaDto } from './dto/entregar-tarea.dto';
import { RevisarEntregaDto } from './dto/revisar-entrega.dto';
import { CalificarEntregaDto } from './dto/calificar-entrega.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tareas')
export class TareasController {
  constructor(private readonly tareasService: TareasService) {}

  @Post()
  @Roles('DOCENTE', 'ADMIN')
  @UseInterceptors(FileInterceptor('archivo'))
  crear(@Req() req, @Body() dto: CrearTareaDto, @UploadedFile() archivo?: Express.Multer.File) {
    return this.tareasService.crear(req.user.id, dto, archivo?.filename);
  }

  @Get('materia/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  porMateria(@Param('materiaId', ParseIntPipe) materiaId: number, @Req() req) {
    return this.tareasService.obtenerPorMateria(materiaId, req.user.id);
  }

  @Get('mis-tareas/:materiaId')
  @Roles('ALUMNO')
  misTareas(@Param('materiaId', ParseIntPipe) materiaId: number, @Req() req) {
    return this.tareasService.obtenerMisTareas(req.user.id, materiaId);
  }

  @Get('reporte/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  resumenMateria(@Param('materiaId', ParseIntPipe) materiaId: number, @Query('unidad') unidad?: string) {
    return this.tareasService.obtenerResumenMateria(materiaId, unidad ? parseInt(unidad) : undefined);
  }

  @Get('entregas/:entregaId')
  @Roles('DOCENTE', 'ADMIN')
  obtenerEntregas(@Param('entregaId', ParseIntPipe) tareaId: number, @Req() req) {
    return this.tareasService.obtenerEntregas(tareaId, req.user.id);
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.tareasService.obtenerDetalle(id);
  }

  @Patch(':id')
  @Roles('DOCENTE', 'ADMIN')
  editar(@Param('id', ParseIntPipe) id: number, @Req() req, @Body() dto: Partial<CrearTareaDto>) {
    return this.tareasService.editar(id, req.user.id, dto);
  }

  @Delete(':id')
  @Roles('DOCENTE', 'ADMIN')
  desactivar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.tareasService.desactivar(id, req.user.id);
  }

  @Post(':id/entregar')
  @Roles('ALUMNO')
  @UseInterceptors(FileInterceptor('archivo'))
  entregar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Body() dto: EntregarTareaDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.tareasService.entregar(id, req.user.id, dto, archivo?.filename);
  }

  @Post(':tareaId/marcar-entrega-presencial')
  @Roles('DOCENTE', 'ADMIN')
  marcarPresencial(
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @Req() req,
    @Body('alumnoId', ParseIntPipe) alumnoId: number,
  ) {
    return this.tareasService.marcarEntregaPresencial(tareaId, req.user.id, alumnoId);
  }

  @Get(':id/entregas')
  @Roles('DOCENTE', 'ADMIN')
  entregas(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.tareasService.obtenerEntregas(id, req.user.id);
  }

  @Patch('entregas/:entregaId/revisar')
  @Roles('DOCENTE', 'ADMIN')
  revisar(@Param('entregaId', ParseIntPipe) id: number, @Req() req, @Body() dto: RevisarEntregaDto) {
    return this.tareasService.revisar(id, req.user.id, dto);
  }

  @Patch('entregas/:entregaId/calificar')
  @Roles('DOCENTE', 'ADMIN')
  calificar(@Param('entregaId', ParseIntPipe) id: number, @Req() req, @Body() dto: CalificarEntregaDto) {
    return this.tareasService.calificar(id, req.user.id, dto);
  }

  @Patch('entregas/:entregaId/incorrecta')
  @Roles('DOCENTE', 'ADMIN')
  marcarIncorrecta(
    @Param('entregaId', ParseIntPipe) id: number,
    @Req() req,
    @Body('observacion') observacion: string,
  ) {
    return this.tareasService.marcarIncorrecta(id, req.user.id, observacion);
  }
}
