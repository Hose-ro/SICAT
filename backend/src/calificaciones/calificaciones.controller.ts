import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportesService } from '../reportes/reportes.service';
import { CalificacionesService } from './calificaciones.service';
import { CriteriosService } from './criterios.service';
import { GuardarCalificacionManualDto } from './dto/guardar-calificacion-manual.dto';
import { GuardarCalificacionesLoteDto } from './dto/guardar-calificaciones-lote.dto';
import { GuardarPonderacionDto } from './dto/guardar-ponderacion.dto';
import { GuardarCriteriosDto } from './dto/guardar-criterios.dto';

/** Id positivo de la query, o 400 con el mensaje dado. */
function idRequerido(valor: string | undefined, mensaje: string) {
  const id = Number(valor);
  if (!valor || !Number.isInteger(id) || id < 1) {
    throw new BadRequestException(mensaje);
  }
  return id;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calificaciones')
export class CalificacionesController {
  constructor(
    private readonly calificacionesService: CalificacionesService,
    private readonly criteriosService: CriteriosService,
    private readonly reportesService: ReportesService,
  ) {}

  @Get('docente')
  @Roles('DOCENTE', 'ADMIN')
  docente(
    @Req() req,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('docenteId') docenteId?: string,
  ) {
    if (!materiaId) {
      throw new BadRequestException('La materia es obligatoria');
    }

    return this.calificacionesService.obtenerReporteDocente(req.user, {
      materiaId: Number(materiaId),
      grupoId: grupoId ? Number(grupoId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
      docenteId: docenteId ? Number(docenteId) : undefined,
    });
  }

  @Get('ponderacion')
  @Roles('DOCENTE', 'ADMIN')
  ponderacion(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
  ) {
    if (!materiaId) {
      throw new BadRequestException('La materia es obligatoria');
    }
    return this.calificacionesService.obtenerPonderacion(
      req.user,
      Number(materiaId),
      grupoId ? Number(grupoId) : undefined,
    );
  }

  @Patch('ponderacion')
  @Roles('DOCENTE', 'ADMIN')
  guardarPonderacion(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GuardarPonderacionDto,
  ) {
    return this.calificacionesService.guardarPonderacion(req.user, dto);
  }

  /** Semáforo de una clase en una unidad, para el inicio del docente. */
  @Get('desempeno')
  @Roles('DOCENTE', 'ADMIN')
  desempeno(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
  ) {
    return this.calificacionesService.obtenerDesempeno(req.user, {
      materiaId: idRequerido(materiaId, 'La materia es obligatoria'),
      grupoId: idRequerido(grupoId, 'Elige un grupo'),
      unidadId: unidadId
        ? idRequerido(unidadId, 'La unidad no es válida')
        : undefined,
    });
  }

  @Get('criterios')
  @Roles('DOCENTE', 'ADMIN')
  criterios(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
  ) {
    return this.criteriosService.obtener(
      req.user,
      idRequerido(materiaId, 'La materia es obligatoria'),
      idRequerido(grupoId, 'Elige un grupo para ver sus criterios'),
    );
  }

  @Put('criterios')
  @Roles('DOCENTE', 'ADMIN')
  guardarCriterios(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GuardarCriteriosDto,
  ) {
    return this.criteriosService.guardar(req.user, dto);
  }

  /**
   * Con unidad, ésta deja sus porcentajes propios y vuelve a los de todas; sin
   * unidad, el grupo vuelve a la ponderación predeterminada.
   */
  @Delete('criterios')
  @Roles('DOCENTE', 'ADMIN')
  quitarCriterios(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
  ) {
    const materia = idRequerido(materiaId, 'La materia es obligatoria');
    const grupo = idRequerido(grupoId, 'El grupo es obligatorio');
    return unidadId
      ? this.criteriosService.quitarUnidad(
          req.user,
          materia,
          grupo,
          idRequerido(unidadId, 'La unidad no es válida'),
        )
      : this.criteriosService.quitarTodos(req.user, materia, grupo);
  }

  @Get('alumno')
  @Roles('ALUMNO')
  alumno(
    @Req() req,
    @Query('materiaId') materiaId?: string,
    @Query('unidadId') unidadId?: string,
  ) {
    return this.calificacionesService.obtenerReporteAlumno(req.user.id, {
      materiaId: materiaId ? Number(materiaId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
    });
  }

  @Patch('manual')
  @Roles('DOCENTE', 'ADMIN')
  guardarManual(
    @Req() req,
    @Body() dto: GuardarCalificacionManualDto,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
  ) {
    return this.calificacionesService.guardarManual(req.user, dto, {
      grupoId: grupoId ? Number(grupoId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
    });
  }

  @Patch('manual/lote')
  @Roles('DOCENTE', 'ADMIN')
  guardarManualLote(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GuardarCalificacionesLoteDto,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
  ) {
    return this.calificacionesService.guardarManualLote(req.user, dto, {
      grupoId: grupoId ? Number(grupoId) : undefined,
      unidadId: unidadId ? Number(unidadId) : undefined,
    });
  }

  @Get('exportar')
  @Roles('DOCENTE', 'ADMIN')
  async exportar(
    @Req() req,
    @Res() res,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('docenteId') docenteId?: string,
    @Query('formato') formato = 'excel',
  ) {
    if (!materiaId) {
      throw new BadRequestException('La materia es obligatoria');
    }

    const reporte = await this.calificacionesService.obtenerReporteDocente(
      req.user,
      {
        materiaId: Number(materiaId),
        grupoId: grupoId ? Number(grupoId) : undefined,
        unidadId: unidadId ? Number(unidadId) : undefined,
        docenteId: docenteId ? Number(docenteId) : undefined,
      },
    );

    const suffix = [
      reporte.materia?.clave ?? `materia-${materiaId}`,
      reporte.unidadSeleccionada?.orden
        ? `unidad-${reporte.unidadSeleccionada.orden}`
        : 'unidades',
      reporte.grupoSeleccionado?.nombre
        ? reporte.grupoSeleccionado.nombre.replace(/\s+/g, '-')
        : null,
    ]
      .filter(Boolean)
      .join('-')
      .toLowerCase();

    if (formato === 'csv') {
      const buffer =
        await this.reportesService.generarCsvCalificacionesCaptura(reporte);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=calificaciones-captura-${suffix}.csv`,
      );
      return res.send(buffer);
    }

    const buffer =
      await this.reportesService.generarExcelCalificacionesCaptura(reporte);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=calificaciones-captura-${suffix}.xlsx`,
    );
    return res.send(buffer);
  }
}
