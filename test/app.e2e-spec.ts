import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.DB_PATH = ':memory:';
process.env.SEED = 'false';

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
      .send({ sku: 'LAP-001', name: 'Laptop', price: 1000, minStock: 3, categoryId, initialStock: 5 })
      .expect(201);
    productId = res.body.id;
    expect(res.body.stock).toBe(5);
    expect(res.body.category.name).toBe('Electrónica');
  });

  it('valida los datos del producto', () =>
    request(app.getHttpServer()).post('/api/products').send({ sku: '', price: -1 }).expect(400));

  it('registra una salida y actualiza el stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/movements')
      .send({ productId, type: 'OUT', quantity: 3, reason: 'Venta' })
      .expect(201);
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
    expect(res.body[0].type).toBe('OUT');
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

  it('reporta ventas y salidas con totales', async () => {
    const res = await request(app.getHttpServer()).get('/api/sales').expect(200);
    // 1 salida de 3 × 1000 + venta de 1 × 1000 + venta de 1 × 900
    expect(res.body.totals).toEqual({ revenue: 4900, units: 5, count: 3, averageTicket: 1633.33 });
    expect(res.body.sales.map((s: { type: string }) => s.type)).toEqual(['SALE', 'SALE', 'OUT']);
    expect(res.body.topProducts[0]).toMatchObject({ sku: 'LAP-001', units: 5, revenue: 4900 });
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
