import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReporteAcademicoService } from './reporte-academico.service';
import {
  ExportarAcademicoQueryDto,
  ReporteAcademicoQueryDto,
} from './dto/reporte-academico.dto';

@Controller('jefe-carrera/calificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JEFE_CARRERA')
export class ReporteAcademicoController {
  constructor(private service: ReporteAcademicoService) {}
  @Get() reporte(
    @Req() req: { user: { id: number } },
    @Query() query: ReporteAcademicoQueryDto,
  ) {
    return this.service.reporte(req.user.id, query);
  }
  @Get('exportar') async exportar(
    @Req() req: { user: { id: number } },
    @Query() query: ExportarAcademicoQueryDto,
    @Res() res: Response,
  ) {
    const archivo = await this.service.exportar(
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
