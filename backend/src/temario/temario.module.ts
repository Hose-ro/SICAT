import { Module } from '@nestjs/common';
import { PeriodosModule } from '../periodos/periodos.module';
import { TemarioController } from './temario.controller';
import { TemarioService } from './temario.service';

@Module({
  imports: [PeriodosModule],
  controllers: [TemarioController],
  providers: [TemarioService],
  exports: [TemarioService],
})
export class TemarioModule {}
