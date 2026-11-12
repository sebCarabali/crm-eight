import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { addDaysKey, DAY_MS, storeDateKey, storeHour, storeTime } from '../common/store-time';
import { MovementType, StockMovement } from '../movements/stock-movement.entity';
import { Product } from '../products/product.entity';
import { AlertLevel, AlertRun, StockAlert, alertLevelFor } from './stock-alert.entity';

const LEVEL_ORDER: Record<AlertLevel, number> = {
  [AlertLevel.OUT_OF_STOCK]: 0,
  [AlertLevel.BELOW_MIN]: 1,
  [AlertLevel.NEAR_MIN]: 2,
};

export interface AlertView {
  id: number;
  date: string;
  level: AlertLevel;
  stock: number;
  minStock: number;
  resolved: boolean;
  currentStock: number;
  suggestedOrder: number;
  product: { id: number; sku: string; name: string; price: number; category: string | null };
}

export interface AlertCounts {
  total: number;
  pending: number;
  OUT_OF_STOCK: number;
  BELOW_MIN: number;
  NEAR_MIN: number;
}

/**
 * Alertas diarias de stock: todos los días a ALERT_HOUR (7:00 a. m. por defecto, hora de la tienda)
 * se registran los productos con stock <= mínimo + ALERT_MARGIN (2 por defecto).
 */
