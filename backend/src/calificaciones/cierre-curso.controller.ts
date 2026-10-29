import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  excelConcentrado,
  pdfConcentrado,
  type DatosConcentrado,
} from '../reportes/concentrado-cierre';
import { CierreCursoService } from './cierre-curso.service';
import { GuardarSegundaOportunidadDto } from './dto/guardar-segunda-oportunidad.dto';

function id(valor: string | undefined, campo: string) {
  const numero = Number(valor);
  if (!valor || !Number.isInteger(numero) || numero < 1) {
    throw new BadRequestException(`${campo} es obligatorio`);
  }
  return numero;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCENTE', 'ADMIN')
@Controller('calificaciones/cierre')
export class CierreCursoController {
  constructor(private readonly cierre: CierreCursoService) {}

  @Get()
  @ApiOperation({ summary: 'Cierre de curso de una materia en un grupo' })
  obtener(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
  ) {
    return this.cierre.obtener(
      req.user,
      id(materiaId, 'La materia'),
      id(grupoId, 'El grupo'),
    );
  }

  @Patch('segunda')
  @ApiOperation({ summary: 'Capturar la segunda oportunidad' })
  guardarSegunda(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GuardarSegundaOportunidadDto,
  ) {
    return this.cierre.guardarSegunda(req.user, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Cerrar el curso y congelar el concentrado' })
  cerrar(
    @Req() req: AuthenticatedRequest,
    @Body() body: { materiaId?: number; grupoId?: number },
  ) {
    return this.cierre.cerrar(
      req.user,
      id(String(body?.materiaId ?? ''), 'La materia'),
      id(String(body?.grupoId ?? ''), 'El grupo'),
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Reabrir un curso cerrado' })
  reabrir(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
  ) {
    return this.cierre.reabrir(
      req.user,
      id(materiaId, 'La materia'),
      id(grupoId, 'El grupo'),
    );
  }

  @Get('exportar')
  @ApiOperation({ summary: 'Concentrado de calificaciones en Excel o PDF' })
  async exportar(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('formato') formato = 'excel',
  ) {
    const datos = await this.cierre.obtener(
      req.user,
      id(materiaId, 'La materia'),
      id(grupoId, 'El grupo'),
    );
    // Cerrado, se entrega la foto del cierre; abierto, lo de hoy (preliminar).
    const foto = datos.cierre?.foto;
    const concentrado: DatosConcentrado = {
      materia: datos.materia,
      grupo: datos.grupo ?? null,
      periodo: datos.periodo,
      docente: foto?.docente ?? datos.materia?.docente?.nombre ?? null,
      cerradoEn: datos.cierre?.cerradoEn ?? null,
      unidades: foto?.unidades ?? datos.unidades,
      alumnos: foto?.alumnos ?? datos.alumnos,
    };
    const nombre = [
      'concentrado',
      datos.materia?.clave,
      datos.grupo?.nombre?.replace(/\s+/g, '-'),
      datos.cierre ? null : 'preliminar',
    ]
      .filter(Boolean)
      .join('-')
      .toLowerCase();

    if (formato === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${nombre}.pdf`,
      );
      return res.send(await pdfConcentrado(concentrado));
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${nombre}.xlsx`);
    return res.send(await excelConcentrado(concentrado));
  }
}
