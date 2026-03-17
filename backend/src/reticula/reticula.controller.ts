import { Controller, Get, Param, ParseIntPipe, Query, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReticulaService } from './reticula.service';
import { GenerarSeccionesDto } from './dto/generar-secciones.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Reticula')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('reticula')
export class ReticulaController {
  constructor(private reticula: ReticulaService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar retícula por carrera y opcionalmente semestre' })
  @ApiQuery({ name: 'carreraId', required: true, type: Number })
  @ApiQuery({ name: 'semestre', required: false, type: Number })
  obtener(
    @Query('carreraId') carreraId: string,
    @Query('semestre') semestre?: string,
  ) {
    return this.reticula.obtenerPorCarrera(Number(carreraId), semestre ? Number(semestre) : undefined);
  }

  @Get('completa/:carreraId')
  @ApiOperation({ summary: 'Retícula completa agrupada por semestre' })
  obtenerCompleta(@Param('carreraId', ParseIntPipe) carreraId: number) {
    return this.reticula.obtenerPorCarrera(carreraId);
  }

  @Post('generar-secciones')
  @ApiOperation({ summary: 'Generar secciones (Materia) desde la retícula para un semestre' })
  generarSecciones(@Body() dto: GenerarSeccionesDto) {
    return this.reticula.generarSecciones(dto);
  }
}
