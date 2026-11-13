import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isPostgres } from '../common/database';
import { Compra, VentaCliente, VentaMostrador } from '../registros/entidades';
import { DATOS_EXCEL } from './datos-excel';

/**
 * Carga los datos del Excel de la tienda (src/seed/datos-excel.ts) cuando la base está vacía.
 * Desactivar con SEED=false.
 */
@Injectable()
export class CargaInicialService implements OnModuleInit {
  private readonly logger = new Logger(CargaInicialService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.protegerTablas();
    if (process.env.SEED === 'false') return;
    const counts = await Promise.all(
      [VentaMostrador, VentaCliente, Compra].map((e) => this.dataSource.getRepository(e).count()),
    );
    if (counts.some((n) => n > 0)) return;
    try {
      await this.cargar();
      this.logger.log(
        `Datos del Excel cargados: ${DATOS_EXCEL.ventasMostrador.length} ventas de mostrador, ` +
          `${DATOS_EXCEL.ventasClientes.length} ventas a clientes, ${DATOS_EXCEL.compras.length} compras`,
      );
    } catch (err) {
      // En serverless dos instancias pueden arrancar a la vez: si otra ya cargó los datos, seguimos.
      this.logger.warn(`No se cargaron los datos del Excel: ${(err as Error).message}`);
    }
  }

  /**
   * En PostgreSQL (Supabase) activa Row Level Security en las tablas de la app. Sin políticas,
   * la API REST pública de Supabase (clave publishable/anon) no puede leerlas ni modificarlas;
   * el backend se conecta como dueño de las tablas y no se ve afectado.
   */
  async protegerTablas() {
    if (!isPostgres()) return;
    for (const tabla of ['ventas_mostrador', 'ventas_clientes', 'compras', 'productos']) {
      await this.dataSource.query(`ALTER TABLE "${tabla}" ENABLE ROW LEVEL SECURITY`);
    }
  }

  cargar() {
    return this.dataSource.transaction(async (em) => {
      const lotes = <T>(filas: T[]) => Array.from({ length: Math.ceil(filas.length / 100) }, (_, i) => filas.slice(i * 100, i * 100 + 100));
      const marcar = <T extends object>(filas: T[]) => filas.map((f) => ({ ...f, importado: true }));
      for (const lote of lotes(marcar(DATOS_EXCEL.ventasMostrador))) await em.insert(VentaMostrador, lote);
      for (const lote of lotes(marcar(DATOS_EXCEL.compras))) await em.insert(Compra, lote);
      for (const lote of lotes(marcar(DATOS_EXCEL.ventasClientes))) await em.insert(VentaCliente, lote);
    });
  }
}
