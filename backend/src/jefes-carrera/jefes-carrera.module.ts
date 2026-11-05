import { Module } from '@nestjs/common';
import { CalificacionesModule } from '../calificaciones/calificaciones.module';
import { SupervisionController } from './supervision.controller';
import { SupervisionService } from './supervision.service';
import { SeguimientosService } from './seguimientos.service';
import { InformeService } from './informe.service';
import { ReporteParcialController } from './reporte-parcial.controller';
import { ReporteParcialService } from './reporte-parcial.service';
import { ReporteAcademicoController } from './reporte-academico.controller';
import { ReporteAcademicoService } from './reporte-academico.service';

@Module({
  imports: [CalificacionesModule],
  controllers: [SupervisionController, ReporteParcialController, ReporteAcademicoController],
  providers: [
    SupervisionService,
    SeguimientosService,
    InformeService,
    ReporteParcialService,
    ReporteAcademicoService,
  ],
})
export class JefesCarreraModule {}
