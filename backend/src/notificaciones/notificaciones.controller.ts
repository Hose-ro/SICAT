import {
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Req } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  obtener(
    @Req() req,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('soloNoLeidas') soloNoLeidas?: string,
  ) {
    return this.notificacionesService.obtenerPorUsuario(
      req.user.id,
      {
        skip: skip ? parseInt(skip, 10) : 0,
        take: take ? parseInt(take, 10) : 20,
        soloNoLeidas: soloNoLeidas === 'true',
      },
    );
  }

  @Get('no-leidas')
  contarNoLeidas(@Req() req) {
    return this.notificacionesService.contarNoLeidas(req.user.id);
  }

  @Get('no-leidas/lista')
  obtenerNoLeidas(
    @Req() req,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.notificacionesService.obtenerPorUsuario(req.user.id, {
      skip: skip ? parseInt(skip, 10) : 0,
      take: take ? parseInt(take, 10) : 20,
      soloNoLeidas: true,
    });
  }

  @Patch('leer-todas')
  marcarTodasLeidas(@Req() req) {
    return this.notificacionesService.marcarTodasLeidas(req.user.id);
  }

  @Patch(':id/leer')
  marcarLeida(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.notificacionesService.marcarLeida(id, req.user.id);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.notificacionesService.eliminar(id, req.user.id);
  }
}
