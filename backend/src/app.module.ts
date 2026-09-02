import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { MateriasModule } from './materias/materias.module';
import { AsistenciasModule } from './asistencias/asistencias.module';
import { TareasModule } from './tareas/tareas.module';
import { InscripcionesModule } from './inscripciones/inscripciones.module';
import { UnidadesModule } from './unidades/unidades.module';
import { ClasesModule } from './clases/clases.module';
import { CarrerasModule } from './carreras/carreras.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { AulasModule } from './aulas/aulas.module';
import { HorariosModule } from './horarios/horarios.module';
import { AcademiasModule } from './academias/academias.module';
import { GruposModule } from './grupos/grupos.module';
import { ReticulaModule } from './reticula/reticula.module';
import { ReportesModule } from './reportes/reportes.module';
import { JefesCarreraModule } from './jefes-carrera/jefes-carrera.module';
import { CalificacionesModule } from './calificaciones/calificaciones.module';
import { HorarioImportacionesModule } from './horario-importaciones/horario-importaciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const secret = config.JWT_SECRET;
        if (typeof secret !== 'string' || secret.length < 24) {
          throw new Error(
            'JWT_SECRET es obligatorio y debe contener al menos 24 caracteres',
          );
        }
        if (config.NODE_ENV === 'production' && secret.length < 32) {
          throw new Error(
            'JWT_SECRET debe contener al menos 32 caracteres en producción',
          );
        }
        const frontendUrl = config.FRONTEND_URL;
        if (
          config.NODE_ENV === 'production' &&
          (typeof frontendUrl !== 'string' || !/^https:\/\//.test(frontendUrl))
        ) {
          throw new Error(
            'FRONTEND_URL es obligatorio y debe usar HTTPS en producción',
          );
        }
        const emailAuthEnabled = config.AUTH_EMAIL_ENABLED === 'true';
        if (
          config.NODE_ENV === 'production' &&
          emailAuthEnabled &&
          (typeof config.MAIL_HOST !== 'string' ||
            typeof config.MAIL_FROM !== 'string')
        ) {
          throw new Error(
            'MAIL_HOST y MAIL_FROM son obligatorios cuando AUTH_EMAIL_ENABLED=true',
          );
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    MateriasModule,
    AsistenciasModule,
    TareasModule,
    InscripcionesModule,
    UnidadesModule,
    ClasesModule,
    CarrerasModule,
    SolicitudesModule,
    NotificacionesModule,
    AulasModule,
    HorariosModule,
    AcademiasModule,
    GruposModule,
    ReticulaModule,
    ReportesModule,
    JefesCarreraModule,
    CalificacionesModule,
    HorarioImportacionesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
