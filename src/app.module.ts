import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from './alerts/alerts.module';
import { AlertRun, StockAlert } from './alerts/stock-alert.entity';
import { CategoriesModule } from './categories/categories.module';
import { Category } from './categories/category.entity';
import { databaseOptions } from './common/database';
import { InfoController } from './common/info.controller';
import { MovementsModule } from './movements/movements.module';
import { StockMovement } from './movements/stock-movement.entity';
import { Product } from './products/product.entity';
import { ProductsModule } from './products/products.module';
import { SeedModule } from './seed/seed.module';

/**
 * Base de datos: PostgreSQL si hay DATABASE_URL/POSTGRES_URL; si no, SQLite en WebAssembly (sql.js)
 * en data/inventario.sqlite (funciona en StackBlitz). Ver src/common/database.ts.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseOptions([Category, Product, StockMovement, StockAlert, AlertRun]),
    }),
    CategoriesModule,
    ProductsModule,
    MovementsModule,
    AlertsModule,
    SeedModule,
  ],
  controllers: [InfoController],
})
export class AppModule {}
