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
import { AsignarAulaDto } from './dto/asignar-aula.dto';
import { AsignarDocenteDto } from './dto/asignar-docente.dto';
import { CreateHorarioDto } from './dto/create-horario.dto';
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
  @ApiOperation({ summary: 'Crear un horario' })
  create(@Body() dto: CreateHorarioDto) {
    return this.horarios.create(dto);
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
  @ApiOperation({ summary: 'Validar si un horario tiene conflicto antes de guardar' })
  validarConflicto(@Body() dto: ValidarConflictoHorarioDto) {
    return this.horarios.validarConflicto(dto);
  }

  @Post('asignar-docente')
  @ApiOperation({ summary: 'Compatibilidad: asignar docente a los horarios activos de una materia' })
  asignarDocente(@Body() dto: AsignarDocenteDto) {
    return this.horarios.asignarDocente(dto.materiaId, dto.docenteId);
  }

  @Post('asignar-aula')
  @ApiOperation({ summary: 'Compatibilidad: asignar aula a los horarios activos de una materia' })
  asignarAula(@Body() dto: AsignarAulaDto) {
    return this.horarios.asignarAula(dto.materiaId, dto.aulaId);
  }

  @Delete('quitar-docente/:materiaId')
  @ApiOperation({ summary: 'Compatibilidad: quitar docente legado de una materia sin horarios activos' })
  quitarDocente(@Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.horarios.quitarDocente(materiaId);
  }

  @Delete('quitar-aula/:materiaId')
  @ApiOperation({ summary: 'Compatibilidad: quitar aula legado de una materia sin horarios activos' })
  quitarAula(@Param('materiaId', ParseIntPipe) materiaId: number) {
    return this.horarios.quitarAula(materiaId);
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

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un horario' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.horarios.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un horario' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHorarioDto) {
    return this.horarios.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un horario (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.horarios.remove(id);
  }
}
