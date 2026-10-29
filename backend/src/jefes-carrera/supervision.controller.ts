import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupervisionService } from './supervision.service';
import { SeguimientosService } from './seguimientos.service';
import { InformeService } from './informe.service';
import {
  CalendarioSupervisionQueryDto,
  SupervisionQueryDto,
} from './dto/supervision-query.dto';
import { IncorporarAlumnoDto } from './dto/incorporar-alumno.dto';
import { TelefonoDocenteDto } from './dto/telefono-docente.dto';
import {
  ExportarInformeQueryDto,
  InformeQueryDto,
  RegistrarSeguimientoDto,
} from './dto/seguimiento.dto';

type Autenticado = { user: { id: number } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JEFE_CARRERA')
@Controller('jefe-carrera')
export class SupervisionController {
  constructor(
    private service: SupervisionService,
    private seguimientos: SeguimientosService,
    private informes: InformeService,
  ) {}
  @Get('contexto') contexto(@Req() req: Autenticado) {
    return this.service.contexto(req.user.id);
  }
  @Get('supervision') resumen(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
  ) {
    return this.service.resumen(req.user.id, query);
  }
  @Patch('docentes/:docenteId/telefono') telefonoDocente(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
    @Param('docenteId', ParseIntPipe) docenteId: number,
    @Body() dto: TelefonoDocenteDto,
  ) {
    return this.service.agregarTelefonoDocente(req.user.id, query, docenteId, dto.telefono);
  }
  @Get('calendario') calendario(
    @Req() req: Autenticado,
    @Query() query: CalendarioSupervisionQueryDto,
  ) {
    return this.service.clases(req.user.id, query, query.desde, query.hasta, {
      docenteId: query.docenteId,
      grupoId: query.grupoId,
    });
  }
  @Get('sesiones/:sesionId/asistencia') asistenciaSesion(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
    @Param('sesionId', ParseIntPipe) sesionId: number,
  ) {
    return this.service.asistenciaSesion(req.user.id, query, sesionId);
  }
  @Get('grupos/:grupoId/expediente') expediente(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    return this.service.expedienteGrupo(req.user.id, query, grupoId);
  }
  @Get('ofertas/:materiaId/grupos/:grupoId') reporte(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    return this.service.reporte(req.user.id, query, materiaId, grupoId);
  }
  @Get('alumnos/buscar') alumnos(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
    @Query('q') q?: string,
    @Query('materiaId') materiaId?: string,
  ) {
    return this.service.buscarAlumnos(
      req.user.id,
      query,
      q ?? '',
      Number(materiaId) || undefined,
    );
  }
  @Post('incorporaciones') incorporar(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
    @Body() dto: IncorporarAlumnoDto,
  ) {
    return this.service.incorporar(req.user.id, query, dto);
  }
  @Get('seguimientos') listarSeguimientos(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
  ) {
    return this.seguimientos.listar(req.user.id, query);
  }
  @Post('seguimientos') registrarSeguimiento(
    @Req() req: Autenticado,
    @Query() query: SupervisionQueryDto,
    @Body() dto: RegistrarSeguimientoDto,
  ) {
    return this.seguimientos.registrar(req.user.id, query, dto);
  }
  @Get('informe') informe(
    @Req() req: Autenticado,
    @Query() query: InformeQueryDto,
  ) {
    return this.informes.informe(req.user.id, query);
  }
  @Get('informe/exportar') async exportarInforme(
    @Req() req: Autenticado,
    @Res() res: Response,
    @Query() query: ExportarInformeQueryDto,
  ) {
    const archivo = await this.informes.exportar(
      req.user.id,
      query,
      query.formato,
    );
    res.setHeader('Content-Type', archivo.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo.filename}"`,
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.send(archivo.buffer);
  }
}
