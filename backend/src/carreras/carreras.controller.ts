import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CarrerasService } from './carreras.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCarreraDto } from './dto/create-carrera.dto';
import { parseReticulaFile } from './reticula-import';
import { reticulaUploadOptions } from './reticula-upload';

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
  @UseInterceptors(FileInterceptor('reticula', reticulaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nombre', 'codigo', 'reticula'],
      properties: {
        nombre: { type: 'string' },
        codigo: { type: 'string' },
        planEstudios: { type: 'string' },
        reticula: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Crear carrera con su retícula (admin)' })
  async create(
    @Body() dto: CreateCarreraDto,
    @UploadedFile() reticula?: Express.Multer.File,
  ) {
    if (!reticula) {
      throw new BadRequestException(
        'Debes adjuntar la retícula para crear la carrera',
      );
    }
    const materias = await parseReticulaFile(reticula, dto.codigo);
    return this.carreras.create(dto, materias);
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
