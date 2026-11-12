import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  /** Código único del producto (Stock Keeping Unit). */
  @Column({ unique: true, length: 50 })
  sku: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'real', default: 0 })
  price: number;

  /** Existencias actuales. Solo cambia a través de movimientos de stock. */
  @Column({ type: 'integer', default: 0 })
  stock: number;

  /** Cuando stock <= minStock, el producto se considera en stock bajo. */
  @Column({ type: 'integer', default: 0 })
  minStock: number;

  @ManyToOne(() => Category, (category) => category.products, { nullable: true, eager: true })
  category: Category | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
