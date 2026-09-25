import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UnidadesService } from './unidades.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EditarFechasUnidadDto } from './dto/editar-fechas-unidad.dto';

@ApiTags('Unidades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('unidades')
export class UnidadesController {
  constructor(private unidades: UnidadesService) {}

  @Patch(':id/iniciar')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Iniciar unidad' })
  iniciar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.unidades.iniciar(id, req.user);
  }

  @Patch(':id/finalizar')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Finalizar unidad' })
  finalizar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.unidades.finalizar(id, req.user);
  }

  @Patch(':id/cancelar')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Cancelar una unidad activa (vuelve a pendiente)' })
  cancelar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.unidades.cancelar(id, req.user);
  }

  @Patch(':id/fechas')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Editar fecha de inicio y/o fin de una unidad' })
  editarFechas(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarFechasUnidadDto,
    @Req() req,
  ) {
    return this.unidades.editarFechas(id, req.user, dto);
  }

  @Get('materia/:materiaId')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Unidades de una materia' })
  findByMateria(
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Req() req,
  ) {
    return this.unidades.findByMateria(materiaId, req.user);
  }
}
