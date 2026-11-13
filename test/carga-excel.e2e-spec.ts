import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.DB_PATH = ':memory:';
process.env.SEED = 'true';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('../src/app.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configureApp } = require('../src/main');

/** Valores de la hoja "Resumen clientes" del Excel original. */
const RESUMEN_EXCEL: [string, number, number, number][] = [
  ['Fundación Gimnasio Moderno (Popayán)', 8, 39, 202600],
  ['Leidy Potosí', 7, 13, 56800],
  ['Jhan Cifuentes', 7, 7, 97000],
];

describe('Carga de los datos del Excel (e2e)', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('carga todas las filas de cada hoja', async () => {
    expect((await http().get('/api/ventas-mostrador').expect(200)).body).toHaveLength(305);
    expect((await http().get('/api/compras').expect(200)).body).toHaveLength(178);
    expect((await http().get('/api/ventas-clientes').expect(200)).body).toHaveLength(129);
  });

  it('el resumen de clientes coincide con la hoja "Resumen clientes"', async () => {
    const res = (await http().get('/api/clientes/resumen').expect(200)).body;
    expect(res).toHaveLength(21);
    for (const [cliente, compras, unidades, total] of RESUMEN_EXCEL) {
      expect(res.find((r: { cliente: string }) => r.cliente === cliente)).toEqual({
        cliente,
        cantidadCompras: compras,
        unidadesCompradas: unidades,
        totalComprado: total,
      });
    }
  });

  it('los totales de caja coinciden con el Excel', async () => {
    const { totales } = (await http().get('/api/caja').expect(200)).body;
    expect(totales).toEqual({
      ingresos: 4474800 + 1995300,
      ventasMostrador: 4474800,
      ventasClientes: 1995300,
      efectivo: 3311800,
      nequi: 1163000,
      egresos: 4870200,
      saldo: 4474800 + 1995300 - 4870200,
    });
  });

  it('stock: la Cantidad del Inventario es el stock inicial; Comprado y Vendido empiezan en 0', async () => {
    const productos = (await http().get('/api/productos').expect(200)).body;
    expect(productos.every((p: { comprado: number; vendido: number; stock: number; cantidad: number }) =>
      p.comprado === 0 && p.vendido === 0 && p.stock === p.cantidad)).toBe(true);
    // "Guadalupe 30cm" aparece dos veces en el Inventario: 9 + 2
    expect(productos.find((p: { producto: string }) => p.producto === 'Guadalupe 30cm')).toMatchObject({ cantidad: 11, stock: 11 });
    const unidadesInventario = productos.reduce((s: number, p: { cantidad: number }) => s + p.cantidad, 0);
    const compras = (await http().get('/api/compras').expect(200)).body;
    expect(unidadesInventario).toBe(compras.reduce((s: number, c: { cantidad: number }) => s + c.cantidad, 0));
    // las ventas del Excel no descuentan: ningún producto queda negativo
    expect((await http().get('/api/resumen').expect(200)).body.productosStockNegativo).toBe(0);
  });

  it('las compras y ventas nuevas sí mueven el stock', async () => {
    const venta = await http()
      .post('/api/ventas-mostrador')
      .send({ fecha: '2026-11-12', producto: 'Guadalupe 30cm', cantidad: 3, valorUnitario: 9000 })
      .expect(201);
    await http()
      .post('/api/compras')
      .send({ proveedor: 'Artesanías Uanalujo', fechaFactura: '2026-11-12', clienteDestino: 'Lina (Popayán)', cantidad: 5, descripcion: 'guadalupe 30CM', precioUnitario: 5500 })
      .expect(201);
    const p = (await http().get('/api/productos?q=guadalupe 30').expect(200)).body[0];
    expect(p).toMatchObject({ cantidad: 11, comprado: 5, vendido: 3, stock: 13 });
    await http().delete(`/api/ventas-mostrador/${venta.body.id}`).expect(204);
  });

  it('controla existencias en ventas nuevas; las ventas del Excel se pueden editar sin control', async () => {
    const res = await http()
      .post('/api/ventas-mostrador')
      .send({ fecha: '2026-11-12', producto: 'Laca', cantidad: 1, valorUnitario: 11500 })
      .expect(400);
    expect(res.body.message).toContain('Inexistencia');
    const importada = (await http().get('/api/ventas-mostrador?q=laca').expect(200)).body[0];
    await http().patch(`/api/ventas-mostrador/${importada.id}`).send({ cantidad: 2 }).expect(200);
    await http().patch(`/api/ventas-mostrador/${importada.id}`).send({ cantidad: importada.cantidad }).expect(200);
  });

  it('respeta las fechas del Excel', async () => {
    const mostrador = (await http().get('/api/ventas-mostrador').expect(200)).body;
    expect(mostrador.at(-1).fecha).toBe('2026-07-28');
    expect(mostrador.filter((v: { importado: boolean }) => v.importado)[0].fecha).toBe('2026-08-26');
    const clientes = (await http().get('/api/ventas-clientes').expect(200)).body;
    expect(clientes[0].fecha).toBe('2026-12-09');
  });

  it('no vuelve a cargar los datos si la base ya tiene registros', async () => {
    const { CargaInicialService } = require('../src/seed/carga-inicial.service');
    await app.get(CargaInicialService).onModuleInit();
    expect((await http().get('/api/ventas-mostrador').expect(200)).body).toHaveLength(305);
  });
});
