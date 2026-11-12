import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.DB_PATH = ':memory:';
process.env.SEED = 'false';
process.env.ALERTS_AUTO = 'false';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('../src/app.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configureApp } = require('../src/main');

describe('Inventario (e2e)', () => {
  let app: NestExpressApplication;
  let categoryId: number;
  let productId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea una categoría', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .send({ name: 'Electrónica' })
      .expect(201);
    categoryId = res.body.id;
  });

  it('rechaza categoría duplicada', () =>
    request(app.getHttpServer()).post('/api/categories').send({ name: 'Electrónica' }).expect(409));

  it('crea un producto con stock inicial', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .send({ sku: 'LAP-001', name: 'Laptop', price: 1000, cost: 600, minStock: 3, categoryId, initialStock: 5 })
      .expect(201);
    productId = res.body.id;
    expect(res.body.stock).toBe(5);
    expect(res.body.category.name).toBe('Electrónica');
  });

  it('valida los datos del producto', () =>
    request(app.getHttpServer()).post('/api/products').send({ sku: '', price: -1 }).expect(400));

  it('una salida es una venta: baja el stock y guarda el precio de venta', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'OUT', quantity: 3, reason: 'Venta' })
      .expect(201);
    expect(res.body.type).toBe('SALE');
    expect(res.body.unitPrice).toBe(1000);
    expect(res.body.previousStock).toBe(5);
    expect(res.body.newStock).toBe(2);
  });

  it('impide sacar más de lo que hay', () =>
    request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'OUT', quantity: 10 })
      .expect(400));

  it('reporta stock bajo en el resumen', async () => {
    const res = await request(app.getHttpServer()).get('/api/products/summary').expect(200);
    expect(res.body.totalProducts).toBe(1);
    expect(res.body.totalUnits).toBe(2);
    expect(res.body.inventoryValue).toBe(2000);
    expect(res.body.lowStockCount).toBe(1);
  });

  it('lista el historial de movimientos', async () => {
    const res = await request(app.getHttpServer()).get(`/api/movements?productId=${productId}`).expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].type).toBe('SALE');
    // el stock inicial es inventario inicial (ajuste), no una compra
    expect(res.body[1]).toMatchObject({ type: 'ADJUST', unitPrice: null, reason: 'Inventario inicial' });
  });

  it('registra una venta con el precio actual del producto', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'SALE', quantity: 1 })
      .expect(201);
    expect(res.body.newStock).toBe(1);
    expect(res.body.unitPrice).toBe(1000);
  });

  it('registra una venta con precio especial', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'SALE', quantity: 1, unitPrice: 900 })
      .expect(201);
    expect(res.body.newStock).toBe(0);
    expect(res.body.unitPrice).toBe(900);
  });

  it('no permite vender sin stock', () =>
    request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'SALE', quantity: 1 })
      .expect(400));

  it('reporta las ventas con totales', async () => {
    const res = await request(app.getHttpServer()).get('/api/sales').expect(200);
    // venta de 3 × 1000 + venta de 1 × 1000 + venta de 1 × 900
    expect(res.body.totals).toEqual({ revenue: 4900, units: 5, count: 3, averageTicket: 1633.33 });
    expect(res.body.sales.map((s: { type: string }) => s.type)).toEqual(['SALE', 'SALE', 'SALE']);
    expect(res.body.topProducts[0]).toMatchObject({ sku: 'LAP-001', units: 5, revenue: 4900 });
  });

  it('una compra (entrada) sube el stock con el costo del producto', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'IN', quantity: 10, reason: 'Proveedor' })
      .expect(201);
    expect(res.body).toMatchObject({ previousStock: 0, newStock: 10, unitPrice: 600 });
  });

  it('la caja suma ventas y resta compras', async () => {
    await request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'IN', quantity: 2, unitPrice: 550 })
      .expect(201);
    const res = await request(app.getHttpServer()).get('/api/cash').expect(200);
    // ingresos 4900; egresos 10 × 600 + 2 × 550 = 7100
    expect(res.body.totals).toEqual({ income: 4900, expense: 7100, balance: -2200, salesCount: 3, purchasesCount: 2 });
    const [last, prev] = res.body.entries;
    expect(last).toMatchObject({ kind: 'PURCHASE', amount: -1100, balance: -2200 });
    expect(prev).toMatchObject({ kind: 'PURCHASE', amount: -6000, balance: -1100 });
    // el inventario inicial no aparece en la caja
    expect(res.body.entries).toHaveLength(5);
  });

  it('un ajuste no mueve dinero', async () => {
    await request(app.getHttpServer()).post('/api/movements').send({ productId, type: 'ADJUST', quantity: 11 }).expect(201);
    const res = await request(app.getHttpServer()).get('/api/cash').expect(200);
    expect(res.body.totals.balance).toBe(-2200);
  });

  it('filtra las ventas por fecha', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app.getHttpServer()).get(`/api/sales?from=${future}`).expect(200);
    expect(res.body.totals.count).toBe(0);
    await request(app.getHttpServer()).get('/api/sales?from=ayer').expect(400);
  });

  it('no permite borrar una categoría con productos', () =>
    request(app.getHttpServer()).delete(`/api/categories/${categoryId}`).expect(409));

  it('borra el producto y su historial', async () => {
    await request(app.getHttpServer()).delete(`/api/products/${productId}`).expect(204);
    const res = await request(app.getHttpServer()).get('/api/movements').expect(200);
    expect(res.body).toHaveLength(0);
  });
});
