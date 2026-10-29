import { Module } from '@nestjs/common';
import { CalificacionesController } from './calificaciones.controller';
import { CalificacionesService } from './calificaciones.service';
import { CriteriosService } from './criterios.service';
import { CierreCursoController } from './cierre-curso.controller';
import { CierreCursoService } from './cierre-curso.service';
import { ReportesModule } from '../reportes/reportes.module';

@Module({
  imports: [ReportesModule],
  controllers: [CalificacionesController, CierreCursoController],
  providers: [CalificacionesService, CriteriosService, CierreCursoService],
  exports: [CalificacionesService, CriteriosService],
})
export class CalificacionesModule {}
