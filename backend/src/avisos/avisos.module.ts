import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AvisosController } from './avisos.controller';
import { AvisosService } from './avisos.service';

@Module({
  imports: [NotificacionesModule],
  controllers: [AvisosController],
  providers: [AvisosService],
  exports: [AvisosService],
})
export class AvisosModule {}
