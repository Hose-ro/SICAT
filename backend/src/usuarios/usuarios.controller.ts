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
  Res,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RegisterDto } from '../auth/dto/register.dto';
import { AsignarCarrerasJefeDto } from './dto/asignar-carreras-jefe.dto';
import { EliminarUsuariosDto } from './dto/eliminar-usuarios.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { fotoPerfilUploadOptions } from './foto-perfil';

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

  @Put('perfil/foto')
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @UseInterceptors(FileInterceptor('foto', fotoPerfilUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cambiar mi foto de perfil (JPG, PNG o WebP)' })
  guardarFoto(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.usuarios.guardarFotoPerfil(req.user.id, foto);
  }

  @Delete('perfil/foto')
  @ApiOperation({ summary: 'Quitar mi foto de perfil' })
  quitarFoto(@Req() req: AuthenticatedRequest) {
    return this.usuarios.quitarFotoPerfil(req.user.id);
  }

  @Get(':id/foto')
  @ApiOperation({ summary: 'Foto de perfil de un usuario' })
  async foto(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const foto = await this.usuarios.leerFotoPerfil(req.user, id);
    const etag = `"${foto.huella}"`;
    // Con ?v= igual a la huella vigente la URL nunca cambia de contenido;
    // sin ella el navegador revalida. `private`: nunca en cachés compartidos.
    const cacheControl =
      req.query.v === foto.huella
        ? 'private, max-age=31536000, immutable'
        : 'private, no-cache';
    res.set({
      'Cache-Control': cacheControl,
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-site',
      'Content-Disposition': 'inline; filename="foto-perfil.webp"',
    });
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.type(foto.mime).send(foto.contenido);
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

  @Delete('lote')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar varios usuarios definitivamente (admin)' })
  removeManyPermanently(
    @Body() dto: EliminarUsuariosDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuarios.removeManyPermanently(dto.usuarioIds, req.user.id);
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

  @Delete(':id/permanente')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar usuario definitivamente (admin)' })
  removePermanently(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuarios.removePermanently(id, req.user.id);
  }
}
