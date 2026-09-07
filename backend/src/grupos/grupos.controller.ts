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
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { GruposService } from './grupos.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { AsignarAlumnosDto } from './dto/asignar-alumnos.dto';
import { ModificarMateriasDto } from './dto/modificar-materias.dto';
import { AsignarAulaGrupoDto } from './dto/asignar-aula-grupo.dto';
import { AgregarGrupoDocenteDto } from './dto/agregar-grupo-docente.dto';
import { CrearAlumnoGrupoDto } from './dto/crear-alumno-grupo.dto';
import { ImportarAlumnosGrupoDto } from './dto/importar-alumnos-grupo.dto';
import { CompletarAlumnoGrupoDto } from './dto/completar-alumno-grupo.dto';
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
  @ApiOperation({
    summary: 'Crear grupo (auto-asigna materias de la retícula)',
  })
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

  @Get('catalogo')
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({
    summary: 'Listado breve de grupos para elegir al programar una clase',
  })
  @ApiQuery({ name: 'carreraId', required: false, type: Number })
  @ApiQuery({ name: 'semestre', required: false, type: Number })
  @ApiQuery({ name: 'periodo', required: false, type: String })
  catalogo(
    @Query('carreraId') carreraId?: string,
    @Query('semestre') semestre?: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.grupos.listarCatalogo({
      carreraId: carreraId ? Number(carreraId) : undefined,
      semestre: semestre ? Number(semestre) : undefined,
      periodo,
    });
  }

  @Get('mis-grupos')
  @Roles('DOCENTE')
  @ApiOperation({
    summary: 'Grupos del docente: los de su horario y los que agregó a mano',
  })
  misGrupos(@Request() req: any) {
    return this.grupos.listarGruposDocente(req.user.id);
  }

  @Post('mis-grupos')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Agregar a mis grupos uno que ya existe' })
  agregarMiGrupo(@Body() dto: AgregarGrupoDocenteDto, @Request() req: any) {
    return this.grupos.agregarGrupoDocente(req.user.id, dto.grupoId);
  }

  @Get('mis-grupos/:id')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Detalle de uno de mis grupos con sus alumnos' })
  miGrupo(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.grupos.obtenerGrupoDocente(id, req.user.id);
  }

  @Delete('mis-grupos/:id')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Quitar de mis grupos uno que agregué a mano' })
  quitarMiGrupo(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.grupos.quitarGrupoDocente(req.user.id, id);
  }

  @Get('mis-grupos/:id/alumnos-disponibles')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Alumnos de la carrera que puedo agregar al grupo' })
  @ApiQuery({ name: 'q', required: false, type: String })
  alumnosParaMiGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Query('q') q?: string,
  ) {
    return this.grupos.buscarAlumnosParaGrupo(id, req.user.id, q);
  }

  @Post('mis-grupos/:id/alumnos')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Agregar alumnos existentes a mi grupo' })
  agregarAlumnosAMiGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarAlumnosDto,
    @Request() req: any,
  ) {
    return this.grupos.agregarAlumnosAMiGrupo(id, req.user.id, dto.alumnoIds);
  }

  @Post('mis-grupos/:id/alumnos/nuevo')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Dar de alta un alumno nuevo en mi grupo' })
  crearAlumnoEnMiGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearAlumnoGrupoDto,
    @Request() req: any,
  ) {
    return this.grupos.crearAlumnoEnMiGrupo(id, req.user.id, dto);
  }

  @Post('mis-grupos/:id/alumnos/importar')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Importar la lista de alumnos del grupo' })
  importarAlumnosAMiGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ImportarAlumnosGrupoDto,
    @Request() req: any,
  ) {
    return this.grupos.importarAlumnosAMiGrupo(id, req.user.id, dto);
  }

  @Delete('mis-grupos/:id/alumnos/:alumnoId')
  @Roles('DOCENTE')
  @ApiOperation({ summary: 'Quitar un alumno de mi grupo' })
  quitarAlumnoDeMiGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Request() req: any,
  ) {
    return this.grupos.quitarAlumnoDeMiGrupo(id, req.user.id, alumnoId);
  }

  @Patch('mis-grupos/:id/alumnos/:alumnoId')
  @Roles('DOCENTE')
  @ApiOperation({
    summary: 'Completar o corregir los datos de un alumno de mi grupo',
  })
  actualizarAlumnoDeMiGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Param('alumnoId', ParseIntPipe) alumnoId: number,
    @Body() dto: CompletarAlumnoGrupoDto,
    @Request() req: any,
  ) {
    return this.grupos.actualizarAlumnoDeMiGrupo(id, req.user.id, alumnoId, dto);
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

  @Delete(':id/permanente')
  @ApiOperation({ summary: 'Eliminar grupo definitivamente' })
  eliminarDefinitivo(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.eliminarGrupoDefinitivo(id);
  }

  // ─── Alumnos ──────────────────────────────────────────────────────────────────

  @Post(':id/alumnos')
  @ApiOperation({ summary: 'Asignar alumnos al grupo' })
  asignarAlumnos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarAlumnosDto,
  ) {
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
  agregarMaterias(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModificarMateriasDto,
  ) {
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

  @Patch(':id/aula')
  @ApiOperation({
    summary:
      'Asignar aula al grupo: a todas sus clases o solo al bloque indicado (aulaId: null para quitarla)',
  })
  asignarAula(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarAulaGrupoDto,
  ) {
    return this.grupos.asignarAula(id, dto.aulaId, dto.horarioId);
  }

  @Get(':id/reticula-status')
  @ApiOperation({
    summary:
      'Estado de la retícula para el grupo (ASIGNADA/DISPONIBLE/FALTANTE)',
  })
  getReticulaStatus(@Param('id', ParseIntPipe) id: number) {
    return this.grupos.getReticulaStatus(id);
  }
}
