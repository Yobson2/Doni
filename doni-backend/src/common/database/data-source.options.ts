import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

/** Glob for every migration file, valid for both `src` (ts) and `dist` (js). */
export const MIGRATIONS_GLOB = join(__dirname, 'migrations', '*{.ts,.js}');

/** Glob for every entity file, valid for both `src` (ts) and `dist` (js). */
export const ENTITIES_GLOB = join(
  __dirname,
  '..',
  '..',
  '**',
  '*.entity{.ts,.js}',
);

/**
 * Connection options shared by the TypeORM CLI (`data-source.ts`) and the
 * end-to-end test harness. The schema is owned by migrations only:
 * `synchronize` is always off.
 */
export const buildDataSourceOptions = (
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions => ({
  type: 'postgres',
  host: env.DB_HOST || 'localhost',
  port: parseInt(env.DB_PORT || '5432', 10),
  username: env.DB_USER || 'postgres',
  password: env.DB_PASS || '',
  database: env.DB_NAME || 'app_db',
  entities: [ENTITIES_GLOB],
  migrations: [MIGRATIONS_GLOB],
  synchronize: false,
});
