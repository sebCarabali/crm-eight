import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MONEY_COLUMN } from '../common/database';

/**
 * Cada entidad corresponde a una hoja del Excel de la tienda y solo tiene sus columnas
 * (más el id y la fecha de registro, que son internos y no se muestran).
 */

/** Hoja "Transcripcion_Vent": ventas de mostrador. */
@Entity('ventas_mostrador')
@Index(['fecha'])
export class VentaMostrador {
  @PrimaryGeneratedColumn()
  id: number;

  /** Fecha */
  @Column({ type: 'date' })
  fecha: string;

  /** Objeto / Producto */
  @Column({ length: 200 })
  producto: string;

  /** Cantidad */
  @Column({ type: MONEY_COLUMN })
  cantidad: number;

  /** Valor Unitario */
  @Column({ type: MONEY_COLUMN })
  valorUnitario: number;

  /** Valor Total (= Cantidad × Valor Unitario) */
  @Column({ type: MONEY_COLUMN })
  valorTotal: number;

  /** Pago Efectivo */
  @Column({ type: MONEY_COLUMN, default: 0 })
  pagoEfectivo: number;

  /** Pago Nequi */
  @Column({ type: MONEY_COLUMN, default: 0 })
  pagoNequi: number;

  /**
   * Interno (no se muestra): fila cargada desde el Excel. En el stock, la Cantidad de las compras
   * importadas es el stock inicial y las ventas importadas no descuentan.
   */
  @Column({ default: false })
  importado: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}

/** Hoja "Registro de Ventas": ventas a clientes. */
@Entity('ventas_clientes')
@Index(['fecha'])
export class VentaCliente {
  @PrimaryGeneratedColumn()
  id: number;

  /** Cliente */
  @Column({ length: 200 })
  cliente: string;

  /** Fecha */
  @Column({ type: 'date' })
  fecha: string;

  /** Condiciones / Pago */
  @Column({ length: 100 })
  condicionesPago: string;

  /** Cantidad */
  @Column({ type: MONEY_COLUMN })
  cantidad: number;

  /** Descripción del Artículo */
  @Column({ length: 200 })
  descripcion: string;

  /** Precio Unitario */
  @Column({ type: MONEY_COLUMN })
  precioUnitario: number;

  /** Valor Total (= Cantidad × Precio Unitario) */
  @Column({ type: MONEY_COLUMN })
  valorTotal: number;

  /**
   * Interno (no se muestra): fila cargada desde el Excel. En el stock, la Cantidad de las compras
   * importadas es el stock inicial y las ventas importadas no descuentan.
   */
  @Column({ default: false })
  importado: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}

/** Hoja "Inventario": compras a proveedores. */
@Entity('compras')
@Index(['fechaFactura'])
export class Compra {
  @PrimaryGeneratedColumn()
  id: number;

  /** Proveedor */
  @Column({ length: 200 })
  proveedor: string;

  /** Fecha Factura */
  @Column({ type: 'date' })
  fechaFactura: string;

  /** Cliente / Destino */
  @Column({ length: 200 })
  clienteDestino: string;

  /** Cantidad */
  @Column({ type: MONEY_COLUMN })
  cantidad: number;

  /** Descripción del Artículo */
  @Column({ length: 200 })
  descripcion: string;

  /** Precio Unitario */
  @Column({ type: MONEY_COLUMN })
  precioUnitario: number;

  /** Valor Total (= Cantidad × Precio Unitario) */
  @Column({ type: MONEY_COLUMN })
  valorTotal: number;

  /**
   * Interno (no se muestra): fila cargada desde el Excel. En el stock, la Cantidad de las compras
   * importadas es el stock inicial y las ventas importadas no descuentan.
   */
  @Column({ default: false })
  importado: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}

/**
 * Producto creado en la app: nombre y Cantidad (stock inicial), igual que un artículo de la hoja Inventario.
 * Su stock se mueve con las compras y ventas registradas con el mismo nombre.
 */
@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  /** Producto */
  @Column({ length: 200 })
  producto: string;

  /** Interno: nombre normalizado (sin tildes, mayúsculas ni espacios extra) para evitar duplicados. */
  @Column({ length: 200, unique: true })
  clave: string;

  /** Cantidad (stock inicial) */
  @Column({ type: MONEY_COLUMN, default: 0 })
  cantidad: number;

  @CreateDateColumn()
  creadoEn: Date;
}

export const ENTIDADES = [VentaMostrador, VentaCliente, Compra, Producto];
