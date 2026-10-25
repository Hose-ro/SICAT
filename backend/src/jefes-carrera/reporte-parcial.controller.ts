import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  ContextoReporteParcialQueryDto,
  ExportarReporteParcialQueryDto,
  ReporteParcialQueryDto,
} from './dto/reporte-parcial.dto';
import { ReporteParcialService } from './reporte-parcial.service';

type Actor = { id: number; nombre: string; rol: 'DOCENTE' | 'JEFE_CARRERA' };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCENTE', 'JEFE_CARRERA')
@Controller('reportes/parcial-semestre')
export class ReporteParcialController {
  constructor(private readonly reportes: ReporteParcialService) {}

  @Get('contexto')
  contexto(
    @Req() req: { user: Actor },
    @Query() query: ContextoReporteParcialQueryDto,
  ) {
    return this.reportes.contexto(req.user, query.periodo);
  }

  @Get()
  reporte(@Req() req: { user: Actor }, @Query() query: ReporteParcialQueryDto) {
    return this.reportes.reporte(req.user, query);
  }

  @Get('exportar')
  async exportar(
    @Req() req: { user: Actor },
    @Res() res: Response,
    @Query() query: ExportarReporteParcialQueryDto,
  ) {
    const archivo = await this.reportes.exportar(
      req.user,
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
