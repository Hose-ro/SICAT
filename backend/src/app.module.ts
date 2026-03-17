import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
