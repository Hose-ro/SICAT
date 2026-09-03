import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActualizarClaseDto } from './dto/actualizar-clase.dto';
import { AsignarAulaDto } from './dto/asignar-aula.dto';
import { AsignarDocenteDto } from './dto/asignar-docente.dto';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { EliminarClaseDto } from './dto/eliminar-clase.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';
import { ValidarConflictoHorarioDto } from './dto/validar-conflicto-horario.dto';
import { HorariosService } from './horarios.service';

@ApiTags('Horarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('horarios')
export class HorariosController {
  constructor(private readonly horarios: HorariosService) {}

  @Post()
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Crear un horario' })
  create(@Body() dto: CreateHorarioDto, @Request() req: any) {
    return this.horarios.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar horarios con filtros opcionales' })
  @ApiQuery({ name: 'materiaId', required: false, type: Number })
  @ApiQuery({ name: 'docenteId', required: false, type: Number })
  @ApiQuery({ name: 'aulaId', required: false, type: Number })
  @ApiQuery({ name: 'grupoId', required: false, type: Number })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  findAll(
    @Query('materiaId') materiaId?: string,
    @Query('docenteId') docenteId?: string,
    @Query('aulaId') aulaId?: string,
    @Query('grupoId') grupoId?: string,
    @Query('activo') activo?: string,
  ) {
    return this.horarios.findAll({
      materiaId: materiaId ? Number(materiaId) : undefined,
      docenteId: docenteId ? Number(docenteId) : undefined,
      aulaId: aulaId ? Number(aulaId) : undefined,
      grupoId: grupoId ? Number(grupoId) : undefined,
      activo: activo === undefined ? undefined : activo === 'true',
    });
  }

  @Post('validar-conflicto')
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({
    summary: 'Validar si un horario tiene conflicto antes de guardar',
  })
  validarConflicto(
    @Body() dto: ValidarConflictoHorarioDto,
    @Request() req: any,
  ) {
    return this.horarios.validarConflicto(dto, req.user);
  }

  @Post('asignar-docente')
  @ApiOperation({
    summary:
      'Compatibilidad: asignar docente a los horarios activos de una materia',
  })
  asignarDocente(@Body() dto: AsignarDocenteDto) {
    return this.horarios.asignarDocente(dto.materiaId, dto.docenteId);
  }

  @Post('asignar-aula')
  @ApiOperation({
    summary:
      'Compatibilidad: asignar aula a los horarios activos de una materia',
  })
  asignarAula(@Body() dto: AsignarAulaDto) {
    return this.horarios.asignarAula(dto.materiaId, dto.aulaId);
  }

  @Delete('quitar-docente/:materiaId')
  @ApiOperation({
    summary:
      'Compatibilidad: quitar docente legado de una materia sin horarios activos',
  })
  quitarDocente(@Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.horarios.quitarDocente(materiaId);
  }

  @Delete('quitar-aula/:materiaId')
  @ApiOperation({
    summary:
      'Compatibilidad: quitar aula legado de una materia sin horarios activos',
  })
  quitarAula(@Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.horarios.quitarAula(materiaId);
  }

  @Get('mis-horarios')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Horario del docente autenticado' })
  misHorarios(@Request() req: any) {
    return this.horarios.obtenerHorarioDocente(req.user.id);
  }

  @Get('mis-horarios-alumno')
  @Roles('ALUMNO', 'ADMIN')
  @ApiOperation({ summary: 'Horario del grupo del alumno autenticado' })
  misHorariosAlumno(@Request() req: any) {
    return this.horarios.obtenerHorarioAlumno(req.user.id);
  }

  @Get('docente/:docenteId')
  @ApiOperation({ summary: 'Horario completo de un docente' })
  horarioDocente(@Param('docenteId', ParseIntPipe) docenteId: number) {
    return this.horarios.obtenerHorarioDocente(docenteId);
  }

  @Get('aula/:aulaId')
  @ApiOperation({ summary: 'Horario completo de un aula' })
  horarioAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.horarios.obtenerHorarioAula(aulaId);
  }

  @Get('grupo/:grupoId')
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Horario completo de un grupo' })
  horarioGrupo(@Param('grupoId', ParseIntPipe) grupoId: number) {
    return this.horarios.obtenerHorarioGrupo(grupoId);
  }

  @Get('sin-docente')
  @ApiOperation({ summary: 'Materias sin horarios activos' })
  sinDocente() {
    return this.horarios.obtenerMateriasSinDocente();
  }

  @Get('sin-aula')
  @ApiOperation({ summary: 'Materias sin horarios activos' })
  sinAula() {
    return this.horarios.obtenerMateriasSinAula();
  }

  @Get('ocupacion')
  @ApiOperation({ summary: 'Bloques ocupados para un docente y/o aula' })
  @ApiQuery({ name: 'docenteId', required: false, type: Number })
  @ApiQuery({ name: 'aulaId', required: false, type: Number })
  ocupacion(
    @Query('docenteId') docenteId?: string,
    @Query('aulaId') aulaId?: string,
  ) {
    return this.horarios.obtenerOcupacion(
      docenteId ? Number(docenteId) : undefined,
      aulaId ? Number(aulaId) : undefined,
    );
  }

  @Patch('clase')
  @ApiOperation({
    summary:
      'Actualizar una clase completa: reconcilia los días (actualiza, agrega y retira bloques)',
  })
  @Roles('ADMIN', 'DOCENTE')
  actualizarClase(@Body() dto: ActualizarClaseDto, @Request() req: any) {
    return this.horarios.actualizarClase(dto, req.user);
  }

  @Delete('clase')
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Eliminar una clase completa con todos sus días' })
  eliminarClase(@Body() dto: EliminarClaseDto, @Request() req: any) {
    return this.horarios.eliminarClase(dto.horarioIds, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un horario' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.horarios.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Editar un horario' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioDto,
    @Request() req: any,
  ) {
    return this.horarios.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Eliminar un horario (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.horarios.remove(id, req.user);
  }
}
