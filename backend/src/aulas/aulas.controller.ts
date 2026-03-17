import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AulasService } from './aulas.service';
import { CreateAulaDto } from './dto/create-aula.dto';
import { UpdateAulaDto } from './dto/update-aula.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Aulas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('aulas')
export class AulasController {
  constructor(private aulas: AulasService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear aula' })
  create(@Body() dto: CreateAulaDto) {
    return this.aulas.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las aulas activas' })
  findAll() {
    return this.aulas.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un aula' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.aulas.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar aula' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAulaDto) {
    return this.aulas.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar aula (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.aulas.remove(id);
  }
}
