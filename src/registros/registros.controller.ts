import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ActualizarCompraDto,
  ActualizarProductoDto,
  ActualizarVentaClienteDto,
  ActualizarVentaMostradorDto,
  CrearCompraDto,
  CrearVentaClienteDto,
  CrearProductoDto,
  CrearVentaMostradorDto,
  FiltroDto,
} from './dto';
import { ProductosService } from './productos.service';
import { ComprasService, VentasClientesService, VentasMostradorService } from './registros.service';

@ApiTags('ventas de mostrador')
@Controller('ventas-mostrador')
export class VentasMostradorController {
  constructor(private readonly service: VentasMostradorService) {}

  @Get() listar(@Query() filtro: FiltroDto) { return this.service.listar(filtro); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) { return this.service.obtener(id); }
  @Post() crear(@Body() dto: CrearVentaMostradorDto) { return this.service.crear(dto); }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarVentaMostradorDto) {
    return this.service.actualizar(id, dto);
  }
  @Delete(':id') @HttpCode(204) eliminar(@Param('id', ParseIntPipe) id: number) { return this.service.eliminar(id); }
}

@ApiTags('ventas a clientes')
@Controller('ventas-clientes')
export class VentasClientesController {
  constructor(private readonly service: VentasClientesService) {}

  @Get() listar(@Query() filtro: FiltroDto) { return this.service.listar(filtro); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) { return this.service.obtener(id); }
  @Post() crear(@Body() dto: CrearVentaClienteDto) { return this.service.crear(dto); }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarVentaClienteDto) {
    return this.service.actualizar(id, dto);
  }
  @Delete(':id') @HttpCode(204) eliminar(@Param('id', ParseIntPipe) id: number) { return this.service.eliminar(id); }
}

@ApiTags('compras (inventario)')
@Controller('compras')
export class ComprasController {
  constructor(private readonly service: ComprasService) {}

  @Get() listar(@Query() filtro: FiltroDto) { return this.service.listar(filtro); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) { return this.service.obtener(id); }
  @Post() crear(@Body() dto: CrearCompraDto) { return this.service.crear(dto); }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarCompraDto) {
    return this.service.actualizar(id, dto);
  }
  @Delete(':id') @HttpCode(204) eliminar(@Param('id', ParseIntPipe) id: number) { return this.service.eliminar(id); }
}

/** Crear, editar y eliminar productos (la lista con el stock está en GET /api/productos). */
@ApiTags('productos')
@Controller('productos')
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) { return this.service.obtener(id); }
  @Post() crear(@Body() dto: CrearProductoDto) { return this.service.crear(dto); }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarProductoDto) {
    return this.service.actualizar(id, dto);
  }
  @Delete(':id') @HttpCode(204) eliminar(@Param('id', ParseIntPipe) id: number) { return this.service.eliminar(id); }
}
