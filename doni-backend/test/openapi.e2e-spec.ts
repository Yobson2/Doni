import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildOpenApiDocument } from '../src/openapi';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

describe('OpenAPI document (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('matches the committed openapi.json the frontend client is generated from', () => {
    const committed: unknown = JSON.parse(
      readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8'),
    );

    // If this fails: run `pnpm openapi:emit`, then `pnpm api:generate` in
    // doni-frontend, and commit both.
    expect(buildOpenApiDocument(app)).toEqual(committed);
  });
});
