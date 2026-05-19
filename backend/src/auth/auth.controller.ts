import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión (email, username o número de control)',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  me(@Request() req: any) {
    return req.user;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.auth.changePassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Iniciar sesión con Google (redirige a Google)' })
  googleAuth() {
    // Passport redirige automáticamente a Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  googleCallback(@Request() req: any, @Res() res: Response) {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    try {
      const result = req.user as
        | { status: 'login'; access_token: string }
        | { status: 'pending'; pendingToken: string; nombre: string; email: string };

      if (result.status === 'login') {
        return res.redirect(
          `${frontendUrl}/auth/callback?token=${result.access_token}`,
        );
      }

      // Usuario nuevo: redirigir al formulario de registro con datos pre-rellenados
      const params = new URLSearchParams({
        pending_token: result.pendingToken,
        google_nombre: result.nombre ?? '',
        google_email: result.email ?? '',
      });
      return res.redirect(`${frontendUrl}/registro?${params.toString()}`);
    } catch {
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }
}
