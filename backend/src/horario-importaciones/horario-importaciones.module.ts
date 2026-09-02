import { Module } from '@nestjs/common';
import {
  HorarioImportacionesController,
  HorarioImportacionesPublicController,
} from './horario-importaciones.controller';
import { HorarioImportacionesService } from './horario-importaciones.service';
import { HorarioVisionService } from './horario-vision.service';

@Module({
  controllers: [
    HorarioImportacionesController,
    HorarioImportacionesPublicController,
  ],
  providers: [HorarioImportacionesService, HorarioVisionService],
  exports: [HorarioImportacionesService],
})
export class HorarioImportacionesModule {}
