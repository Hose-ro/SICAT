import { Module } from '@nestjs/common';
import { ClasesController } from './clases.controller';
import { ClasesService } from './clases.service';
import { RecordatoriosClaseService } from './recordatorios-clase.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [NotificacionesModule],
  controllers: [ClasesController],
  providers: [ClasesService, RecordatoriosClaseService],
  exports: [ClasesService],
})
export class ClasesModule {}
