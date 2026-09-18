import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PeriodosService } from './periodos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ActualizarPeriodoDto } from './dto/actualizar-periodo.dto';
import { GuardarSuspensionesDto } from './dto/guardar-suspensiones.dto';

@ApiTags('Periodos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('periodos')
export class PeriodosController {
  constructor(private periodos: PeriodosService) {}

  @Get('actual')
  @Roles('DOCENTE', 'ADMIN', 'JEFE_CARRERA', 'ALUMNO')
  @ApiOperation({
    summary:
      'Fechas del periodo en curso, escolarizado y mixto, y cuáles aplican a quien consulta',
  })
  obtenerActual(@Req() req) {
    return this.periodos.obtenerActualesPara(req.user);
  }

  @Put('actual')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({
    summary: 'Establecer inicio y fin del periodo en curso para una modalidad',
  })
  async actualizarActual(@Req() req, @Body() dto: ActualizarPeriodoDto) {
    await this.periodos.actualizarActual(req.user, dto);
    return this.periodos.obtenerActualesPara(req.user);
  }

  @Get('actual/suspensiones')
  @Roles('DOCENTE')
  @ApiOperation({
    summary:
      'Días sin clases del docente en el periodo (propios e institucionales)',
  })
  listarSuspensiones(@Req() req) {
    return this.periodos.listarSuspensiones(req.user.id);
  }

  @Post('actual/suspensiones')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Marcar días sin clases en el horario del docente' })
  guardarSuspensiones(@Req() req, @Body() dto: GuardarSuspensionesDto) {
    return this.periodos.guardarSuspensiones(req.user.id, dto);
  }

  @Delete('actual/suspensiones/:fecha')
  @Roles('DOCENTE')
  @ApiOperation({
    summary: 'Restablecer las clases de un día suspendido por el docente',
  })
  eliminarSuspension(@Req() req, @Param('fecha') fecha: string) {
    return this.periodos.eliminarSuspension(req.user.id, fecha);
  }

  @Get('actual/suspensiones-institucionales')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Días sin clases para toda la institución en el periodo',
  })
  listarSuspensionesInstitucionales() {
    return this.periodos.listarSuspensionesInstitucionales();
  }

  @Post('actual/suspensiones-institucionales')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Marcar días festivos o de suspensión para todos los docentes',
  })
  guardarSuspensionesInstitucionales(
    @Req() req,
    @Body() dto: GuardarSuspensionesDto,
  ) {
    return this.periodos.guardarSuspensionesInstitucionales(req.user.id, dto);
  }

  @Delete('actual/suspensiones-institucionales/:fecha')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Restablecer las clases de un día suspendido institucionalmente',
  })
  eliminarSuspensionInstitucional(@Param('fecha') fecha: string) {
    return this.periodos.eliminarSuspensionInstitucional(fecha);
  }
}
