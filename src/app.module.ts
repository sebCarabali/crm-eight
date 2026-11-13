import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions } from './common/database';
import { InfoController } from './common/info.controller';
import { ENTIDADES } from './registros/entidades';
import { ComprasController, VentasClientesController, VentasMostradorController } from './registros/registros.controller';
import { ComprasService, VentasClientesService, VentasMostradorService } from './registros/registros.service';
import { ReportesController } from './reportes/reportes.controller';
import { ReportesService } from './reportes/reportes.service';
import { CargaInicialService } from './seed/carga-inicial.service';

/**
 * Base de datos: PostgreSQL (Supabase) si hay DATABASE_URL/POSTGRES_URL; si no, SQLite en WebAssembly
 * (sql.js) en data/inventario.sqlite (funciona en StackBlitz). Ver src/common/database.ts.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => databaseOptions(ENTIDADES) }),
    TypeOrmModule.forFeature(ENTIDADES),
  ],
  controllers: [
    VentasMostradorController,
    VentasClientesController,
    ComprasController,
    ReportesController,
    InfoController,
  ],
  providers: [VentasMostradorService, VentasClientesService, ComprasService, ReportesService, CargaInicialService],
})
export class AppModule {}
