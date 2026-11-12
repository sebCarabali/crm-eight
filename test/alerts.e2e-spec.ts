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

describe('Alertas diarias (e2e)', () => {
  let app: NestExpressApplication;
  const ids: Record<string, number> = {};
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    // mínimo 3 en todos; margen 2 → alerta con stock <= 5
    const products = [
      ['AGO', 0], // agotado
      ['BAJ', 3], // en el mínimo
      ['CER', 5], // mínimo + 2
      ['OK', 6], // sin alerta
    ] as const;
    for (const [sku, initialStock] of products) {
      const res = await http()
        .post('/api/products')
        .send({ sku, name: `Producto ${sku}`, price: 1000, minStock: 3, initialStock })
        .expect(201);
      ids[sku] = res.body.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('antes de generar, el día no tiene alertas', async () => {
    const res = await http().get('/api/alerts').expect(200);
    expect(res.body.generatedAt).toBeNull();
    expect(res.body.alerts).toHaveLength(0);
  });

  it('genera alertas para stock <= mínimo + 2', async () => {
    const res = await http().post('/api/alerts/generate').expect(201);
    const bySku = Object.fromEntries(res.body.alerts.map((a: { product: { sku: string }; level: string }) => [a.product.sku, a.level]));
    expect(bySku).toEqual({ AGO: 'OUT_OF_STOCK', BAJ: 'BELOW_MIN', CER: 'NEAR_MIN' });
    expect(res.body.counts).toEqual({ total: 3, pending: 3, OUT_OF_STOCK: 1, BELOW_MIN: 1, NEAR_MIN: 1 });
    expect(res.body.margin).toBe(2);
    // sugerido: llevar al doble del mínimo (6)
    const ago = res.body.alerts.find((a: { product: { sku: string } }) => a.product.sku === 'AGO');
    expect(ago.suggestedOrder).toBe(6);
  });

  it('marca una alerta como atendida', async () => {
    const list = (await http().get('/api/alerts').expect(200)).body;
    const alert = list.alerts.find((a: { product: { sku: string } }) => a.product.sku === 'AGO');
    await http().patch(`/api/alerts/${alert.id}`).send({ resolved: true }).expect(200);
    const after = (await http().get('/api/alerts').expect(200)).body;
    expect(after.counts.pending).toBe(2);
  });

  it('al regenerar actualiza niveles, conserva las atendidas y quita las que ya no aplican', async () => {
    // Al producto OK le sacan 1 → queda en 5 (cerca del mínimo). A CER le entran 10 → sin alerta.
    await http().post('/api/movements').send({ productId: ids.OK, type: 'SALE', quantity: 1 }).expect(201);
    await http().post('/api/movements').send({ productId: ids.CER, type: 'IN', quantity: 10 }).expect(201);
    const res = await http().post('/api/alerts/generate').expect(201);
    const skus = res.body.alerts.map((a: { product: { sku: string } }) => a.product.sku).sort();
    expect(skus).toEqual(['AGO', 'BAJ', 'OK']);
    expect(res.body.alerts.find((a: { product: { sku: string } }) => a.product.sku === 'AGO').resolved).toBe(true);
  });

  it('lista los días con alertas', async () => {
    const res = await http().get('/api/alerts/days').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ total: 3, pending: 2 });
  });

  it('valida el formato de fecha', () => http().get('/api/alerts?date=hoy').expect(400));

  it('al borrar un producto se borran sus alertas', async () => {
    await http().delete(`/api/products/${ids.BAJ}`).expect(204);
    const res = await http().get('/api/alerts').expect(200);
    expect(res.body.alerts.map((a: { product: { sku: string } }) => a.product.sku)).not.toContain('BAJ');
  });
});
