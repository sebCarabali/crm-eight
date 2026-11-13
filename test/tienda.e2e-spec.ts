import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.DB_PATH = ':memory:';
process.env.SEED = 'false';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('../src/app.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configureApp } = require('../src/main');

describe('Tienda: ventas, compras, stock, clientes y caja (e2e)', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());
  let ventaId: number;
  let compraId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra una compra (hoja Inventario) con Valor Total = Cantidad × Precio Unitario', async () => {
    const res = await http()
      .post('/api/compras')
      .send({ proveedor: 'Vivian Romero (F1)', fechaFactura: '2026-04-06', clienteDestino: 'Linci Marín', cantidad: 10, descripcion: 'Cerdito Alcancía', precioUnitario: 3000 })
      .expect(201);
    compraId = res.body.id;
    expect(res.body.valorTotal).toBe(30000);
  });

  it('registra una venta de mostrador; sin pagos indicados, todo va a efectivo', async () => {
    const res = await http()
      .post('/api/ventas-mostrador')
      .send({ fecha: '2026-07-28', producto: 'Cerdito  alcancia', cantidad: 2, valorUnitario: 5000 })
      .expect(201);
    ventaId = res.body.id;
    expect(res.body).toMatchObject({ producto: 'Cerdito alcancia', valorTotal: 10000, pagoEfectivo: 10000, pagoNequi: 0 });
  });

  it('muestra error de inexistencia si el producto no tiene unidades en el inventario', async () => {
    const res = await http()
      .post('/api/ventas-mostrador')
      .send({ fecha: '2026-07-29', producto: 'Pinturas', cantidad: 1, valorUnitario: 3500 })
      .expect(400);
    expect(res.body.message).toBe('Inexistencia: no hay unidades de "Pinturas" en el inventario.');
  });

  it('crea el producto con existencias para poder venderlo', async () => {
    await http().post('/api/productos').send({ producto: 'Pinturas', cantidad: 6 }).expect(201);
  });

  it('reparte el pago entre efectivo y Nequi', async () => {
    const res = await http()
      .post('/api/ventas-mostrador')
      .send({ fecha: '2026-07-29', producto: 'Pinturas', cantidad: 5, valorUnitario: 3500, pagoNequi: 7500 })
      .expect(201);
    expect(res.body).toMatchObject({ valorTotal: 17500, pagoEfectivo: 10000, pagoNequi: 7500 });
  });

  it('rechaza pagos que no suman el Valor Total', () =>
    http()
      .post('/api/ventas-mostrador')
      .send({ fecha: '2026-07-29', producto: 'Pinturas', cantidad: 1, valorUnitario: 3500, pagoEfectivo: 1000, pagoNequi: 1000 })
      .expect(400));

  it('registra ventas a clientes (hoja Registro de Ventas)', async () => {
    for (const [cliente, cantidad, precio] of [['Leidy Potosí', 3, 5200], ['Leidy Potosí', 1, 4200], ['Jhan Cifuentes', 1, 12000]] as const) {
      await http()
        .post('/api/ventas-clientes')
        .send({ cliente, fecha: '2026-08-11', condicionesPago: 'Contado', cantidad, descripcion: 'CERDITO ALCANCÍA', precioUnitario: precio })
        .expect(201);
    }
  });

  it('valida los campos obligatorios y el formato de fecha', async () => {
    await http().post('/api/ventas-clientes').send({ cliente: '', fecha: '11/08/2026' }).expect(400);
    await http().post('/api/compras').send({ proveedor: 'X', fechaFactura: '2026-01-01' }).expect(400);
  });

  it('stock = compras − ventas, agrupando el mismo producto aunque cambien tildes y mayúsculas', async () => {
    const res = await http().get('/api/productos').expect(200);
    const cerdito = res.body.find((p: { producto: string }) => p.producto.toLowerCase().startsWith('cerdito'));
    // comprado 10; vendido 2 (mostrador) + 3 + 1 + 1 (clientes) = 7
    expect(cerdito).toMatchObject({ cantidad: 0, comprado: 10, vendido: 7, stock: 3 });
    const pinturas = res.body.find((p: { producto: string }) => p.producto === 'Pinturas');
    expect(pinturas).toMatchObject({ cantidad: 6, comprado: 0, vendido: 5, stock: 1 });
  });

  it('avisa si las existencias no alcanzan (venta de mostrador y a cliente)', async () => {
    const m = await http()
      .post('/api/ventas-mostrador')
      .send({ fecha: '2026-08-01', producto: 'pinturas', cantidad: 2, valorUnitario: 3500 })
      .expect(400);
    expect(m.body.message).toBe('Existencias insuficientes de "pinturas": hay 1 y se intentan vender 2.');
    const c = await http()
      .post('/api/ventas-clientes')
      .send({ cliente: 'Ana', fecha: '2026-08-01', condicionesPago: 'Contado', cantidad: 4, descripcion: 'Cerdito Alcancía', precioUnitario: 5000 })
      .expect(400);
    expect(c.body.message).toContain('Existencias insuficientes');
    await http()
      .post('/api/ventas-clientes')
      .send({ cliente: 'Ana', fecha: '2026-08-01', condicionesPago: 'Contado', cantidad: 1, descripcion: 'Producto inexistente', precioUnitario: 5000 })
      .expect(400);
    // nada se guardó
    expect((await http().get('/api/clientes/resumen').expect(200)).body.map((r: { cliente: string }) => r.cliente)).not.toContain('Ana');
  });

  it('resumen de clientes como en el Excel (COUNTIF / SUMIF)', async () => {
    const res = await http().get('/api/clientes/resumen').expect(200);
    expect(res.body).toEqual([
      { cliente: 'Leidy Potosí', cantidadCompras: 2, unidadesCompradas: 4, totalComprado: 19800 },
      { cliente: 'Jhan Cifuentes', cantidadCompras: 1, unidadesCompradas: 1, totalComprado: 12000 },
    ]);
  });

  it('caja: ventas suman, compras restan', async () => {
    const res = await http().get('/api/caja').expect(200);
    // ingresos: 10000 + 17500 (mostrador) + 15600 + 4200 + 12000 (clientes) = 59300; egresos 30000
    expect(res.body.totales).toEqual({
      ingresos: 59300,
      ventasMostrador: 27500,
      ventasClientes: 31800,
      efectivo: 20000,
      nequi: 7500,
      egresos: 30000,
      saldo: 29300,
    });
    expect(res.body.movimientos[0].saldo).toBe(29300);
    expect(res.body.movimientos.at(-1)).toMatchObject({ concepto: 'COMPRA', valor: -30000, saldo: -30000 });
  });

  it('filtra por fechas y texto', async () => {
    const julio = await http().get('/api/ventas-mostrador?desde=2026-07-29&hasta=2026-07-31').expect(200);
    expect(julio.body).toHaveLength(1);
    const busca = await http().get('/api/ventas-clientes?q=leidy').expect(200);
    expect(busca.body).toHaveLength(2);
    await http().get('/api/compras?desde=ayer').expect(400);
  });

  it('edita una venta: recalcula el total y conserva la forma de pago', async () => {
    const res = await http().patch(`/api/ventas-mostrador/${ventaId}`).send({ cantidad: 3 }).expect(200);
    expect(res.body).toMatchObject({ valorTotal: 15000, pagoEfectivo: 15000, pagoNequi: 0 });
  });

  it('al editar, no deja vender más de lo que hay (cuenta las unidades que ya tenía la venta)', async () => {
    // Cerdito: stock 2 (+3 ya vendidas en esta fila) → máximo 5
    await http().patch(`/api/ventas-mostrador/${ventaId}`).send({ cantidad: 6 }).expect(400);
    await http().patch(`/api/ventas-mostrador/${ventaId}`).send({ cantidad: 5 }).expect(200);
    await http().patch(`/api/ventas-mostrador/${ventaId}`).send({ cantidad: 3 }).expect(200);
  });

  it('elimina registros', async () => {
    await http().delete(`/api/compras/${compraId}`).expect(204);
    await http().get(`/api/compras/${compraId}`).expect(404);
    const productos = (await http().get('/api/productos').expect(200)).body;
    expect(productos.find((p: { producto: string }) => p.producto.toLowerCase().startsWith('cerdito')).stock).toBe(-8);
  });

  describe('agregar productos', () => {
    let productoId: number;

    it('crea un producto con su Cantidad como stock inicial', async () => {
      const res = await http().post('/api/productos').send({ producto: 'Virgen  Guadalupe 20cm', cantidad: 12 }).expect(201);
      productoId = res.body.id;
      expect(res.body).toMatchObject({ producto: 'Virgen Guadalupe 20cm', cantidad: 12 });
      const fila = (await http().get('/api/productos?q=guadalupe').expect(200)).body[0];
      expect(fila).toMatchObject({ id: productoId, producto: 'Virgen Guadalupe 20cm', cantidad: 12, comprado: 0, vendido: 0, stock: 12 });
    });

    it('no permite nombres repetidos (sin importar mayúsculas, tildes ni espacios)', async () => {
      await http().post('/api/productos').send({ producto: 'virgen guadalupe 20CM', cantidad: 1 }).expect(409);
      // ya existe por las compras/ventas registradas
      await http().post('/api/productos').send({ producto: 'PINTURAS', cantidad: 3 }).expect(409);
    });

    it('valida los datos', async () => {
      await http().post('/api/productos').send({ producto: '', cantidad: 1 }).expect(400);
      await http().post('/api/productos').send({ producto: 'Ángel', cantidad: -2 }).expect(400);
    });

    it('las ventas y compras con el mismo nombre mueven su stock', async () => {
      await http()
        .post('/api/ventas-mostrador')
        .send({ fecha: '2026-11-12', producto: 'virgen guadalupe 20cm', cantidad: 4, valorUnitario: 9000 })
        .expect(201);
      const fila = (await http().get('/api/productos?q=guadalupe').expect(200)).body[0];
      expect(fila).toMatchObject({ cantidad: 12, vendido: 4, stock: 8 });
    });

    it('edita el nombre y la cantidad', async () => {
      const res = await http().patch(`/api/productos/${productoId}`).send({ cantidad: 20 }).expect(200);
      expect(res.body.cantidad).toBe(20);
      const fila = (await http().get('/api/productos?q=guadalupe').expect(200)).body[0];
      expect(fila).toMatchObject({ cantidad: 20, stock: 16 });
      await http().patch(`/api/productos/${productoId}`).send({ producto: 'Pinturas' }).expect(409);
    });

    it('elimina el producto creado (sus ventas siguen registradas)', async () => {
      await http().delete(`/api/productos/${productoId}`).expect(204);
      await http().get(`/api/productos/${productoId}`).expect(404);
      const fila = (await http().get('/api/productos?q=guadalupe').expect(200)).body[0];
      expect(fila).toMatchObject({ id: null, cantidad: 0, vendido: 4, stock: -4 });
    });
  });

  it('ofrece opciones para autocompletar', async () => {
    const res = await http().get('/api/opciones').expect(200);
    expect(res.body.clientes).toEqual(['Jhan Cifuentes', 'Leidy Potosí']);
    expect(res.body.condicionesPago).toEqual(expect.arrayContaining(['Contado', 'Nequi', 'Transferencia']));
  });
});
