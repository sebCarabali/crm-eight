import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { CreateMovementDto, MovementQueryDto } from './movement.dto';
import { MovementType, StockMovement } from './stock-movement.entity';
import { computeNewStock } from './stock-rules';

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(query: MovementQueryDto = {}): Promise<StockMovement[]> {
    const qb = this.movements
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.product', 'p')
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(query.limit ?? 100);
    if (query.productId) qb.andWhere('p.id = :pid', { pid: query.productId });
    if (query.type) qb.andWhere('m.type = :type', { type: query.type });
    return qb.getMany();
  }

  /** Registra el movimiento y actualiza el stock del producto en una sola transacción. */
  create(dto: CreateMovementDto): Promise<StockMovement> {
    return this.dataSource.transaction(async (em) => {
      const product = await em.findOneBy(Product, { id: dto.productId });
      if (!product) throw new NotFoundException(`Producto ${dto.productId} no encontrado`);

      const previousStock = product.stock;
      const newStock = computeNewStock(previousStock, dto.type, dto.quantity);

      product.stock = newStock;
      await em.save(product);

      return em.save(
        em.create(StockMovement, {
          product,
          type: dto.type,
          quantity: dto.quantity,
          previousStock,
          newStock,
          unitPrice: dto.type === MovementType.SALE ? (dto.unitPrice ?? product.price) : null,
          reason: dto.reason?.trim() || null,
        }),
      );
    });
  }
}
