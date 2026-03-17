import { Controller, Post, Get, Patch, Param, Body, UseGuards, Req, Query, ParseIntPipe } from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SolicitarInscripcionDto } from './dto/solicitar-inscripcion.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inscripciones')
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Post('solicitar')
  @Roles('ALUMNO')
  solicitar(@Req() req, @Body() dto: SolicitarInscripcionDto) {
    return this.inscripcionesService.solicitar(req.user.id, dto);
  }

  @Get('mis-solicitudes')
  @Roles('ALUMNO')
  misSolicitudes(@Req() req) {
    return this.inscripcionesService.obtenerMisSolicitudes(req.user.id);
  }

  @Get('pendientes')
  @Roles('DOCENTE', 'ADMIN')
  pendientes(@Req() req) {
    return this.inscripcionesService.obtenerPendientes(req.user.id);
  }

  @Get('mis-materias')
  @Roles('ALUMNO')
  misMaterias(@Req() req, @Query('periodo') periodo?: string) {
    return this.inscripcionesService.obtenerMisMaterias(req.user.id, periodo);
  }

  @Get('alumnos/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  alumnosMateria(@Param('materiaId', ParseIntPipe) materiaId: number, @Req() req) {
    return this.inscripcionesService.obtenerAlumnosMateria(materiaId, req.user.id);
  }

  @Patch(':id/aceptar')
  @Roles('DOCENTE', 'ADMIN')
  aceptar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.inscripcionesService.aceptar(id, req.user.id);
  }

  @Patch(':id/rechazar')
  @Roles('DOCENTE', 'ADMIN')
  rechazar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.inscripcionesService.rechazar(id, req.user.id);
  }
}
