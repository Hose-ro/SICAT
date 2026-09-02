import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { HorarioImportacionesService } from './horario-importaciones.service';
import { UpdateImportacionHorarioDto } from './dto/update-importacion-horario.dto';
import { RechazarImportacionHorarioDto } from './dto/rechazar-importacion-horario.dto';

@ApiTags('Horarios importados')
@Controller('horario-importaciones/public')
export class HorarioImportacionesPublicController {
  constructor(private readonly importaciones: HorarioImportacionesService) {}

  @Get('disponible')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Buscar un horario compartido durante el registro' })
  buscarDisponible(
    @Query('carreraId', ParseIntPipe) carreraId: number,
    @Query('semestre', ParseIntPipe) semestre: number,
    @Query('periodo') periodo?: string,
    @Query('seccion') seccion?: string,
  ) {
    return this.importaciones.buscarHorarioDisponible(
      carreraId,
      semestre,
      periodo,
      seccion,
    );
  }
}

@ApiTags('Horarios importados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('horario-importaciones')
export class HorarioImportacionesController {
  constructor(private readonly importaciones: HorarioImportacionesService) {}

  @Get()
  listar() {
    return this.importaciones.listar();
  }

  @Get('configuracion/lector')
  configuracionLector() {
    return this.importaciones.configuracionLector();
  }

  @Get(':id/foto')
  async foto(@Param('id', ParseIntPipe) id: number, @Res() response: Response) {
    const foto = await this.importaciones.obtenerFoto(id);
    response.type(foto.mime);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(foto.nombre)}"`,
    );
    if (foto.buffer) return response.send(foto.buffer);
    return response.sendFile(foto.path!);
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.importaciones.obtenerDetalle(id);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateImportacionHorarioDto,
  ) {
    return this.importaciones.actualizar(id, dto);
  }

  @Post(':id/reprocesar')
  reprocesar(@Param('id', ParseIntPipe) id: number) {
    return this.importaciones.reprocesar(id);
  }

  @Post(':id/aprobar')
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importaciones.aprobar(id, request.user.id);
  }

  @Post(':id/rechazar')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() dto: RechazarImportacionHorarioDto,
  ) {
    return this.importaciones.rechazar(id, request.user.id, dto.motivo);
  }
}
