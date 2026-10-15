import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReunionesService } from './reuniones.service';
import {
  CrearReunionDto,
  EditarReunionDto,
  GuardarActaDto,
  ReunionQueryDto,
} from './dto/reunion.dto';

/** Reuniones de academia que programa y documenta la jefatura de carrera. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JEFE_CARRERA')
@Controller('jefe-carrera/reuniones')
export class ReunionesJefaturaController {
  constructor(private readonly reuniones: ReunionesService) {}

  @Get()
  listar(@Req() req: AuthenticatedRequest, @Query() query: ReunionQueryDto) {
    return this.reuniones.listarJefe(req.user.id, query.carreraId);
  }

  @Get('docentes')
  docentes(@Req() req: AuthenticatedRequest, @Query() query: ReunionQueryDto) {
    return this.reuniones.docentes(req.user.id, query.carreraId);
  }

  @Get(':id')
  detalle(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reuniones.detalleJefe(req.user.id, id);
  }

  @Post()
  crear(@Req() req: AuthenticatedRequest, @Body() dto: CrearReunionDto) {
    return this.reuniones.crear(req.user.id, dto);
  }

  @Patch(':id')
  editar(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarReunionDto,
  ) {
    return this.reuniones.editar(req.user.id, id, dto);
  }

  @Post(':id/cancelar')
  cancelar(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reuniones.cancelar(req.user.id, id);
  }

  @Put(':id/acta')
  guardarActa(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarActaDto,
  ) {
    return this.reuniones.guardarActa(req.user.id, id, dto);
  }

  @Delete(':id')
  eliminar(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reuniones.eliminar(req.user.id, id);
  }
}

/** Lo que ve el docente convocado, y el .ics para ambos roles. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reuniones')
export class ReunionesController {
  constructor(private readonly reuniones: ReunionesService) {}

  @Get('mias')
  @Roles('DOCENTE')
  mias(@Req() req: AuthenticatedRequest) {
    return this.reuniones.mias(req.user.id);
  }

  @Get(':id/ics')
  @Roles('DOCENTE', 'JEFE_CARRERA')
  async ics(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const archivo = await this.reuniones.ics(req.user, id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo.filename}"`,
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.send(archivo.contenido);
  }
}
