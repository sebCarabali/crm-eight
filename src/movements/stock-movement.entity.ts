import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../products/product.entity';

export enum MovementType {
  /** Entrada: compra, devolución de cliente, etc. Suma al stock. */
  IN = 'IN',
  /** Salida: venta, consumo, merma. Resta del stock. */
  OUT = 'OUT',
  /** Ajuste por conteo físico: el stock queda exactamente en la cantidad indicada. */
  ADJUST = 'ADJUST',
  /** Venta: resta del stock como una salida y guarda el precio unitario cobrado. */
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

  /** Precio unitario (ventas y salidas). Se congela al momento del movimiento. */
  @Column({ type: 'real', nullable: true })
  unitPrice: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
