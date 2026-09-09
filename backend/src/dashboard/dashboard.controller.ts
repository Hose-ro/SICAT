import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('docente')
  @Roles('DOCENTE')
  @ApiOperation({
    summary: 'Panel del docente: clases de hoy, pendientes y sus materias',
  })
  docente(@Req() req) {
    return this.dashboard.obtenerPanelDocente(req.user.id);
  }

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Panel del admin: colas pendientes, catálogo y actividad de hoy',
  })
  admin() {
    return this.dashboard.obtenerPanelAdmin();
  }
}
