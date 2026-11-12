import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'LAP-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku: string;

  @ApiProperty({ example: 'Laptop 14"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 2500, description: 'Precio de venta' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 1800, default: 0, description: 'Costo de compra al proveedor' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ example: 5, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @IsInt()
  categoryId?: number | null;

  @ApiPropertyOptional({
    example: 10,
    description: 'Stock inicial; se registra como inventario inicial (ajuste), no como compra: no afecta la caja',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;
}

/** El stock no se edita directamente: solo con movimientos. */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['initialStock'] as const)) {}

export class ProductQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Solo productos con stock <= stock mínimo' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  lowStock?: boolean;
}
