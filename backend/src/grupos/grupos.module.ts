import { Module } from '@nestjs/common';
import { GruposController } from './grupos.controller';
import { GruposService } from './grupos.service';
import { HorariosModule } from '../horarios/horarios.module';

@Module({
  imports: [HorariosModule],
  controllers: [GruposController],
  providers: [GruposService],
  exports: [GruposService],
})
export class GruposModule {}
