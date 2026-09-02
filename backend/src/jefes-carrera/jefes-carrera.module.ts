import { Module } from '@nestjs/common';
import { JefesCarreraController } from './jefes-carrera.controller';
import { JefesCarreraService } from './jefes-carrera.service';

@Module({
  controllers: [JefesCarreraController],
  providers: [JefesCarreraService],
})
export class JefesCarreraModule {}
