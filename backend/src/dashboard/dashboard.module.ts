import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ClasesModule } from '../clases/clases.module';
import { CalificacionesModule } from '../calificaciones/calificaciones.module';

@Module({
  imports: [ClasesModule, CalificacionesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
