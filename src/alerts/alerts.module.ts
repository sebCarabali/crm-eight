import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockMovement } from '../movements/stock-movement.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertRun, StockAlert } from './stock-alert.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockAlert, AlertRun, StockMovement])],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
