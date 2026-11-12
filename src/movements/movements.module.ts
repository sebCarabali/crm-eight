import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { StockMovement } from './stock-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockMovement])],
  controllers: [MovementsController, SalesController],
  providers: [MovementsService, SalesService],
})
export class MovementsModule {}
