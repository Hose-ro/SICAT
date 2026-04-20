import { Module } from '@nestjs/common';
import { MateriasController } from './materias.controller';
import { MateriasService } from './materias.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [NotificacionesModule],
  controllers: [MateriasController],
  providers: [MateriasService],
})
export class MateriasModule {}
