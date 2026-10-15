import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { excelAvance, pdfAvance } from '../reportes/avance-programatico';
import { TemarioService } from './temario.service';
import { GuardarTemasDto } from './dto/guardar-temas.dto';
import { GuardarBitacoraDto } from './dto/guardar-bitacora.dto';

function id(valor: string | undefined, campo: string) {
  const numero = Number(valor);
  if (!valor || !Number.isInteger(numero) || numero < 1) {
    throw new BadRequestException(`${campo} es obligatorio`);
  }
  return numero;
}

@ApiTags('Temario')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCENTE', 'ADMIN')
@Controller('temario')
export class TemarioController {
  constructor(private readonly temario: TemarioService) {}

  @Get()
  @ApiOperation({ summary: 'Temario de la materia y avance de un grupo' })
  obtener(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
  ) {
    return this.temario.obtener(
      req.user,
      id(materiaId, 'La materia'),
      grupoId ? id(grupoId, 'El grupo') : undefined,
    );
  }

  @Put('unidad/:unidadId')
  @ApiOperation({ summary: 'Reemplazar los temas de una unidad' })
  guardarTemas(
    @Req() req: AuthenticatedRequest,
    @Param('unidadId', ParseIntPipe) unidadId: number,
    @Body() dto: GuardarTemasDto,
  ) {
    return this.temario.guardarTemas(req.user, unidadId, dto);
  }

  @Get('sesion/:sesionId')
  @ApiOperation({ summary: 'Bitácora de una clase' })
  obtenerBitacora(
    @Req() req: AuthenticatedRequest,
    @Param('sesionId', ParseIntPipe) sesionId: number,
  ) {
    return this.temario.obtenerBitacora(req.user, sesionId);
  }

  @Put('sesion/:sesionId')
  @ApiOperation({ summary: 'Guardar qué se vio en una clase' })
  guardarBitacora(
    @Req() req: AuthenticatedRequest,
    @Param('sesionId', ParseIntPipe) sesionId: number,
    @Body() dto: GuardarBitacoraDto,
  ) {
    return this.temario.guardarBitacora(req.user, sesionId, dto);
  }

  @Get('exportar')
  @ApiOperation({ summary: 'Reporte de avance programático (Excel o PDF)' })
  async exportar(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('formato') formato = 'excel',
  ) {
    const datos = await this.temario.obtener(
      req.user,
      id(materiaId, 'La materia'),
      id(grupoId, 'El grupo'),
    );
    const nombre = ['avance', datos.materia.clave, datos.grupo?.nombre]
      .filter(Boolean)
      .join('-')
      .replace(/\s+/g, '-')
      .toLowerCase();
    if (formato === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${nombre}.pdf`,
      );
      return res.send(await pdfAvance(datos));
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${nombre}.xlsx`);
    return res.send(await excelAvance(datos));
  }
}
