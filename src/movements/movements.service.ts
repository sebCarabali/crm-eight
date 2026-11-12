import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { CreateMovementDto, MovementQueryDto } from './movement.dto';
import { MovementType, StockMovement } from './stock-movement.entity';
import { computeNewStock } from './stock-rules';

/**
 * Movimientos que cuentan como venta (entra dinero). OUT se conserva solo por compatibilidad:
 * las salidas son ventas y se guardan como SALE.
 */
export const PRICED_TYPES: MovementType[] = [MovementType.SALE, MovementType.OUT];

/** Tipos de movimiento que mueven dinero: ventas (+) y compras (−). */
export const MONEY_TYPES: MovementType[] = [MovementType.SALE, MovementType.OUT, MovementType.IN];

@Injectable()
export class MovementsService implements OnModuleInit {
  private readonly logger = new Logger(MovementsService.name);

  constructor(
    @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
    private readonly dataSource: DataSource,
  ) {}

  /** Migración: las salidas registradas antes (OUT) son ventas. */
  async onModuleInit() {
    const res = await this.movements.update({ type: MovementType.OUT }, { type: MovementType.SALE });
    if (res.affected) this.logger.log(`${res.affected} salida(s) antiguas convertidas en ventas`);
  }

  findAll(query: MovementQueryDto = {}): Promise<StockMovement[]> {
    const qb = this.movements
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.product', 'p')
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(query.limit ?? 100);
    if (query.productId) qb.andWhere('p.id = :pid', { pid: query.productId });
    if (query.type) {
      const types = query.type === MovementType.OUT || query.type === MovementType.SALE ? PRICED_TYPES : [query.type];
      qb.andWhere('m.type IN (:...types)', { types });
    }
    return qb.getMany();
  }

  /** Registra el movimiento y actualiza el stock del producto en una sola transacción. */
  create(dto: CreateMovementDto): Promise<StockMovement> {
    // Una salida es una venta.
    const type = dto.type === MovementType.OUT ? MovementType.SALE : dto.type;

    return this.dataSource.transaction(async (em) => {
      const product = await em.findOneBy(Product, { id: dto.productId });
      if (!product) throw new NotFoundException(`Producto ${dto.productId} no encontrado`);

      const previousStock = product.stock;
      const newStock = computeNewStock(previousStock, type, dto.quantity);

      product.stock = newStock;
      await em.save(product);

      return em.save(
        em.create(StockMovement, {
          product,
          type,
          quantity: dto.quantity,
          previousStock,
          newStock,
          unitPrice: this.unitPriceFor(type, dto.unitPrice, product),
          reason: dto.reason?.trim() || null,
        }),
      );
    });
  }

  /**
   * Venta: precio de venta (por defecto el del producto) → entra dinero.
   * Compra: costo unitario (por defecto el costo del producto) → sale dinero.
   * Ajuste: no mueve dinero.
   */
  private unitPriceFor(type: MovementType, given: number | undefined, product: Product): number | null {
    if (type === MovementType.SALE) return given ?? product.price;
    if (type === MovementType.IN) return given ?? (product.cost > 0 ? product.cost : null);
    return null;
  }
}
