import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ClasesModule } from '../clases/clases.module';

@Module({
  imports: [ClasesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
