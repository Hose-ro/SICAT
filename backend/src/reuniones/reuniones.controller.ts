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
  ParseEnumPipe,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FormatoDocumentoReunion } from '@prisma/client';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReunionesService } from './reuniones.service';
import { actaDocumentoUploadOptions } from './acta-documento.storage';
import {
  AvisoAlumnosDto,
  BuscarDocentesDto,
  CrearReunionDto,
  EditarReunionDto,
  GuardarActaDto,
  JustificarClasesDto,
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

  /** Docentes de cualquier carrera, para invitarlos. */
  @Get('docentes/buscar')
  buscarDocentes(@Query() query: BuscarDocentesDto) {
    return this.reuniones.buscarDocentes(query.q);
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

  @Get(':id/seguimiento-sugerido')
  seguimientoSugerido(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reuniones.seguimientoSugerido(req.user.id, id);
  }

  /** Acta actualizada (firmada o corregida), PDF o Word. */
  @Post(':id/documento')
  @UseInterceptors(FileInterceptor('archivo', actaDocumentoUploadOptions))
  subirDocumento(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.reuniones.subirDocumento(req.user.id, id, archivo);
  }

  @Delete(':id/documento/:formato')
  quitarDocumento(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('formato', new ParseEnumPipe(FormatoDocumentoReunion))
    formato: FormatoDocumentoReunion,
  ) {
    return this.reuniones.quitarDocumento(req.user.id, id, formato);
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

  /** El acta completa (sin la lista de clases justificadas de los demás). */
  @Get(':id')
  @Roles('DOCENTE')
  detalle(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reuniones.detalleDocente(req.user.id, id);
  }

  /** Justifica las clases que se cruzan con la reunión, como un día sin clases. */
  @Post(':id/justificaciones')
  @Roles('DOCENTE')
  justificar(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JustificarClasesDto,
  ) {
    return this.reuniones.justificarClases(req.user.id, id, dto);
  }

  @Delete(':id/justificaciones/:horarioId')
  @Roles('DOCENTE')
  quitarJustificacion(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('horarioId', ParseIntPipe) horarioId: number,
  ) {
    return this.reuniones.quitarJustificacion(req.user.id, id, horarioId);
  }

  /** Si los alumnos ven que esa clase no habrá. */
  @Patch(':id/justificaciones/:horarioId')
  @Roles('DOCENTE')
  avisoAlumnos(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('horarioId', ParseIntPipe) horarioId: number,
    @Body() dto: AvisoAlumnosDto,
  ) {
    return this.reuniones.avisoAlumnos(
      req.user.id,
      id,
      horarioId,
      dto.avisarAlumnos,
    );
  }

  /** El acta subida, para verla en la app (`inline`) o descargarla. */
  @Get(':id/documento/:formato')
  @Roles('DOCENTE', 'JEFE_CARRERA')
  async documento(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Param('formato', new ParseEnumPipe(FormatoDocumentoReunion))
    formato: FormatoDocumentoReunion,
    @Query('descargar') descargar?: string,
  ) {
    const archivo = await this.reuniones.documento(req.user, id, formato);
    res.setHeader('Content-Type', archivo.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `${descargar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.send(archivo.contenido);
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
