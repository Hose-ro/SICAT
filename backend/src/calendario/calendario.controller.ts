import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CalendarioService } from './calendario.service';

const ARCHIVO_ICS = /^([A-Za-z0-9_-]{20,64})\.ics$/;

@Controller('calendario')
export class CalendarioController {
  constructor(private readonly calendario: CalendarioService) {}

  @Get('suscripcion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCENTE', 'ALUMNO')
  estado(@Req() req: AuthenticatedRequest) {
    return this.calendario.estado(req.user.id);
  }

  /** Crea (o renueva) la suscripción; el token sólo se entrega esta vez. */
  @Post('suscripcion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCENTE', 'ALUMNO')
  generar(@Req() req: AuthenticatedRequest) {
    return this.calendario.generarToken(req.user.id);
  }

  @Delete('suscripcion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCENTE', 'ALUMNO')
  revocar(@Req() req: AuthenticatedRequest) {
    return this.calendario.revocar(req.user.id);
  }

  /** Público a propósito: la app de calendario sólo conoce la URL con el token. */
  @Get(':archivo')
  async feed(
    @Param('archivo') archivo: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const match = ARCHIVO_ICS.exec(archivo);
    if (!match) throw new NotFoundException('Calendario no encontrado');
    const ics = await this.calendario.feed(match[1]);
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="sicat.ics"',
      'Cache-Control': 'private, max-age=900',
    });
    return ics;
  }
}
