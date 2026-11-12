import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../products/product.entity';

export enum AlertLevel {
  /** Stock en cero. */
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  /** Stock en el mínimo o por debajo. */
  BELOW_MIN = 'BELOW_MIN',
  /** Stock a pocas unidades del mínimo (mínimo + margen). */
  NEAR_MIN = 'NEAR_MIN',
}

/** Calcula el nivel de alerta de un producto; null si no requiere alerta. */
export function alertLevelFor(stock: number, minStock: number, margin: number): AlertLevel | null {
  if (stock <= 0) return AlertLevel.OUT_OF_STOCK;
  if (stock <= minStock) return AlertLevel.BELOW_MIN;
  if (stock <= minStock + margin) return AlertLevel.NEAR_MIN;
  return null;
}

/** Una alerta de stock de un producto en un día. */
@Entity('stock_alerts')
@Index(['date', 'product'], { unique: true })
export class StockAlert {
  @PrimaryGeneratedColumn()
  id: number;

  /** Día de la alerta (hora local de la tienda), YYYY-MM-DD. */
  @Column({ length: 10 })
  date: string;

  @ManyToOne(() => Product, { nullable: false, eager: true })
  product: Product;

  @Column({ type: 'varchar', length: 20 })
  level: AlertLevel;

  /** Stock cuando se generó la alerta. */
  @Column({ type: 'integer' })
  stock: number;

  @Column({ type: 'integer' })
  minStock: number;

  @Column({ type: 'integer' })
  margin: number;

  /** Marcada como atendida (p. ej. ya se hizo el pedido). */
  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

/** Registro de cada generación diaria (también cuando no hubo alertas). */
@Entity('alert_runs')
export class AlertRun {
  @PrimaryColumn({ length: 10 })
  date: string;

  @Column({ type: 'datetime' })
  generatedAt: Date;

  @Column({ type: 'integer' })
  count: number;
}
