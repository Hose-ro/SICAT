import { Module } from '@nestjs/common';
import { CalificacionesController } from './calificaciones.controller';
import { CalificacionesService } from './calificaciones.service';
import { CriteriosService } from './criterios.service';
import { ReportesModule } from '../reportes/reportes.module';

@Module({
  imports: [ReportesModule],
  controllers: [CalificacionesController],
  providers: [CalificacionesService, CriteriosService],
  exports: [CalificacionesService, CriteriosService],
})
export class CalificacionesModule {}
