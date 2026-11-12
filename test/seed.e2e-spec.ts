import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.DB_PATH = ':memory:';
process.env.SEED = 'true';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('../src/app.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configureApp } = require('../src/main');

describe('Datos de prueba (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('carga las categorías de la tienda', async () => {
    const res = await request(app.getHttpServer()).get('/api/categories').expect(200);
    const names = res.body.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(['Bebidas', 'Lácteos y huevos', 'Panadería', 'Granos y abarrotes']));
    expect(res.body.length).toBeGreaterThanOrEqual(12);
  });

  it('carga productos con stock coherente con su historial', async () => {
    const products = (await request(app.getHttpServer()).get('/api/products').expect(200)).body;
    expect(products.length).toBeGreaterThanOrEqual(60);
    const movements = (await request(app.getHttpServer()).get('/api/movements?limit=100000').expect(200)).body;

    for (const p of products) {
      expect(p.stock).toBeGreaterThanOrEqual(0);
      const own = movements.filter((m: { product: { id: number } }) => m.product.id === p.id);
      // El último movimiento deja el stock actual del producto
      expect(own[0].newStock).toBe(p.stock);
    }
    expect(movements.every((m: { newStock: number }) => m.newStock >= 0)).toBe(true);
  });

  it('genera un mes de ventas', async () => {
    const res = await request(app.getHttpServer()).get('/api/sales').expect(200);
    expect(res.body.totals.count).toBeGreaterThan(500);
    const types = new Set(res.body.sales.map((s: { type: string }) => s.type));
    expect(types).toEqual(new Set(['SALE']));
    expect(res.body.sales.every((s: { createdAt: string }) => new Date(s.createdAt).getTime() <= Date.now())).toBe(true);
  });

  it('la caja tiene ingresos por ventas y egresos por compras, con saldo positivo', async () => {
    const res = await request(app.getHttpServer()).get('/api/cash').expect(200);
    const { income, expense, balance, purchasesCount } = res.body.totals;
    expect(purchasesCount).toBeGreaterThan(10);
    expect(expense).toBeGreaterThan(0);
    expect(balance).toBe(Math.round((income - expense) * 100) / 100);
    expect(balance).toBeGreaterThan(0);
    const products = (await request(app.getHttpServer()).get('/api/products').expect(200)).body;
    expect(products.every((p: { cost: number; price: number }) => p.cost > 0 && p.cost < p.price)).toBe(true);
  });

  it('genera el historial de alertas de la última semana', async () => {
    const days = (await request(app.getHttpServer()).get('/api/alerts/days').expect(200)).body;
    // 7 días anteriores (+ hoy, si ya pasó la hora de las alertas)
    expect(days.length).toBeGreaterThanOrEqual(7);
    expect(days.some((d: { total: number }) => d.total > 0)).toBe(true);
  });

  it('no vuelve a cargar datos si la base ya tiene productos', async () => {
    const seeder = app.get(require('../src/seed/seed.service').SeedService);
    const before = (await request(app.getHttpServer()).get('/api/products').expect(200)).body.length;
    await seeder.onModuleInit();
    const after = (await request(app.getHttpServer()).get('/api/products').expect(200)).body.length;
    expect(after).toBe(before);
  });
});
