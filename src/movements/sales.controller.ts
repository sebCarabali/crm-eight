import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesQueryDto } from './movement.dto';
import { SalesService } from './sales.service';

/**
 * Reporte de ventas: incluye ventas (SALE) y salidas de productos (OUT).
 * Para registrar una venta se usa POST /api/movements con type = SALE (o OUT).
 */
@ApiTags('ventas')
@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Get()
  report(@Query() query: SalesQueryDto) {
    return this.service.report(query);
  }
}
