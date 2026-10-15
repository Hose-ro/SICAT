import { Module } from '@nestjs/common';
import { CalificacionesModule } from '../calificaciones/calificaciones.module';
import { SupervisionController } from './supervision.controller';
import { SupervisionService } from './supervision.service';
import { SeguimientosService } from './seguimientos.service';
import { InformeService } from './informe.service';

@Module({
  imports: [CalificacionesModule],
  controllers: [SupervisionController],
  providers: [SupervisionService, SeguimientosService, InformeService],
})
export class JefesCarreraModule {}
