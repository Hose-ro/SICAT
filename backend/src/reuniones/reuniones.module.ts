import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import {
  ReunionesController,
  ReunionesJefaturaController,
} from './reuniones.controller';
import { ReunionesService } from './reuniones.service';

@Module({
  imports: [NotificacionesModule],
  controllers: [ReunionesJefaturaController, ReunionesController],
  providers: [ReunionesService],
})
export class ReunionesModule {}
