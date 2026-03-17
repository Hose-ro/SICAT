import { Controller, Post, Patch, Get, Param, Body, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ClasesService } from './clases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IniciarClaseDto } from './dto/iniciar-clase.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clases')
export class ClasesController {
  constructor(private readonly clasesService: ClasesService) {}

  @Post('iniciar')
  @Roles('DOCENTE', 'ADMIN')
  iniciar(@Req() req, @Body() dto: IniciarClaseDto) {
    return this.clasesService.iniciar(req.user.id, dto);
  }

  @Patch(':id/finalizar')
  @Roles('DOCENTE', 'ADMIN')
  finalizar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.clasesService.finalizar(id, req.user.id);
  }

  @Get('activa/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  obtenerActiva(@Param('materiaId', ParseIntPipe) materiaId: number, @Req() req) {
    return this.clasesService.obtenerActiva(materiaId, req.user.id);
  }

  @Get('historial/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  obtenerHistorial(@Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.clasesService.obtenerHistorial(materiaId);
  }

  @Get('mis-clases-activas')
  @Roles('ALUMNO')
  clasesActivasAlumno(@Req() req) {
    return this.clasesService.obtenerClasesActivasAlumno(req.user.id);
  }
}
