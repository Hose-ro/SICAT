import {
  BadRequestException,
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
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AvisosService } from './avisos.service';
import {
  CrearAvisoDto,
  EditarAvisoDto,
  GuardarWhatsappDto,
} from './dto/aviso.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('avisos')
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  @Get()
  @Roles('DOCENTE', 'ADMIN')
  listar(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('alumnoId') alumnoId?: string,
  ) {
    if (!materiaId || !grupoId) {
      throw new BadRequestException('La materia y el grupo son obligatorios');
    }
    return this.avisos.listarDocente(req.user, {
      materiaId: Number(materiaId),
      grupoId: Number(grupoId),
      alumnoId: alumnoId ? Number(alumnoId) : undefined,
    });
  }

  @Get('mios')
  @Roles('ALUMNO')
  mios(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
  ) {
    if (!materiaId) throw new BadRequestException('La materia es obligatoria');
    return this.avisos.listarAlumno(req.user.id, Number(materiaId));
  }

  @Get('whatsapp')
  @Roles('DOCENTE', 'ADMIN')
  whatsapp(
    @Req() req: AuthenticatedRequest,
    @Query('materiaId') materiaId?: string,
    @Query('grupoId') grupoId?: string,
  ) {
    if (!materiaId || !grupoId) {
      throw new BadRequestException('La materia y el grupo son obligatorios');
    }
    return this.avisos.obtenerWhatsapp(
      req.user,
      Number(materiaId),
      Number(grupoId),
    );
  }

  @Put('whatsapp')
  @Roles('DOCENTE', 'ADMIN')
  guardarWhatsapp(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GuardarWhatsappDto,
  ) {
    return this.avisos.guardarWhatsapp(req.user, dto);
  }

  @Post()
  @Roles('DOCENTE', 'ADMIN')
  crear(@Req() req: AuthenticatedRequest, @Body() dto: CrearAvisoDto) {
    return this.avisos.crear(req.user, dto);
  }

  @Patch(':id')
  @Roles('DOCENTE', 'ADMIN')
  editar(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarAvisoDto,
  ) {
    return this.avisos.editar(req.user, id, dto);
  }

  @Delete(':id')
  @Roles('DOCENTE', 'ADMIN')
  eliminar(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.avisos.eliminar(req.user, id);
  }
}
