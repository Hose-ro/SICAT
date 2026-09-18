import { Module } from '@nestjs/common';
import { JefesCarreraController } from './jefes-carrera.controller';
import { JefesCarreraService } from './jefes-carrera.service';
import { PeriodosModule } from '../periodos/periodos.module';

@Module({
  imports: [PeriodosModule],
  controllers: [JefesCarreraController],
  providers: [JefesCarreraService],
})
export class JefesCarreraModule {}
