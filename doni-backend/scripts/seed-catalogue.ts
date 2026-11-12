/**
 * Adds the seed securities and their real BOC prices to the database named
 * by DB_* in the environment (or `.env`). Run migrations first. Safe to run
 * again: it only adds what is missing.
 *
 *   pnpm seed:catalogue
 */
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/common/database/data-source.options';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';

async function main(): Promise<void> {
  dotenv.config();
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  try {
    await seedCatalogue(dataSource);
    console.log('Catalogue seeded from BOC data.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
