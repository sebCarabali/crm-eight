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

  it('respeta las fechas del Excel', async () => {
    const mostrador = (await http().get('/api/ventas-mostrador').expect(200)).body;
    expect(mostrador.at(-1).fecha).toBe('2026-07-28');
    expect(mostrador[0].fecha).toBe('2026-08-26');
    const clientes = (await http().get('/api/ventas-clientes').expect(200)).body;
    expect(clientes[0].fecha).toBe('2026-12-09');
  });

  it('no vuelve a cargar los datos si la base ya tiene registros', async () => {
    const { CargaInicialService } = require('../src/seed/carga-inicial.service');
    await app.get(CargaInicialService).onModuleInit();
    expect((await http().get('/api/ventas-mostrador').expect(200)).body).toHaveLength(305);
  });
});
