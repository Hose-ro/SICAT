import { Module } from '@nestjs/common';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ReportesModule } from '../reportes/reportes.module';

@Module({
  imports: [NotificacionesModule, ReportesModule],
  controllers: [TareasController],
  providers: [TareasService],
  exports: [TareasService],
})
export class TareasModule {}
