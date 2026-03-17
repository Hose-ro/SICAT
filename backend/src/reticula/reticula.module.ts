import { Module } from '@nestjs/common';
import { ReticulaService } from './reticula.service';
import { ReticulaController } from './reticula.controller';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReticulaController],
  providers: [ReticulaService],
  exports: [ReticulaService],
})
export class ReticulaModule {}
