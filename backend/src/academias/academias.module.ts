import { Module } from '@nestjs/common';
import { AcademiasController } from './academias.controller';
import { AcademiasService } from './academias.service';

@Module({
  controllers: [AcademiasController],
  providers: [AcademiasService],
})
export class AcademiasModule {}
