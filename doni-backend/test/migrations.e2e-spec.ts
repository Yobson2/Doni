import { readdirSync } from 'fs';
import { join } from 'path';
import { migrateEmptyDatabase, pendingSchemaChanges } from './support/database';

describe('Migrations (e2e)', () => {
  it('builds the current entity schema on an empty database', async () => {
    const ran = await migrateEmptyDatabase();

    const migrationFiles = readdirSync(
      join(__dirname, '..', 'src', 'common', 'database', 'migrations'),
    ).filter((file) => /\.(ts|js)$/.test(file));
    expect(ran).toHaveLength(migrationFiles.length);
    expect(ran.length).toBeGreaterThan(0);

    // Nothing left for TypeORM to sync: migrations alone produce the schema.
    expect(await pendingSchemaChanges()).toEqual([]);
  });
});
