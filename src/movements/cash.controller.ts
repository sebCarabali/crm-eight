import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CashService } from './cash.service';
import { SalesQueryDto } from './movement.dto';

/**
 * Caja: ingresos por ventas (+), egresos por compras (−) y saldo del periodo.
 */
@ApiTags('caja')
@Controller('cash')
export class CashController {
  constructor(private readonly service: CashService) {}

  @Get()
  report(@Query() query: SalesQueryDto) {
    return this.service.report(query);
  }
}
