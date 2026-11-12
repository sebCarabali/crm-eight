import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesQueryDto } from './movement.dto';
import { MovementType, StockMovement } from './stock-movement.entity';

export interface SaleRow {
  id: number;
  createdAt: Date;
  product: { id: number; sku: string; name: string };
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string | null;
}

export interface TopProduct {
  productId: number;
  sku: string;
  name: string;
  units: number;
  revenue: number;
}

export interface SalesReport {
  totals: { revenue: number; units: number; count: number; averageTicket: number };
  topProducts: TopProduct[];
  sales: SaleRow[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
  ) {}

  /** Ventas en un rango de fechas con totales y productos más vendidos. */
  async report(query: SalesQueryDto = {}): Promise<SalesReport> {
    const qb = this.movements
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.product', 'p')
      .where('m.type = :type', { type: MovementType.SALE })
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC');
    if (query.productId) qb.andWhere('p.id = :pid', { pid: query.productId });

    // El filtro de fechas se hace en memoria para no depender del formato
    // de fechas de SQLite; para un inventario pequeño/mediano es suficiente.
    const from = query.from ? new Date(query.from).getTime() : -Infinity;
    const to = query.to ? new Date(query.to).getTime() : Infinity;
    const rows = (await qb.getMany()).filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return t >= from && t < to;
    });

    const sales: SaleRow[] = rows.map((m) => {
      const unitPrice = m.unitPrice ?? 0;
      return {
        id: m.id,
        createdAt: m.createdAt,
        product: { id: m.product.id, sku: m.product.sku, name: m.product.name },
        quantity: m.quantity,
        unitPrice,
        total: round2(unitPrice * m.quantity),
        reason: m.reason,
      };
    });

    const byProduct = new Map<number, TopProduct>();
    let revenue = 0;
    let units = 0;
    for (const s of sales) {
      revenue += s.total;
      units += s.quantity;
      const top = byProduct.get(s.product.id) ?? {
        productId: s.product.id,
        sku: s.product.sku,
        name: s.product.name,
        units: 0,
        revenue: 0,
      };
      top.units += s.quantity;
      top.revenue = round2(top.revenue + s.total);
      byProduct.set(s.product.id, top);
    }

    return {
      totals: {
        revenue: round2(revenue),
        units,
        count: sales.length,
        averageTicket: sales.length ? round2(revenue / sales.length) : 0,
      },
      topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      sales,
    };
  }
}
