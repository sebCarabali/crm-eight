import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Category } from '../categories/category.entity';
import { MovementType, StockMovement } from '../movements/stock-movement.entity';
import { Product } from '../products/product.entity';
import { OUT_REASONS, SALE_NOTES, SEED_CATEGORIES } from './seed-data';

/** Generador pseudoaleatorio con semilla: los datos de prueba siempre salen iguales. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS_OF_HISTORY = 30;
/** Hora de Colombia (UTC-5) para que las ventas caigan en horario de tienda. */
const STORE_UTC_OFFSET_HOURS = -5;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type NewMovement = Omit<StockMovement, 'id' | 'product'> & { product: { id: number } };

/**
 * Carga datos de prueba (tienda de barrio colombiana) cuando la base está vacía:
 * categorías, productos y un mes de ventas, salidas y compras a proveedor.
 *
 * Desactivar con SEED=false.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.SEED === 'false') return;
    const count = await this.dataSource.getRepository(Product).count();
    if (count > 0) return;
    const summary = await this.seed();
    this.logger.log(
      `Datos de prueba cargados: ${summary.categories} categorías, ${summary.products} productos, ${summary.movements} movimientos`,
    );
  }

  seed(now = new Date()) {
    return this.dataSource.transaction((em) => this.run(em, now));
  }

  private async run(em: EntityManager, now: Date) {
    const rand = mulberry32(2026);
    const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

    // Medianoche de hoy en hora de Colombia, expresada en UTC.
    const offset = STORE_UTC_OFFSET_HOURS * HOUR;
    const localNow = now.getTime() + offset;
    const todayStart = localNow - (localNow % DAY) - offset;
    const historyStart = new Date(todayStart - (DAYS_OF_HISTORY + 1) * DAY + 6 * HOUR);

    // 1. Categorías y productos
    interface Tracked {
      id: number;
      price: number;
      minStock: number;
      target: number;
      popularity: number;
      unitItem: boolean;
      stock: number;
    }
    const tracked: Tracked[] = [];
    const movements: NewMovement[] = [];

    for (const cat of SEED_CATEGORIES) {
      const category = await em.save(
        em.create(Category, { name: cat.name, description: cat.description, createdAt: historyStart }),
      );
      for (const p of cat.products) {
        const product = await em.save(
          em.create(Product, {
            sku: p.sku,
            name: p.name,
            description: null,
            price: p.price,
            minStock: p.minStock,
            stock: 0,
            category,
            createdAt: historyStart,
          }),
        );
        const t: Tracked = {
          id: product.id,
          price: p.price,
          minStock: p.minStock,
          target: p.stock,
          popularity: p.popularity,
          // Productos que se venden por unidad suelta (pan, huevo, dulces…) salen en mayor cantidad.
          unitItem: p.price <= 1500,
          stock: 0,
        };
        tracked.push(t);
        this.push(movements, t, MovementType.IN, p.stock, historyStart, 'Inventario inicial', null);
      }
    }

    // 2. Historial diario de ventas
    const weighted = tracked.flatMap((t) => Array<Tracked>(t.popularity).fill(t));

    for (let d = DAYS_OF_HISTORY; d >= 0; d--) {
      const dayStart = todayStart - d * DAY;
      const weekday = new Date(dayStart - offset).getUTCDay(); // 0 = domingo
      const isToday = d === 0;
      const closing = isToday ? Math.min(now.getTime() - 60_000, dayStart + 21 * HOUR) : dayStart + 21 * HOUR;

      // Compras a proveedor en la mañana: casi siempre se repone lo que está bajo.
      // En los últimos 2 días el proveedor no ha pasado, así quedan productos en stock bajo.
      for (const t of tracked) {
        if (d >= 2 && t.stock <= t.minStock && rand() < 0.75) {
          const qty = t.target - t.stock + between(0, Math.ceil(t.target / 4));
          this.push(movements, t, MovementType.IN, qty, new Date(dayStart + 6 * HOUR + between(0, 59) * 60_000), 'Compra a proveedor', null);
        }
      }

      // Más movimiento los fines de semana y en quincena (días 15 y 30).
      const localDate = new Date(dayStart - offset).getUTCDate();
      const payday = localDate === 15 || localDate === 30 || localDate === 1;
      let count = between(22, 34);
      if (weekday === 5 || weekday === 6) count += between(8, 14);
      if (weekday === 0) count += between(4, 8);
      if (payday) count += between(6, 10);

      const open = dayStart + 7 * HOUR;
      if (closing <= open) continue;
      const times = Array.from({ length: count }, () => open + Math.floor(rand() * (closing - open))).sort((a, b) => a - b);

      for (const time of times) {
        const t = pick(weighted);
        let qty = t.unitItem ? between(1, 6) : rand() < 0.75 ? 1 : between(2, 3);
        if (t.stock === 0) continue; // agotado: el cliente se va sin comprar
        qty = Math.min(qty, t.stock);
        const isOut = rand() < 0.12;
        const type = isOut ? MovementType.OUT : MovementType.SALE;
        const reason = isOut ? pick(OUT_REASONS) : pick(SALE_NOTES) || null;
        this.push(movements, t, type, qty, new Date(time), reason, t.price);
      }

      // Hace 3 días, al cierre: un par de ajustes por conteo físico.
      if (d === 3) {
        for (const t of tracked.filter((x) => x.stock > 5).slice(0, 3)) {
          this.push(movements, t, MovementType.ADJUST, t.stock - 1, new Date(dayStart + 21 * HOUR + 30 * 60_000), 'Conteo físico: unidad dañada', null);
        }
      }
    }

    // 3. Guardar movimientos (en orden cronológico) y el stock final
    movements.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const repo = em.getRepository(StockMovement);
    for (let i = 0; i < movements.length; i += 200) {
      await repo.insert(movements.slice(i, i + 200));
    }
    for (const t of tracked) {
      await em.update(Product, { id: t.id }, { stock: t.stock });
    }

    return { categories: SEED_CATEGORIES.length, products: tracked.length, movements: movements.length };
  }

  /** Registra un movimiento en memoria y actualiza el stock del producto. */
  private push(
    list: NewMovement[],
    t: { id: number; stock: number },
    type: MovementType,
    quantity: number,
    createdAt: Date,
    reason: string | null,
    unitPrice: number | null,
  ) {
    const previousStock = t.stock;
    const newStock =
      type === MovementType.IN ? previousStock + quantity : type === MovementType.ADJUST ? quantity : previousStock - quantity;
    t.stock = newStock;
    list.push({ product: { id: t.id }, type, quantity, previousStock, newStock, unitPrice, reason, createdAt });
  }
}
