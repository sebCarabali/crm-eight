import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_MSG = 'La fecha debe tener el formato AAAA-MM-DD';
const limpiar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value);

// ---------- Ventas de mostrador ----------
export class CrearVentaMostradorDto {
  @ApiProperty({ example: '2026-07-28' })
  @Matches(FECHA, { message: FECHA_MSG })
  fecha: string;

  @ApiProperty({ example: 'Pinturas', description: 'Objeto / Producto' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  producto: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiProperty({ example: 3500 })
  @IsNumber()
  @Min(0)
  valorUnitario: number;

  @ApiPropertyOptional({ example: 17500, description: 'Si no se envían los pagos, todo se registra en efectivo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pagoEfectivo?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pagoNequi?: number;
}
export class ActualizarVentaMostradorDto extends PartialType(CrearVentaMostradorDto) {}

// ---------- Ventas a clientes ----------
export class CrearVentaClienteDto {
  @ApiProperty({ example: 'Leidy Potosí' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  cliente: string;

  @ApiProperty({ example: '2026-08-11' })
  @Matches(FECHA, { message: FECHA_MSG })
  fecha: string;

  @ApiProperty({ example: 'Contado', description: 'Condiciones / Pago' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  condicionesPago: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiProperty({ example: 'Cerdito', description: 'Descripción del Artículo' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @ApiProperty({ example: 5200 })
  @IsNumber()
  @Min(0)
  precioUnitario: number;
}
export class ActualizarVentaClienteDto extends PartialType(CrearVentaClienteDto) {}

// ---------- Compras (Inventario) ----------
export class CrearCompraDto {
  @ApiProperty({ example: 'Vivian Romero (F1)' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  proveedor: string;

  @ApiProperty({ example: '2026-04-06' })
  @Matches(FECHA, { message: FECHA_MSG })
  fechaFactura: string;

  @ApiProperty({ example: 'Linci Marín', description: 'Cliente / Destino' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clienteDestino: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @ApiProperty({ example: 'Pokémon Matera', description: 'Descripción del Artículo' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @ApiProperty({ example: 1900 })
  @IsNumber()
  @Min(0)
  precioUnitario: number;
}
export class ActualizarCompraDto extends PartialType(CrearCompraDto) {}

// ---------- Productos ----------
export class CrearProductoDto {
  @ApiProperty({ example: 'Cerdito Alcancía' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  producto: string;

  @ApiProperty({ example: 10, description: 'Cantidad (stock inicial)' })
  @IsNumber()
  @Min(0)
  cantidad: number;
}
export class ActualizarProductoDto extends PartialType(CrearProductoDto) {}

// ---------- Filtros ----------
export class FiltroDto {
  @ApiPropertyOptional({ example: '2026-08-01', description: 'Desde (AAAA-MM-DD, inclusive)' })
  @IsOptional()
  @Matches(FECHA, { message: FECHA_MSG })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'Hasta (AAAA-MM-DD, inclusive)' })
  @IsOptional()
  @Matches(FECHA, { message: FECHA_MSG })
  hasta?: string;

  @ApiPropertyOptional({ description: 'Texto a buscar (producto, cliente, proveedor…)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
