import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects requests over the per-second limit, with in-memory counters', async () => {
    // The "short" throttler allows 10 requests per second per client.
    const statuses = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app.getHttpServer())
          .get('/health')
          .then((res) => res.status),
      ),
    );

    expect(statuses).toContain(200);
    expect(statuses).toContain(429);
  });
});
