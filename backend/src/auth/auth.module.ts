import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthMailService } from './auth-mail.service';
import {
  AUTH_JWT_ALGORITHM,
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
  AUTH_SESSION_TTL_SECONDS,
} from './auth-session.constants';
import { HorarioImportacionesModule } from '../horario-importaciones/horario-importaciones.module';

@Module({
  imports: [
    PassportModule,
    UsuariosModule,
    HorarioImportacionesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: AUTH_JWT_ALGORITHM,
          audience: AUTH_JWT_AUDIENCE,
          issuer: AUTH_JWT_ISSUER,
          expiresIn: AUTH_SESSION_TTL_SECONDS,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthMailService],
  exports: [AuthService],
})
export class AuthModule {}
