import { Module } from '@nestjs/common';
import { JefesCarreraController } from './jefes-carrera.controller';
import { JefesCarreraService } from './jefes-carrera.service';
import { PeriodosModule } from '../periodos/periodos.module';
import { CalificacionesModule } from '../calificaciones/calificaciones.module';
import { SupervisionController } from './supervision.controller';
import { SupervisionService } from './supervision.service';

@Module({
  imports: [PeriodosModule, CalificacionesModule],
  controllers: [JefesCarreraController, SupervisionController],
  providers: [JefesCarreraService, SupervisionService],
})
export class JefesCarreraModule {}
