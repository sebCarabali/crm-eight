import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReportesService, claveProducto } from '../reportes/reportes.service';
import { ObjectLiteral, Repository } from 'typeorm';
import {
  ActualizarCompraDto,
  ActualizarVentaClienteDto,
  ActualizarVentaMostradorDto,
  CrearCompraDto,
  CrearVentaClienteDto,
  CrearVentaMostradorDto,
  FiltroDto,
} from './dto';
import { Compra, VentaCliente, VentaMostrador } from './entidades';

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Al editar una venta registrada en la app, verifica existencias para el producto y la cantidad nuevos.
 * Las unidades que la fila ya tenía vendidas del mismo producto vuelven al stock disponible.
 * Las ventas importadas del Excel no descuentan stock, así que no se verifican.
 */
async function verificarEdicion(
  reportes: ReportesService,
  actual: { importado: boolean; cantidad: number },
  nombreActual: string,
  nombreNuevo: string | undefined,
  cantidadNueva: number | undefined,
) {
  if (actual.importado || (nombreNuevo === undefined && cantidadNueva === undefined)) return;
  const nombre = nombreNuevo ?? nombreActual;
  const mismo = claveProducto(nombre) === claveProducto(nombreActual);
  // Mismo producto sin aumentar la cantidad (p. ej. corregir el precio): no pide unidades nuevas.
  if (mismo && (cantidadNueva ?? actual.cantidad) <= actual.cantidad) return;
  await reportes.verificarExistencias(nombre, cantidadNueva ?? actual.cantidad, mismo ? actual.cantidad : 0);
}

/** Listar / buscar / editar / borrar común a las tres hojas. */
abstract class Registros<T extends ObjectLiteral & { id: number; cantidad: number; valorTotal: number }> {
  protected abstract readonly nombre: string;
  /** Columna de fecha de la hoja. */
  protected abstract readonly campoFecha: string;
  /** Columnas de texto donde busca el filtro `q`. */
  protected abstract readonly camposTexto: string[];

  constructor(protected readonly repo: Repository<T>) {}

  listar(filtro: FiltroDto = {}): Promise<T[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .orderBy(`r.${this.campoFecha}`, 'DESC')
      .addOrderBy('r.id', 'DESC');
    if (filtro.desde) qb.andWhere(`r.${this.campoFecha} >= :desde`, { desde: filtro.desde });
    if (filtro.hasta) qb.andWhere(`r.${this.campoFecha} <= :hasta`, { hasta: filtro.hasta });
    if (filtro.q) {
      const cond = this.camposTexto.map((c) => `LOWER(r.${c}) LIKE :q`).join(' OR ');
      qb.andWhere(`(${cond})`, { q: `%${filtro.q.toLowerCase()}%` });
    }
    return qb.getMany();
  }

  async obtener(id: number): Promise<T> {
    const fila = await this.repo.findOneBy({ id } as never);
    if (!fila) throw new NotFoundException(`${this.nombre} ${id} no encontrada`);
    return fila;
  }

  async eliminar(id: number): Promise<void> {
    await this.repo.remove(await this.obtener(id));
  }
}

@Injectable()
export class VentasMostradorService extends Registros<VentaMostrador> {
  protected readonly nombre = 'Venta de mostrador';
  protected readonly campoFecha = 'fecha';
  protected readonly camposTexto = ['producto'];

  constructor(
    @InjectRepository(VentaMostrador) repo: Repository<VentaMostrador>,
    private readonly reportes: ReportesService,
  ) {
    super(repo);
  }

  async crear(dto: CrearVentaMostradorDto) {
    await this.reportes.verificarExistencias(dto.producto, dto.cantidad);
    return this.repo.save(this.repo.create(this.completar(dto)));
  }

  async actualizar(id: number, dto: ActualizarVentaMostradorDto) {
    const actual = await this.obtener(id);
    await verificarEdicion(this.reportes, actual, actual.producto, dto.producto, dto.cantidad);
    const cambiaValor = dto.cantidad !== undefined || dto.valorUnitario !== undefined;
    const sinPagos = dto.pagoEfectivo === undefined && dto.pagoNequi === undefined;
    const base = { ...actual, ...dto };
    // Si cambia el valor y no se indican pagos, se conserva la forma de pago (todo en el medio que tenía más).
    if (cambiaValor && sinPagos) {
      const total = redondear(base.cantidad * base.valorUnitario);
      const nequi = actual.pagoNequi > actual.pagoEfectivo;
      base.pagoEfectivo = nequi ? 0 : total;
      base.pagoNequi = nequi ? total : 0;
    }
    return this.repo.save(Object.assign(actual, this.completar(base)));
  }

  /** Calcula el Valor Total y reparte el pago entre efectivo y Nequi (deben sumar el total). */
  private completar<D extends Partial<CrearVentaMostradorDto> & { cantidad: number; valorUnitario: number }>(dto: D) {
    const valorTotal = redondear(dto.cantidad * dto.valorUnitario);
    let efectivo = dto.pagoEfectivo;
    let nequi = dto.pagoNequi;
    if (efectivo === undefined && nequi === undefined) efectivo = valorTotal;
    if (efectivo === undefined) efectivo = redondear(valorTotal - (nequi ?? 0));
    if (nequi === undefined) nequi = redondear(valorTotal - efectivo);
    if (efectivo < 0 || nequi < 0 || Math.abs(efectivo + nequi - valorTotal) > 0.005) {
      throw new BadRequestException(
        `Pago Efectivo + Pago Nequi debe ser igual al Valor Total (${valorTotal})`,
      );
    }
    return { ...dto, valorTotal, pagoEfectivo: efectivo, pagoNequi: nequi };
  }
}

@Injectable()
export class VentasClientesService extends Registros<VentaCliente> {
  protected readonly nombre = 'Venta a cliente';
  protected readonly campoFecha = 'fecha';
  protected readonly camposTexto = ['cliente', 'descripcion', 'condicionesPago'];

  constructor(
    @InjectRepository(VentaCliente) repo: Repository<VentaCliente>,
    private readonly reportes: ReportesService,
  ) {
    super(repo);
  }

  async crear(dto: CrearVentaClienteDto) {
    await this.reportes.verificarExistencias(dto.descripcion, dto.cantidad);
    return this.repo.save(this.repo.create({ ...dto, valorTotal: redondear(dto.cantidad * dto.precioUnitario) }));
  }

  async actualizar(id: number, dto: ActualizarVentaClienteDto) {
    const actual = await this.obtener(id);
    await verificarEdicion(this.reportes, actual, actual.descripcion, dto.descripcion, dto.cantidad);
    Object.assign(actual, dto);
    actual.valorTotal = redondear(actual.cantidad * actual.precioUnitario);
    return this.repo.save(actual);
  }
}

@Injectable()
export class ComprasService extends Registros<Compra> {
  protected readonly nombre = 'Compra';
  protected readonly campoFecha = 'fechaFactura';
  protected readonly camposTexto = ['proveedor', 'descripcion', 'clienteDestino'];

  constructor(@InjectRepository(Compra) repo: Repository<Compra>) {
    super(repo);
  }

  crear(dto: CrearCompraDto) {
    return this.repo.save(this.repo.create({ ...dto, valorTotal: redondear(dto.cantidad * dto.precioUnitario) }));
  }

  async actualizar(id: number, dto: ActualizarCompraDto) {
    const actual = await this.obtener(id);
    Object.assign(actual, dto);
    actual.valorTotal = redondear(actual.cantidad * actual.precioUnitario);
    return this.repo.save(actual);
  }
}
