import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesQueryDto } from './movement.dto';
import { MONEY_TYPES } from './movements.service';
import { MovementType, StockMovement } from './stock-movement.entity';

export type CashKind = 'SALE' | 'PURCHASE';

export interface CashEntry {
  id: number;
  createdAt: Date;
  kind: CashKind;
  product: { id: number; sku: string; name: string };
  quantity: number;
  unitPrice: number;
  /** Positivo: entra dinero (venta). Negativo: sale dinero (compra). */
  amount: number;
  /** Saldo acumulado del periodo hasta este movimiento (inclusive). */
  balance: number;
  reason: string | null;
}

export interface CashReport {
  totals: {
    income: number;
    expense: number;
    balance: number;
    salesCount: number;
    purchasesCount: number;
  };
  entries: CashEntry[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Caja: las ventas suman (entra dinero) y las compras restan (sale dinero).
 * Los ajustes y el inventario inicial no mueven dinero.
 */
@Injectable()
export class CashService {
  constructor(
    @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
  ) {}

  async report(query: SalesQueryDto = {}): Promise<CashReport> {
    const qb = this.movements
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.product', 'p')
      .where('m.type IN (:...types)', { types: MONEY_TYPES })
      .andWhere('m.unitPrice IS NOT NULL')
      .orderBy('m.createdAt', 'ASC')
      .addOrderBy('m.id', 'ASC');
    if (query.productId) qb.andWhere('p.id = :pid', { pid: query.productId });

    const from = query.from ? new Date(query.from).getTime() : -Infinity;
    const to = query.to ? new Date(query.to).getTime() : Infinity;
    const rows = (await qb.getMany()).filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return t >= from && t < to;
    });

    let balance = 0;
    let income = 0;
    let expense = 0;
    let salesCount = 0;
    let purchasesCount = 0;
    const entries: CashEntry[] = rows.map((m) => {
      const isPurchase = m.type === MovementType.IN;
      const value = round2((m.unitPrice ?? 0) * m.quantity);
      const amount = isPurchase ? -value : value;
      if (isPurchase) {
        expense += value;
        purchasesCount++;
      } else {
        income += value;
        salesCount++;
      }
      balance = round2(balance + amount);
      return {
        id: m.id,
        createdAt: m.createdAt,
        kind: isPurchase ? 'PURCHASE' : 'SALE',
        product: { id: m.product.id, sku: m.product.sku, name: m.product.name },
        quantity: m.quantity,
        unitPrice: m.unitPrice ?? 0,
        amount,
        balance,
        reason: m.reason,
      };
    });

    return {
      totals: {
        income: round2(income),
        expense: round2(expense),
        balance: round2(income - expense),
        salesCount,
        purchasesCount,
      },
      // Más recientes primero
      entries: entries.reverse(),
    };
  }
}
