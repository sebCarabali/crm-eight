import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MovementType } from './stock-movement.entity';

export class CreateMovementDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  productId: number;

  @ApiProperty({ enum: MovementType, example: MovementType.IN })
  @IsEnum(MovementType)
  type: MovementType;

  @ApiProperty({
    example: 5,
    description: 'Unidades compradas (IN) o vendidas (SALE). En ADJUST es el stock final contado.',
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({
    example: 2500,
    description:
      'Venta (SALE): precio de venta unitario, por defecto el del producto. ' +
      'Compra (IN): costo unitario, por defecto el costo del producto. No aplica a ajustes.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'Compra a proveedor' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class SalesQueryDto {
  @ApiPropertyOptional({ description: 'Desde (fecha/hora ISO 8601, inclusive)', example: '2026-11-01T05:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (fecha/hora ISO 8601, exclusiva)', example: '2026-12-01T05:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;
}

export class MovementQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
