import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { CategoriesModule } from './categories/categories.module';
import { Category } from './categories/category.entity';
import { MovementsModule } from './movements/movements.module';
import { StockMovement } from './movements/stock-movement.entity';
import { Product } from './products/product.entity';
import { ProductsModule } from './products/products.module';
import { SeedModule } from './seed/seed.module';

/**
 * Base de datos SQLite en WebAssembly (sql.js): no requiere módulos nativos,
 * por eso funciona en StackBlitz. Se guarda en data/inventario.sqlite.
 * DB_PATH=:memory: usa una base en memoria (útil para pruebas).
 */
function databaseLocation(): string | undefined {
  const path = process.env.DB_PATH ?? 'data/inventario.sqlite';
  if (path === ':memory:') return undefined;
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const location = databaseLocation();
        return {
          type: 'sqljs' as const,
          location,
          autoSave: Boolean(location),
          entities: [Category, Product, StockMovement],
          synchronize: true,
        };
      },
    }),
    CategoriesModule,
    ProductsModule,
    MovementsModule,
    SeedModule,
  ],
})
export class AppModule {}
