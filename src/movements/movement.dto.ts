import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
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
    description: 'Unidades a sumar (IN) o restar (OUT). En ADJUST es el stock final contado.',
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ example: 'Compra a proveedor' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
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
