import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AcademiasService } from './academias.service';
import { CreateAcademiaDto } from './dto/create-academia.dto';
import { UpdateAcademiaDto } from './dto/update-academia.dto';
import { AsignarDocentesDto } from './dto/asignar-docentes.dto';
import { AsignarMateriasDto } from './dto/asignar-materias.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Academias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('academias')
export class AcademiasController {
  constructor(private academias: AcademiasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear academia' })
  create(@Body() dto: CreateAcademiaDto) {
    return this.academias.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar academias activas' })
  findAll() {
    return this.academias.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de academia con docentes y materias' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.academias.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar academia' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAcademiaDto,
  ) {
    return this.academias.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar academia (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.academias.remove(id);
  }

  @Post(':id/docentes')
  @ApiOperation({ summary: 'Asignar docentes a la academia' })
  asignarDocentes(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarDocentesDto,
  ) {
    return this.academias.asignarDocentes(id, dto.docenteIds);
  }

  @Delete(':id/docentes/:docenteId')
  @ApiOperation({ summary: 'Quitar docente de la academia' })
  quitarDocente(
    @Param('id', ParseIntPipe) academiaId: number,
    @Param('docenteId', ParseIntPipe) docenteId: number,
  ) {
    return this.academias.quitarDocente(academiaId, docenteId);
  }

  @Post(':id/materias')
  @ApiOperation({ summary: 'Asignar materias a la academia' })
  asignarMaterias(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarMateriasDto,
  ) {
    return this.academias.asignarMaterias(id, dto.materiaIds);
  }

  @Delete(':id/materias/:materiaId')
  @ApiOperation({ summary: 'Quitar materia de la academia' })
  quitarMateria(
    @Param('id', ParseIntPipe) academiaId: number,
    @Param('materiaId', ParseIntPipe) materiaId: number,
  ) {
    return this.academias.quitarMateria(academiaId, materiaId);
  }

  @Get(':id/docentes')
  @ApiOperation({ summary: 'Listar docentes de la academia' })
  getDocentes(@Param('id', ParseIntPipe) id: number) {
    return this.academias.getDocentes(id);
  }

  @Get(':id/materias')
  @ApiOperation({ summary: 'Listar materias de la academia' })
  getMaterias(@Param('id', ParseIntPipe) id: number) {
    return this.academias.getMaterias(id);
  }
}
