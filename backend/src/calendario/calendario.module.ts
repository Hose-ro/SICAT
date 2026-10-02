import { Module } from '@nestjs/common';
import { PeriodosModule } from '../periodos/periodos.module';
import { CalendarioController } from './calendario.controller';
import { CalendarioService } from './calendario.service';

@Module({
  imports: [PeriodosModule],
  controllers: [CalendarioController],
  providers: [CalendarioService],
})
export class CalendarioModule {}
