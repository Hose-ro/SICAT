import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from '@nestjs/common';
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
  ) {
    return this.notificacionesService.obtenerPorUsuario(
      req.user.id,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('no-leidas')
  contarNoLeidas(@Req() req) {
    return this.notificacionesService.contarNoLeidas(req.user.id);
  }

  @Patch('leer-todas')
  marcarTodasLeidas(@Req() req) {
    return this.notificacionesService.marcarTodasLeidas(req.user.id);
  }

  @Patch(':id/leer')
  marcarLeida(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.notificacionesService.marcarLeida(id, req.user.id);
  }
}
