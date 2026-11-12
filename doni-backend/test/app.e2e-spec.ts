import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

describe('Application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Health', () => {
    it('GET /health - should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('environment');
          expect(res.body.checks.database).toEqual({ status: 'up' });
          expect(res.body.checks.jobs).toHaveProperty('status', 'up');
        });
    });
  });

  describe('Protected routes', () => {
    // 401: no or invalid credentials. 403 is kept for an authenticated user
    // who lacks the role (see auth.e2e-spec.ts).
    it('GET /api/users - answers 401 without credentials', () => {
      return request(app.getHttpServer()).get('/api/users').expect(401);
    });
  });
});
