import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { StockMovement } from './stock-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockMovement])],
  controllers: [MovementsController, SalesController, CashController],
  providers: [MovementsService, SalesService, CashService],
})
export class MovementsModule {}
