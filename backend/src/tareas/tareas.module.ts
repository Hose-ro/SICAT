import { Module } from '@nestjs/common';
import { TareasController } from './tareas.controller';
import { TareasArchivosController } from './tareas-archivos.controller';
import { TareasService } from './tareas.service';
import { TareasCopiaService } from './tareas-copia.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ReportesModule } from '../reportes/reportes.module';

@Module({
  imports: [NotificacionesModule, ReportesModule],
  controllers: [TareasController, TareasArchivosController],
  providers: [TareasService, TareasCopiaService],
  exports: [TareasService],
})
export class TareasModule {}
