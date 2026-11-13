import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FiltroDto } from '../registros/dto';
import { Compra, Producto, VentaCliente, VentaMostrador } from '../registros/entidades';

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Clave para agrupar productos con el mismo nombre aunque cambien mayúsculas, tildes o espacios
 * ("Cerdito Alcancía" = "cerdito alcancia").
 */
export function claveProducto(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const enRango = (fecha: string, f: FiltroDto) => (!f.desde || fecha >= f.desde) && (!f.hasta || fecha <= f.hasta);

export interface ProductoStock {
  /** Interno: id si el producto se creó en la app (permite editarlo o eliminarlo). */
  id: number | null;
  producto: string;
  /** Cantidad del Excel (hoja Inventario): stock inicial. */
  cantidad: number;
  /** Compras registradas en la app (empiezan en 0). */
  comprado: number;
  /** Ventas registradas en la app (empiezan en 0). */
  vendido: number;
  /** Cantidad + Comprado − Vendido. */
  stock: number;
  /** Interno (no se muestra): último precio de venta, para proponerlo al registrar una venta. */
  ultimoPrecioVenta: number | null;
  /** Interno (no se muestra): último precio de compra. */
  ultimoPrecioCompra: number | null;
}

export interface ResumenCliente {
  cliente: string;
  cantidadCompras: number;
  unidadesCompradas: number;
  totalComprado: number;
}

export type ConceptoCaja = 'VENTA_MOSTRADOR' | 'VENTA_CLIENTE' | 'COMPRA';

export interface MovimientoCaja {
  id: number;
  concepto: ConceptoCaja;
  fecha: string;
  detalle: string;
  tercero: string;
  pago: string;
  cantidad: number;
  valor: number;
  saldo: number;
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(VentaMostrador) private readonly mostrador: Repository<VentaMostrador>,
    @InjectRepository(VentaCliente) private readonly clientes: Repository<VentaCliente>,
    @InjectRepository(Compra) private readonly compras: Repository<Compra>,
    @InjectRepository(Producto) private readonly productosCreados: Repository<Producto>,
  ) {}

  private async todo() {
    const orden = { id: 'ASC' } as const;
    const [m, c, p, creados] = await Promise.all([
      this.mostrador.find({ order: orden }),
      this.clientes.find({ order: orden }),
      this.compras.find({ order: orden }),
      this.productosCreados.find({ order: orden }),
    ]);
    return { mostrador: m, clientes: c, compras: p, creados };
  }

  /**
   * Stock por producto:
   *  - Cantidad: la de la hoja Inventario del Excel (stock inicial).
   *  - Comprado / Vendido: solo lo registrado en la app (empiezan en 0); las ventas del Excel no descuentan.
   *  - Stock = Cantidad + Comprado − Vendido (puede quedar negativo).
   * Incluye los productos del Inventario y los que tengan compras o ventas registradas en la app.
   */
  private async todosLosProductos(q?: string): Promise<(ProductoStock & { enStock: boolean })[]> {
    const { mostrador, clientes, compras, creados } = await this.todo();
    type Fila = Omit<ProductoStock, 'producto' | 'stock'> & { nombres: Map<string, number>; enStock: boolean; nombreCreado?: string };
    const mapa = new Map<string, Fila>();
    const fila = (nombre: string) => {
      const clave = claveProducto(nombre);
      let p = mapa.get(clave);
      if (!p) {
        p = { id: null, cantidad: 0, comprado: 0, vendido: 0, ultimoPrecioVenta: null, ultimoPrecioCompra: null, nombres: new Map(), enStock: false };
        mapa.set(clave, p);
      }
      p.nombres.set(nombre, (p.nombres.get(nombre) ?? 0) + 1);
      return p;
    };
    // Productos creados en la app: su Cantidad es stock inicial y su nombre es el que se muestra.
    for (const pc of creados) {
      const p = fila(pc.producto);
      p.id = pc.id;
      p.cantidad += pc.cantidad;
      p.enStock = true;
      p.nombreCreado = pc.producto;
    }
    for (const c of compras) {
      const p = fila(c.descripcion);
      if (c.importado) p.cantidad += c.cantidad;
      else p.comprado += c.cantidad;
      p.enStock = true;
      p.ultimoPrecioCompra = c.precioUnitario;
    }
    // Ventas en orden de fecha, para quedarse con el último precio.
    const ventas = [
      ...mostrador.map((v) => ({ nombre: v.producto, fecha: v.fecha, cantidad: v.cantidad, precio: v.valorUnitario, importado: v.importado })),
      ...clientes.map((v) => ({ nombre: v.descripcion, fecha: v.fecha, cantidad: v.cantidad, precio: v.precioUnitario, importado: v.importado })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const v of ventas) {
      const p = fila(v.nombre);
      p.ultimoPrecioVenta = v.precio;
      if (v.importado) continue; // ventas del Excel: no descuentan del stock
      p.vendido += v.cantidad;
      p.enStock = true;
    }
    const filtro = q ? claveProducto(q) : '';
    return [...mapa.entries()]
      .filter(([clave]) => !filtro || clave.includes(filtro))
      .map(([, p]) => ({
        id: p.id,
        // Nombre a mostrar: el del producto creado o, si no, la forma en que más se escribió.
        producto: p.nombreCreado ?? [...p.nombres.entries()].sort((a, b) => b[1] - a[1])[0][0],
        cantidad: p.cantidad,
        comprado: p.comprado,
        vendido: p.vendido,
        stock: p.cantidad + p.comprado - p.vendido,
        ultimoPrecioVenta: p.ultimoPrecioVenta,
        ultimoPrecioCompra: p.ultimoPrecioCompra,
        enStock: p.enStock,
      }))
      .sort((a, b) => a.producto.localeCompare(b.producto, 'es'));
  }

  /**
   * Verifica que haya existencias para vender `cantidad` unidades de `nombre`.
   * `devolver` = unidades que ya estaban vendidas en la misma fila (al editar una venta) y vuelven al stock.
   * Lanza un error de inexistencia si no hay unidades o no alcanzan.
   */
  async verificarExistencias(nombre: string, cantidad: number, devolver = 0): Promise<void> {
    const clave = claveProducto(nombre);
    const producto = (await this.todosLosProductos()).find((p) => claveProducto(p.producto) === clave);
    const disponible = (producto?.stock ?? 0) + devolver;
    if (disponible <= 0) {
      throw new BadRequestException(`Inexistencia: no hay unidades de "${nombre}" en el inventario.`);
    }
    if (cantidad > disponible) {
      throw new BadRequestException(
        `Existencias insuficientes de "${nombre}": hay ${disponible} y se intentan vender ${cantidad}.`,
      );
    }
  }

  /** Nombres normalizados de todos los productos conocidos (compras, ventas y creados). */
  async nombresConocidos(): Promise<Set<string>> {
    const { mostrador, clientes, compras, creados } = await this.todo();
    return new Set(
      [...mostrador.map((v) => v.producto), ...clientes.map((v) => v.descripcion), ...compras.map((c) => c.descripcion), ...creados.map((p) => p.producto)].map(
        claveProducto,
      ),
    );
  }

  /** Tabla de stock (sin los productos que solo aparecen en ventas importadas del Excel). */
  async productos(q?: string): Promise<ProductoStock[]> {
    return (await this.todosLosProductos(q)).filter((p) => p.enStock).map(({ enStock: _e, ...p }) => p);
  }

  /**
   * Hoja "Resumen clientes": por cliente, Cantidad de compras (filas), Unidades compradas y Total comprado.
   * Mismo orden del Excel (primera aparición).
   */
  async resumenClientes(filtro: FiltroDto = {}): Promise<ResumenCliente[]> {
    const ventas = await this.clientes.find({ order: { id: 'ASC' } });
    const mapa = new Map<string, ResumenCliente>();
    for (const v of ventas) {
      if (!enRango(v.fecha, filtro)) continue;
      const r = mapa.get(v.cliente) ?? { cliente: v.cliente, cantidadCompras: 0, unidadesCompradas: 0, totalComprado: 0 };
      r.cantidadCompras += 1;
      r.unidadesCompradas += v.cantidad;
      r.totalComprado = redondear(r.totalComprado + v.valorTotal);
      mapa.set(v.cliente, r);
    }
    const lista = [...mapa.values()];
    return filtro.q ? lista.filter((r) => claveProducto(r.cliente).includes(claveProducto(filtro.q!))) : lista;
  }

  /** Caja: ventas (mostrador + clientes) suman, compras restan. Saldo acumulado por fecha. */
  async caja(filtro: FiltroDto = {}) {
    const { mostrador, clientes, compras } = await this.todo();
    const movimientos: Omit<MovimientoCaja, 'saldo'>[] = [
      ...mostrador.map((v) => ({
        id: v.id,
        concepto: 'VENTA_MOSTRADOR' as const,
        fecha: v.fecha,
        detalle: v.producto,
        tercero: '',
        pago: v.pagoNequi > 0 && v.pagoEfectivo > 0 ? 'Efectivo + Nequi' : v.pagoNequi > 0 ? 'Nequi' : 'Efectivo',
        cantidad: v.cantidad,
        valor: v.valorTotal,
      })),
      ...clientes.map((v) => ({
        id: v.id,
        concepto: 'VENTA_CLIENTE' as const,
        fecha: v.fecha,
        detalle: v.descripcion,
        tercero: v.cliente,
        pago: v.condicionesPago,
        cantidad: v.cantidad,
        valor: v.valorTotal,
      })),
      ...compras.map((c) => ({
        id: c.id,
        concepto: 'COMPRA' as const,
        fecha: c.fechaFactura,
        detalle: c.descripcion,
        tercero: c.proveedor,
        pago: '',
        cantidad: c.cantidad,
        valor: -c.valorTotal,
      })),
    ]
      .filter((m) => enRango(m.fecha, filtro))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.concepto.localeCompare(b.concepto) || a.id - b.id);

    let saldo = 0;
    const totales = { ventasMostrador: 0, ventasClientes: 0, efectivo: 0, nequi: 0, compras: 0 };
    for (const v of mostrador) {
      if (!enRango(v.fecha, filtro)) continue;
      totales.efectivo += v.pagoEfectivo;
      totales.nequi += v.pagoNequi;
    }
    const conSaldo: MovimientoCaja[] = movimientos.map((m) => {
      saldo = redondear(saldo + m.valor);
      if (m.concepto === 'VENTA_MOSTRADOR') totales.ventasMostrador += m.valor;
      if (m.concepto === 'VENTA_CLIENTE') totales.ventasClientes += m.valor;
      if (m.concepto === 'COMPRA') totales.compras += -m.valor;
      return { ...m, saldo };
    });
    const ingresos = totales.ventasMostrador + totales.ventasClientes;
    return {
      totales: {
        ingresos: redondear(ingresos),
        ventasMostrador: redondear(totales.ventasMostrador),
        ventasClientes: redondear(totales.ventasClientes),
        efectivo: redondear(totales.efectivo),
        nequi: redondear(totales.nequi),
        egresos: redondear(totales.compras),
        saldo: redondear(ingresos - totales.compras),
      },
      movimientos: conSaldo.reverse(),
    };
  }

  /** Datos para la pantalla de inicio. */
  async resumen() {
    const [caja, productos, clientes] = await Promise.all([this.caja(), this.productos(), this.resumenClientes()]);
    const masVendidos = [...productos].sort((a, b) => b.vendido - a.vendido).slice(0, 8);
    const mejoresClientes = [...clientes].sort((a, b) => b.totalComprado - a.totalComprado).slice(0, 5);
    return {
      totales: caja.totales,
      productos: productos.length,
      productosStockNegativo: productos.filter((p) => p.stock < 0).length,
      clientes: clientes.length,
      masVendidos: masVendidos.map(({ producto, vendido }) => ({ producto, vendido })),
      mejoresClientes,
    };
  }

  /** Valores ya usados, para autocompletar los formularios. */
  async opciones() {
    const { mostrador, clientes, compras } = await this.todo();
    const unicos = (valores: string[]) => [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const productos = await this.todosLosProductos();
    return {
      productos: productos.map((p) => ({
        producto: p.producto,
        precioVenta: p.ultimoPrecioVenta,
        precioCompra: p.ultimoPrecioCompra,
        stock: p.stock,
      })),
      clientes: unicos(clientes.map((c) => c.cliente)),
      condicionesPago: unicos(['Contado', 'Nequi', 'Transferencia', ...clientes.map((c) => c.condicionesPago)]),
      proveedores: unicos(compras.map((c) => c.proveedor)),
      destinos: unicos(compras.map((c) => c.clienteDestino)),
      totalRegistros: mostrador.length + clientes.length + compras.length,
    };
  }
}
