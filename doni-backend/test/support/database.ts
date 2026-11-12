import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/common/database/data-source.options';

/**
 * Empties the test database and rebuilds it by running every migration, the
 * same way a fresh environment gets its schema. Returns the names of the
 * migrations that ran.
 */
export async function migrateEmptyDatabase(): Promise<string[]> {
  const dataSource = new DataSource({
    ...buildDataSourceOptions(),
    dropSchema: true,
  });
  await dataSource.initialize();
  try {
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    return migrations.map((migration) => migration.name);
  } finally {
    await dataSource.destroy();
  }
}

/**
 * SQL TypeORM would still need to run to make the database match the current
 * entities. Empty means the migrated schema is exactly the entity schema.
 */
export async function pendingSchemaChanges(): Promise<string[]> {
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  try {
    const sql = await dataSource.driver.createSchemaBuilder().log();
    return sql.upQueries.map((query) => query.query);
  } finally {
    await dataSource.destroy();
  }
}
