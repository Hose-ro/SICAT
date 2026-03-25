import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { MateriasService } from './materias.service';
import { CreateMateriaDto } from './dto/create-materia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Materias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('materias')
export class MateriasController {
  constructor(private materias: MateriasService) {}

  @Post()
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Crear materia (admin puede asignar docente)' })
  create(@Body() dto: CreateMateriaDto, @Request() req: any) {
    const docenteId =
      req.user.rol === 'DOCENTE' ? req.user.id : (dto.docenteId ?? null);
    return this.materias.create(dto, docenteId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar materias (filtros opcionales: carreraId, semestre)',
  })
  findAll(
    @Query('carreraId') carreraId?: string,
    @Query('semestre') semestre?: string,
    @Query('docenteId') docenteId?: string,
  ) {
    return this.materias.findAll(
      carreraId ? Number(carreraId) : undefined,
      semestre ? Number(semestre) : undefined,
      docenteId ? Number(docenteId) : undefined,
    );
  }

  @Get('mis-materias')
  @Roles('DOCENTE', 'ADMIN')
  @ApiOperation({ summary: 'Materias del docente autenticado' })
  misMaterias(@Request() req: any) {
    return this.materias.findByDocente(req.user.id);
  }

  @Get('para-alumno')
  @Roles('ALUMNO')
  @ApiOperation({
    summary: 'Materias disponibles según carrera y semestre del alumno',
  })
  paraAlumno(@Request() req: any) {
    return this.materias.findForAlumno(req.user.id);
  }

  @Get('clave/:clave')
  @ApiOperation({ summary: 'Buscar materia por clave (ej: RSB-2403)' })
  findByClave(@Param('clave') clave: string) {
    return this.materias.findByClave(clave);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalle de materia' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.materias.findOne(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar materia (admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.materias.remove(id);
  }
}
