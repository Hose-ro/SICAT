import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupervisionService } from './supervision.service';
import {
  CalendarioSupervisionQueryDto,
  SupervisionQueryDto,
} from './dto/supervision-query.dto';
import { IncorporarAlumnoDto } from './dto/incorporar-alumno.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JEFE_CARRERA')
@Controller('jefe-carrera')
export class SupervisionController {
  constructor(private service: SupervisionService) {}
  @Get('contexto') contexto(@Req() req: { user: { id: number } }) {
    return this.service.contexto(req.user.id);
  }
  @Get('supervision') resumen(
    @Req() req: { user: { id: number } },
    @Query() query: SupervisionQueryDto,
  ) {
    return this.service.resumen(req.user.id, query);
  }
  @Get('calendario') calendario(
    @Req() req: { user: { id: number } },
    @Query() query: CalendarioSupervisionQueryDto,
  ) {
    return this.service.clases(req.user.id, query, query.desde, query.hasta, {
      docenteId: query.docenteId,
      grupoId: query.grupoId,
    });
  }
  @Get('grupos/:grupoId/expediente') expediente(
    @Req() req: { user: { id: number } },
    @Query() query: SupervisionQueryDto,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    return this.service.expedienteGrupo(req.user.id, query, grupoId);
  }
  @Get('ofertas/:materiaId/grupos/:grupoId') reporte(
    @Req() req: { user: { id: number } },
    @Query() query: SupervisionQueryDto,
    @Param('materiaId', ParseIntPipe) materiaId: number,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    return this.service.reporte(req.user.id, query, materiaId, grupoId);
  }
  @Get('alumnos/buscar') alumnos(
    @Req() req: { user: { id: number } },
    @Query() query: SupervisionQueryDto,
    @Query('q') q?: string,
    @Query('materiaId') materiaId?: string,
  ) {
    return this.service.buscarAlumnos(
      req.user.id,
      query,
      q ?? '',
      Number(materiaId) || undefined,
    );
  }
  @Post('incorporaciones') incorporar(
    @Req() req: { user: { id: number } },
    @Query() query: SupervisionQueryDto,
    @Body() dto: IncorporarAlumnoDto,
  ) {
    return this.service.incorporar(req.user.id, query, dto);
  }
}