@Injectable()
export class AlertsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AlertsService.name);
  readonly margin = Number(process.env.ALERT_MARGIN ?? 2);
  readonly hour = Number(process.env.ALERT_HOUR ?? 7);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(StockAlert) private readonly alerts: Repository<StockAlert>,
    @InjectRepository(AlertRun) private readonly runs: Repository<AlertRun>,
    @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Programación diaria ----------

  onApplicationBootstrap() {
    if (process.env.ALERTS_AUTO === 'false') return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Revisa cada minuto: si ya pasó la hora y hoy no se han generado, las genera. */
  async tick(now = new Date()) {
    try {
      const today = storeDateKey(now);
      if (storeHour(now) < this.hour) return;
      if (await this.runs.existsBy({ date: today })) return;
      const { counts } = await this.generate(today);
      this.logger.log(`Alertas del ${today}: ${counts.total} producto(s) cerca o por debajo del mínimo`);
    } catch (err) {
      this.logger.error(`No se pudieron generar las alertas: ${(err as Error).message}`);
    }
  }

  // ---------- Generación ----------

  /**
   * Genera (o regenera) las alertas de un día.
   * @param opts.stockAt stock de cada producto a usar (por defecto, el stock actual)
   * @param opts.resolvedFor si se indica, decide si cada alerta queda como atendida
   * @param opts.generatedAt momento de la generación (por defecto, ahora)
   */
  async generate(
    date: string = storeDateKey(),
    opts: { stockAt?: Map<number, number>; resolvedFor?: (productId: number) => boolean; generatedAt?: Date } = {},
  ) {
    const { stockAt, resolvedFor, generatedAt = new Date() } = opts;
    await this.dataSource.transaction(async (em) => {
      const products = await em.find(Product);
      const existing = await em.find(StockAlert, { where: { date } });
      const byProduct = new Map(existing.map((a) => [a.product.id, a]));
      const keep = new Set<number>();

      for (const p of products) {
        if (stockAt && !stockAt.has(p.id)) continue; // el producto no existía todavía
        const stock = stockAt?.get(p.id) ?? p.stock;
        const level = alertLevelFor(stock, p.minStock, this.margin);
        if (!level) continue;
        keep.add(p.id);
        const alert = byProduct.get(p.id) ?? em.create(StockAlert, { date, product: p, resolved: false });
        Object.assign(alert, { level, stock, minStock: p.minStock, margin: this.margin });
        if (resolvedFor) alert.resolved = resolvedFor(p.id);
        await em.save(alert);
      }

      // Productos que ya no requieren alerta: se quitan, salvo las ya atendidas (quedan de historial).
      const stale = existing.filter((a) => !keep.has(a.product.id) && !a.resolved);
      if (stale.length) await em.delete(StockAlert, { id: In(stale.map((a) => a.id)) });

      await em.save(AlertRun, { date, generatedAt, count: keep.size });
    });
    return this.findByDate(date);
  }

  /**
   * Reconstruye las alertas de los últimos `days` días a partir del historial de movimientos
   * (stock que tenía cada producto a la hora de la alerta). Se usa con los datos de prueba.
   */
  async backfill(days: number, now = new Date()) {
    const rows = await this.movements
      .createQueryBuilder('m')
      .select('m.productId', 'productId')
      .addSelect('m.newStock', 'newStock')
      .addSelect('m.type', 'type')
      .addSelect('m.createdAt', 'createdAt')
      .orderBy('m.createdAt', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getRawMany<{ productId: number; newStock: number; type: MovementType; createdAt: string | Date }>();
    const history = rows.map((r) => ({
      productId: Number(r.productId),
      newStock: Number(r.newStock),
      type: r.type,
      time: r.createdAt instanceof Date ? r.createdAt.getTime() : Date.parse(`${String(r.createdAt).replace(' ', 'T')}Z`),
    }));

    const today = storeDateKey(now);
    for (let d = days; d >= 1; d--) {
      const date = addDaysKey(today, -d);
      const at = storeTime(date, this.hour).getTime();
      const stockAt = new Map<number, number>();
      for (const h of history) {
        if (h.time > at) break;
        stockAt.set(h.productId, h.newStock);
      }
      // Se considera atendida si al producto le entró mercancía en los 2 días siguientes.
      const restocked = new Set(
        history.filter((h) => h.type === MovementType.IN && h.time > at && h.time <= at + 2 * DAY_MS).map((h) => h.productId),
      );
      await this.generate(date, { stockAt, resolvedFor: (id) => restocked.has(id), generatedAt: new Date(at) });
    }
  }

  // ---------- Consultas ----------

  async findByDate(date: string = storeDateKey()) {
    const run = await this.runs.findOneBy({ date });
    const rows = await this.alerts.find({ where: { date } });
    const alerts: AlertView[] = rows
      .map((a) => ({
        id: a.id,
        date: a.date,
        level: a.level,
        stock: a.stock,
        minStock: a.minStock,
        resolved: a.resolved,
        currentStock: a.product.stock,
        // Sugerido: llevar el stock al doble del mínimo (o al menos mínimo + margen + 1).
        suggestedOrder: Math.max(a.product.minStock * 2, a.product.minStock + this.margin + 1) - a.product.stock,
        product: {
          id: a.product.id,
          sku: a.product.sku,
          name: a.product.name,
          price: a.product.price,
          category: a.product.category?.name ?? null,
        },
      }))
      .map((a) => ({ ...a, suggestedOrder: Math.max(a.suggestedOrder, 0) }))
      .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.product.name.localeCompare(b.product.name, 'es'));

    return {
      date,
      today: storeDateKey(),
      generatedAt: run?.generatedAt ?? null,
      margin: this.margin,
      hour: this.hour,
      counts: this.count(alerts),
      alerts,
    };
  }

  /** Últimos días con alertas generadas y sus conteos. */
  async days(limit = 14) {
    const runs = await this.runs.find({ order: { date: 'DESC' }, take: limit });
    if (!runs.length) return [];
    const rows = await this.alerts.find({ where: { date: In(runs.map((r) => r.date)) } });
    return runs.map((r) => ({
      date: r.date,
      generatedAt: r.generatedAt,
      ...this.count(rows.filter((a) => a.date === r.date)),
    }));
  }

  async setResolved(id: number, resolved: boolean) {
    const alert = await this.alerts.findOneBy({ id });
    if (!alert) throw new NotFoundException(`Alerta ${id} no encontrada`);
    alert.resolved = resolved;
    await this.alerts.save(alert);
    return { id, resolved };
  }

  private count(list: { level: AlertLevel; resolved: boolean }[]): AlertCounts {
    return {
      total: list.length,
      pending: list.filter((a) => !a.resolved).length,
      OUT_OF_STOCK: list.filter((a) => a.level === AlertLevel.OUT_OF_STOCK).length,
      BELOW_MIN: list.filter((a) => a.level === AlertLevel.BELOW_MIN).length,
      NEAR_MIN: list.filter((a) => a.level === AlertLevel.NEAR_MIN).length,
    };
  }
}
