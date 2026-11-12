import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateMovementDto, MovementQueryDto } from './movement.dto';
import { MovementsService } from './movements.service';

@ApiTags('movimientos')
@Controller('movements')
export class MovementsController {
  constructor(private readonly service: MovementsService) {}

  @Get()
  findAll(@Query() query: MovementQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateMovementDto) {
    return this.service.create(dto);
  }
}
