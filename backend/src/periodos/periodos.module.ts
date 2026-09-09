import { Module } from '@nestjs/common';
import { PeriodosService } from './periodos.service';
import { PeriodosController } from './periodos.controller';

@Module({
  providers: [PeriodosService],
  controllers: [PeriodosController],
  exports: [PeriodosService],
})
export class PeriodosModule {}
