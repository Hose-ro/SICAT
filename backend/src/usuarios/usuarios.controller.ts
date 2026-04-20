import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RegisterDto } from '../auth/dto/register.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private usuarios: UsuariosService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear usuario (admin)' })
  create(@Body() dto: RegisterDto) {
    return this.usuarios.create(dto);
  }

  @Get()
  @Roles('ADMIN')
  @ApiQuery({
    name: 'rol',
    required: false,
    enum: ['ADMIN', 'DOCENTE', 'ALUMNO'],
  })
  @ApiOperation({ summary: 'Listar usuarios (admin)' })
  findAll(@Query('rol') rol?: string) {
    return this.usuarios.findAll(rol);
  }

  @Get('perfil')
  @ApiOperation({ summary: 'Mi perfil' })
  perfil(@Request() req: any) {
    return this.usuarios.findOne(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver usuario por ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    if (req.user.rol !== 'ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('No puedes consultar este usuario');
    }
    return this.usuarios.findOne(id);
  }

  @Patch('perfil')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  updatePerfil(@Request() req: any, @Body() dto: any) {
    const { password, rol, ...safe } = dto;
    return this.usuarios.update(req.user.id, safe);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar usuario (admin)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.usuarios.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar usuario (admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.remove(id);
  }
}
