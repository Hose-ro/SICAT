import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PeriodosService } from './periodos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ActualizarPeriodoDto } from './dto/actualizar-periodo.dto';

@ApiTags('Periodos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('periodos')
export class PeriodosController {
  constructor(private periodos: PeriodosService) {}

  @Get('actual')
  @Roles('DOCENTE', 'ADMIN', 'JEFE_CARRERA', 'ALUMNO')
  @ApiOperation({ summary: 'Fechas del periodo escolar en curso' })
  obtenerActual() {
    return this.periodos.obtenerActual();
  }

  @Put('actual')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Establecer inicio y fin del periodo en curso' })
  actualizarActual(@Req() req, @Body() dto: ActualizarPeriodoDto) {
    return this.periodos.actualizarActual(req.user.id, dto);
  }
}
