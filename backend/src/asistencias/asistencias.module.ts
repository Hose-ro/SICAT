import { Module } from '@nestjs/common';
import { AsistenciasController } from './asistencias.controller';
import { AsistenciasService } from './asistencias.service';
import { ReportesModule } from '../reportes/reportes.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PeriodosModule } from '../periodos/periodos.module';

@Module({
  imports: [ReportesModule, NotificacionesModule, PeriodosModule],
  controllers: [AsistenciasController],
  providers: [AsistenciasService],
  exports: [AsistenciasService],
})
export class AsistenciasModule {}
