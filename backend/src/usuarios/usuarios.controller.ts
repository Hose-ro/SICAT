import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RegisterDto } from '../auth/dto/register.dto';
import { AsignarCarrerasJefeDto } from './dto/asignar-carreras-jefe.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';

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
  @ApiOperation({ summary: 'Listar usuarios (admin)' })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usuarios.findAll(query.rol);
  }

  @Get('perfil')
  @ApiOperation({ summary: 'Mi perfil' })
  perfil(@Req() req: AuthenticatedRequest) {
    return this.usuarios.findOne(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver usuario por ID' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.user.rol !== 'ADMIN' && req.user.id !== id) {
      throw new ForbiddenException('No puedes consultar este usuario');
    }
    return this.usuarios.findOne(id);
  }

  @Get(':id/auth-audit')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Consultar eventos de autenticación del usuario' })
  findAuthAudit(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.findAuthAudit(id);
  }

  @Patch('perfil')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  updatePerfil(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    return this.usuarios.updateOwnProfile(req.user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar usuario (admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuarios.updateByAdmin(id, dto, req.user.id);
  }

  @Put(':id/carreras-jefe')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Asignar carreras a un jefe de carrera' })
  asignarCarrerasJefe(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarCarrerasJefeDto,
  ) {
    return this.usuarios.asignarCarrerasJefe(id, dto.carreraIds);
  }

  @Post(':id/aprobar-registro')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Aprobar el registro público de un alumno' })
  approveRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuarios.approveRegistration(id, req.user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar usuario (admin)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuarios.remove(id, req.user.id);
  }
}
