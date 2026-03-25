import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CarrerasService } from './carreras.service';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateCarreraDto {
  @ApiProperty() @IsNotEmpty() @IsString() nombre: string;
  @ApiProperty() @IsNotEmpty() @IsString() codigo: string;
}

@ApiTags('Carreras')
@Controller('carreras')
export class CarrerasController {
  constructor(private carreras: CarrerasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar carreras' })
  findAll() {
    return this.carreras.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear carrera (admin)' })
  create(@Body() dto: CreateCarreraDto) {
    return this.carreras.create(dto.nombre, dto.codigo);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar carrera (admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.carreras.remove(id);
  }
}
