import { Module } from '@nestjs/common';
import { PeriodosService } from './periodos.service';
import { PeriodosController } from './periodos.controller';
import { AvisosModule } from '../avisos/avisos.module';

@Module({
  imports: [AvisosModule],
  providers: [PeriodosService],
  controllers: [PeriodosController],
  exports: [PeriodosService],
})
export class PeriodosModule {}
