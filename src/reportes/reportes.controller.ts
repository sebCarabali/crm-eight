import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FiltroDto } from '../registros/dto';
import { ReportesService } from './reportes.service';

@ApiTags('reportes')
@Controller()
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  /** Stock por producto: compras − ventas (mostrador + clientes). */
  @Get('productos')
  productos(@Query() filtro: FiltroDto) {
    return this.service.productos(filtro.q);
  }

  /** Hoja "Resumen clientes": cantidad de compras, unidades y total por cliente. */
  @Get('clientes/resumen')
  resumenClientes(@Query() filtro: FiltroDto) {
    return this.service.resumenClientes(filtro);
  }

  /** Caja: ingresos por ventas, egresos por compras y saldo. */
  @Get('caja')
  caja(@Query() filtro: FiltroDto) {
    return this.service.caja(filtro);
  }

  /** Datos de la pantalla de inicio. */
  @Get('resumen')
  resumen() {
    return this.service.resumen();
  }

  /** Valores existentes para autocompletar (productos, clientes, proveedores…). */
  @Get('opciones')
  opciones() {
    return this.service.opciones();
  }
}
