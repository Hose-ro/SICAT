import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GruposService } from './grupos.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { AsignarAlumnosDto } from './dto/asignar-alumnos.dto';
import { ModificarMateriasDto } from './dto/modificar-materias.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Grupos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('grupos')
export class GruposController {
  constructor(private grupos: GruposService) {}

  // ─── CRUD básico ─────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Crear grupo (auto-asigna materias de la retícula)' })
  crear(@Body() dto: CreateGrupoDto) {
    return this.grupos.crearGrupo(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar grupos con filtros opcionales' })
  @ApiQuery({ name: 'carreraId', required: false, type: Number })
  @ApiQuery({ name: 'semestre', required: false, type: Number })
  @ApiQuery({ name: 'periodo', required: false, type: String })
  listar(
    @Query('carreraId') carreraId?: string,
    @Query('semestre') semestre?: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.grupos.listarGrupos({
      carreraId: carreraId ? Number(carreraId) : undefined,
      semestre: semestre ? Number(semestre) : undefined,
      periodo,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del grupo con alumnos y materias' })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.obtenerGrupo(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar sección/periodo del grupo' })
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGrupoDto) {
    return this.grupos.editarGrupo(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar grupo (soft delete)' })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.eliminarGrupo(id);
  }

  // ─── Alumnos ──────────────────────────────────────────────────────────────────

  @Post(':id/alumnos')
  @ApiOperation({ summary: 'Asignar alumnos al grupo' })
  asignarAlumnos(@Param('id', ParseIntPipe) id: number, @Body() dto: AsignarAlumnosDto) {
    return this.grupos.asignarAlumnos(id, dto.alumnoIds);
  }

  @Delete(':id/alumnos/:alumnoId')
  @ApiOperation({ summary: 'Quitar un alumno del grupo' })
  quitarAlumno(
    @Param('id', ParseIntPipe) grupoId: number,
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
  ) {
    return this.grupos.quitarAlumno(grupoId, alumnoId);
  }

  @Get(':id/alumnos')
  @ApiOperation({ summary: 'Listar alumnos del grupo' })
  getAlumnos(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.getAlumnos(id);
  }

  // ─── Materias ─────────────────────────────────────────────────────────────────

  @Post(':id/materias')
  @ApiOperation({ summary: 'Agregar materias al grupo' })
  agregarMaterias(@Param('id', ParseIntPipe) id: number, @Body() dto: ModificarMateriasDto) {
    return this.grupos.agregarMaterias(id, dto.materiaIds);
  }

  @Delete(':id/materias/:materiaId')
  @ApiOperation({ summary: 'Quitar una materia del grupo' })
  quitarMateria(
    @Param('id', ParseIntPipe) grupoId: number,
    @Param('materiaId', ParseIntPipe) materiaId: number,
  ) {
    return this.grupos.quitarMateria(grupoId, materiaId);
  }

  @Get(':id/materias')
  @ApiOperation({ summary: 'Listar materias del grupo' })
  getMaterias(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.getMaterias(id);
  }

  @Get(':id/horario')
  @ApiOperation({ summary: 'Horario completo del grupo' })
  obtenerHorario(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.obtenerHorario(id);
  }

  @Get(':id/reticula-status')
  @ApiOperation({ summary: 'Estado de la retícula para el grupo (ASIGNADA/DISPONIBLE/FALTANTE)' })
  getReticulaStatus(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.getReticulaStatus(id);
  }
}
