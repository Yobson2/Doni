/**
 * Writes the API's OpenAPI document to `openapi.json`, without a database or
 * secrets: the app is built in preview mode, so no provider is instantiated.
 * The frontend generates its client and types from this file.
 *
 *   pnpm openapi:emit
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';

const OPENAPI_FILE = join(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  // Building the document needs no configuration: never read a local .env.
  process.env.NODE_ENV = 'test';
  const { AppModule } = await import('../src/app.module');
  const { buildOpenApiDocument } = await import('../src/openapi');

  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const document = buildOpenApiDocument(app);
  writeFileSync(OPENAPI_FILE, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI document written to ${OPENAPI_FILE}`);
}

void main();
