import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PeriodosModule } from '../periodos/periodos.module';
import { AvisosModule } from '../avisos/avisos.module';
import { ClasesJustificadasService } from './clases-justificadas.service';
import {
  ReunionesController,
  ReunionesJefaturaController,
} from './reuniones.controller';
import { ReunionesService } from './reuniones.service';

@Module({
  imports: [NotificacionesModule, PeriodosModule, AvisosModule],
  controllers: [ReunionesJefaturaController, ReunionesController],
  providers: [ReunionesService, ClasesJustificadasService],
})
export class ReunionesModule {}
