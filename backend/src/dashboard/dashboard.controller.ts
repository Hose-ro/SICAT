import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

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
  docente(@Req() req: AuthenticatedRequest) {
    return this.dashboard.obtenerPanelDocente(req.user.id);
  }

  @Get('docente/riesgo')
  @Roles('DOCENTE')
  @ApiOperation({
    summary:
      'Alumnos en riesgo del docente con faltas, tendencia, tareas sin entregar y último aviso',
  })
  riesgo(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
  ) {
    return this.dashboard.obtenerRiesgoDocente(req.user.id, {
      materiaId: materiaId ? Number(materiaId) : undefined,
      grupoId: grupoId ? Number(grupoId) : undefined,
    });
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
