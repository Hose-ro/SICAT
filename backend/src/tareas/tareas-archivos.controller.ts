import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { TareasService } from './tareas.service';

/**
 * Sustituye al `express.static('/uploads')` público: la ruta guardada en la BD
 * (`/uploads/tareas/<archivo>`) se resuelve bajo `/api`, donde llega la cookie
 * de sesión, y `TareasService.obtenerArchivo` decide si el actor puede verla.
 */
@UseGuards(JwtAuthGuard)
@Controller('uploads/tareas')
export class TareasArchivosController {
  constructor(private readonly tareasService: TareasService) {}

  @Get(':filename')
  async descargar(
    @Param('filename') filename: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const archivo = await this.tareasService.obtenerArchivo(filename, req.user);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(archivo.nombre)}"`,
    );
    return res.sendFile(archivo.path);
  }
}
