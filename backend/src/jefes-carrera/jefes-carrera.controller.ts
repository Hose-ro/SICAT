import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActualizarAlertaDto } from './dto/actualizar-alerta.dto';
import { JefesCarreraService } from './jefes-carrera.service';

type AuthenticatedRequest = Request & { user: { id: number; rol: string } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JEFE_CARRERA')
@Controller('jefe-carrera')
export class JefesCarreraController {
  constructor(private readonly service: JefesCarreraService) {}

  @Get('carreras')
  carreras(@Req() req: AuthenticatedRequest) {
    return this.service.obtenerCarreras(req.user.id);
  }

  @Get('panel')
  panel(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
  ) {
    return this.service.obtenerPanel(req.user.id, this.numero(carreraId));
  }

  @Get('docentes')
  docentes(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
    @Query('q') q?: string,
    @Query('estado') estado?: string,
  ) {
    return this.service.obtenerDocentes(req.user.id, {
      carreraId: this.numero(carreraId),
      q,
      estado,
    });
  }

  @Get('docentes/:id')
  docente(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.obtenerDocente(req.user.id, id);
  }

  @Get('clases')
  clases(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
  ) {
    return this.service.obtenerClasesHoy(req.user.id, this.numero(carreraId));
  }

  @Get('sesiones/:id/asistencia')
  asistenciaSesion(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.obtenerAsistenciaSesion(req.user.id, id);
  }

  @Get('horarios')
  horarios(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
    @Query('docenteId') docenteId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('aulaId') aulaId?: string,
  ) {
    return this.service.obtenerHorarios(req.user.id, {
      carreraId: this.numero(carreraId),
      docenteId: this.numero(docenteId),
      grupoId: this.numero(grupoId),
      aulaId: this.numero(aulaId),
    });
  }

  @Get('materias')
  materias(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
  ) {
    return this.service.obtenerMaterias(req.user.id, this.numero(carreraId));
  }

  @Get('grupos')
  grupos(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
  ) {
    return this.service.obtenerGrupos(req.user.id, this.numero(carreraId));
  }

  @Get('alertas')
  alertas(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.service.obtenerAlertas(req.user.id, {
      carreraId: this.numero(carreraId),
      estado,
    });
  }

  @Patch('alertas/:id')
  actualizarAlerta(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAlertaDto,
  ) {
    return this.service.actualizarAlerta(req.user.id, id, dto);
  }

  @Get('reportes')
  reportes(
    @Req() req: AuthenticatedRequest,
    @Query('carreraId') carreraId?: string,
  ) {
    return this.service.obtenerReporte(req.user.id, this.numero(carreraId));
  }

  @Get('reportes/exportar')
  async exportar(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('carreraId') carreraId?: string,
    @Query('formato') formato = 'excel',
  ) {
    const data = await this.service.exportarReporte(
      req.user.id,
      this.numero(carreraId),
      formato,
    );
    res.setHeader('Content-Type', data.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${data.filename}`,
    );
    return res.send(data.buffer);
  }

  private numero(value?: string) {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(
        'El identificador debe ser un entero positivo',
      );
    }
    return parsed;
  }
}
