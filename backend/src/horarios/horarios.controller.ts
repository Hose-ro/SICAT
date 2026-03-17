import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HorariosService } from './horarios.service';
import { AsignarDocenteDto } from './dto/asignar-docente.dto';
import { AsignarAulaDto } from './dto/asignar-aula.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Horarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('horarios')
export class HorariosController {
  constructor(private horarios: HorariosService) {}

  @Post('asignar-docente')
  @ApiOperation({ summary: 'Asignar docente a una materia' })
  asignarDocente(@Body() dto: AsignarDocenteDto) {
    return this.horarios.asignarDocente(dto.materiaId, dto.docenteId);
  }

  @Post('asignar-aula')
  @ApiOperation({ summary: 'Asignar aula a una materia' })
  asignarAula(@Body() dto: AsignarAulaDto) {
    return this.horarios.asignarAula(dto.materiaId, dto.aulaId);
  }

  @Delete('quitar-docente/:materiaId')
  @ApiOperation({ summary: 'Quitar docente de una materia' })
  quitarDocente(@Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.horarios.quitarDocente(materiaId);
  }

  @Delete('quitar-aula/:materiaId')
  @ApiOperation({ summary: 'Quitar aula de una materia' })
  quitarAula(@Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.horarios.quitarAula(materiaId);
  }

  @Get('docente/:docenteId')
  @ApiOperation({ summary: 'Horario completo de un docente' })
  horarioDocente(@Param('docenteId', ParseIntPipe) docenteId: number) {
    return this.horarios.obtenerHorarioDocente(docenteId);
  }

  @Get('aula/:aulaId')
  @ApiOperation({ summary: 'Horario de un aula' })
  horarioAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.horarios.obtenerHorarioAula(aulaId);
  }

  @Get('sin-docente')
  @ApiOperation({ summary: 'Materias sin docente asignado' })
  sinDocente() {
    return this.horarios.obtenerMateriasSinDocente();
  }

  @Get('sin-aula')
  @ApiOperation({ summary: 'Materias sin aula asignada' })
  sinAula() {
    return this.horarios.obtenerMateriasSinAula();
  }

  @Get('ocupacion')
  @ApiOperation({ summary: 'Bloques ocupados para un docente y/o aula' })
  @ApiQuery({ name: 'docenteId', required: false, type: Number })
  @ApiQuery({ name: 'aulaId', required: false, type: Number })
  ocupacion(
    @Query('docenteId') docenteId?: string,
    @Query('aulaId') aulaId?: string,
  ) {
    return this.horarios.obtenerOcupacion(
      docenteId ? Number(docenteId) : undefined,
      aulaId ? Number(aulaId) : undefined,
    );
  }
}
