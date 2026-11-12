import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { AlertsService } from './alerts.service';

class AlertsQueryDto {
  @ApiPropertyOptional({ example: '2026-11-12', description: 'Día (YYYY-MM-DD). Por defecto, hoy.' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date debe tener el formato YYYY-MM-DD' })
  date?: string;
}

class DaysQueryDto {
  @ApiPropertyOptional({ default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  limit?: number;
}

class ResolveAlertDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  resolved: boolean;
}

@ApiTags('alertas')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  /** Alertas de un día: productos con stock <= mínimo + margen. */
  @Get()
  findByDate(@Query() query: AlertsQueryDto) {
    return this.service.findByDate(query.date);
  }

  /** Últimos días con alertas y cuántas hubo de cada nivel. */
  @Get('days')
  days(@Query() query: DaysQueryDto) {
    return this.service.days(query.limit);
  }

  /** Genera (o actualiza) ya mismo las alertas de hoy con el stock actual. */
  @Post('generate')
  generate() {
    return this.service.generate(undefined);
  }

  /** Marca una alerta como atendida o pendiente. */
  @Patch(':id')
  resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveAlertDto) {
    return this.service.setResolved(id, dto.resolved);
  }
}
