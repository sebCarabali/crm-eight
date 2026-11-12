import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../products/product.entity';

export enum MovementType {
  /** Compra (entrada): suma al stock y sale dinero (costo unitario). */
  IN = 'IN',
  /** Obsoleto: una salida es una venta y se registra como SALE. */
  OUT = 'OUT',
  /** Ajuste por conteo físico o inventario inicial: fija el stock, no mueve dinero. */
  ADJUST = 'ADJUST',
  /** Venta (salida): resta del stock y entra dinero (precio de venta). */
  SALE = 'SALE',
}

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, { nullable: false, eager: true })
  product: Product;

  @Column({ type: 'varchar', length: 10 })
  type: MovementType;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'integer' })
  previousStock: number;

  @Column({ type: 'integer' })
  newStock: number;

  /**
   * Valor unitario: precio de venta en ventas, costo en compras; null si no mueve dinero.
   * Se congela al momento del movimiento.
   */
  @Column({ type: 'real', nullable: true })
  unitPrice: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
