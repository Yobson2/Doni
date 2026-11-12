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
        });
    });
  });

  describe('Auth', () => {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
    };
    let accessToken: string;

    it('POST /api/auth/register - should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.user).toHaveProperty('email', testUser.email);
          expect(res.body.user).not.toHaveProperty('password');
        });
    });

    it('POST /api/auth/login - should login with credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          accessToken = res.body.accessToken;
        });
    });

    it('GET /api/users - should return users with auth token', () => {
      return request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('GET /api/users - should reject without auth token', () => {
      // The global AuthGuard currently answers 403 when no credentials are
      // sent; the sign-in slice (#5) owns the final status code.
      return request(app.getHttpServer()).get('/api/users').expect(403);
    });

    it('POST /api/auth/refresh - should refresh tokens', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201)
        .then((loginRes) => {
          return request(app.getHttpServer())
            .post('/api/auth/refresh')
            .send({ refreshToken: loginRes.body.refreshToken })
            .expect(201)
            .expect((res) => {
              expect(res.body).toHaveProperty('accessToken');
              expect(res.body).toHaveProperty('refreshToken');
            });
        });
    });
  });
});
