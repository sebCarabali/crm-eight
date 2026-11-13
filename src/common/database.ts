import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DataSourceOptions } from 'typeorm';

/**
 * Configuración de la base de datos:
 *  - Con DATABASE_URL (o POSTGRES_URL, que crea la integración de Neon/Vercel): PostgreSQL. Datos permanentes.
 *  - Sin ella: SQLite en WebAssembly (sql.js) guardado en un archivo. Funciona en StackBlitz.
 *    En Vercel el archivo va en /tmp, que es temporal: modo demo, los datos se reinician.
 */
export function postgresUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export const isPostgres = (): boolean => Boolean(postgresUrl());
export const isServerless = (): boolean => Boolean(process.env.VERCEL);

/** ¿Los datos se guardan de forma permanente? (falso en el modo demo de Vercel o con :memory:) */
export function isPersistent(): boolean {
  if (isPostgres()) return true;
  if (isServerless()) return false;
  return process.env.DB_PATH !== ':memory:';
}

/** Tipos de columna que cambian según el motor. Se evalúan al cargar las entidades. */
export const MONEY_COLUMN = isPostgres() ? 'double precision' : 'real';
export const TIMESTAMP_COLUMN = isPostgres() ? 'timestamptz' : 'datetime';

function sqliteLocation(): string | undefined {
  const fallback = isServerless() ? '/tmp/inventario.sqlite' : 'data/inventario.sqlite';
  const path = process.env.DB_PATH ?? fallback;
  if (path === ':memory:') return undefined;
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

export function databaseOptions(entities: DataSourceOptions['entities']): DataSourceOptions {
  const url = postgresUrl();
  if (url) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    return {
      type: 'postgres',
      url,
      ssl: local ? false : { rejectUnauthorized: false },
      entities,
      synchronize: true,
      // Pocas conexiones: en serverless cada instancia abre las suyas.
      extra: { max: isServerless() ? 2 : 10 },
    };
  }
  const location = sqliteLocation();
  return {
    type: 'sqljs',
    location,
    autoSave: Boolean(location),
    entities,
    synchronize: true,
  };
}
