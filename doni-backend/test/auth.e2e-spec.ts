import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { JobsService } from '../src/common/jobs/jobs.service';
import {
  SESSIONS_CLEANUP_CRON,
  SESSIONS_CLEANUP_JOB,
} from '../src/modules/auth/sessions.service';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';
import {
  REFRESH_COOKIE,
  SessionCookies,
  refreshCookieFrom,
} from './support/session';

const PASSWORD = 'CorrectHorse9!';

describe('Sign-up, sign-in and sign-out (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;

  const http = () => request(app.getHttpServer());
  const nextEmail = () => `user${++emailCounter}-${Date.now()}@example.com`;

  /** Signs a new member up and returns their session. */
  async function signUp(email = nextEmail()) {
    const res = await http()
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD })
      .expect(201);
    return {
      email,
      userId: res.body.user.id as string,
      accessToken: res.body.accessToken as string,
      refreshCookie: refreshCookieFrom(res),
    };
  }

  async function signIn(email: string) {
    const res = await http()
      .post('/api/auth/sign-in')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      accessToken: res.body.accessToken as string,
      refreshCookie: refreshCookieFrom(res),
    };
  }

  const refresh = (cookie: SessionCookies) =>
    http().post('/api/auth/refresh').set('Cookie', cookie.header);

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('sign-up', () => {
    it('creates the account, returns an access token and sets the refresh cookie', async () => {
      const email = nextEmail();
      const res = await http()
        .post('/api/auth/sign-up')
        .send({ email, password: PASSWORD })
        .expect(201);

      expect(res.body.user).toMatchObject({ email, role: 'MEMBRE' });
      expect(res.body.user).not.toHaveProperty('password');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body).not.toHaveProperty('refreshToken');

      const cookie = refreshCookieFrom(res);
      expect(cookie.attributes).toEqual(
        expect.arrayContaining(['HttpOnly', 'Secure', 'SameSite=Strict']),
      );
      expect(cookie.attributes).toContain('Path=/api/auth');
    });

    it('rejects an email that already has an account', async () => {
      const { email } = await signUp();
      await http()
        .post('/api/auth/sign-up')
        .send({ email, password: PASSWORD })
        .expect(409);
    });

    it('is the only way to create an account', async () => {
      await http()
        .post('/api/users')
        .send({ email: nextEmail(), password: PASSWORD })
        .expect(404);
    });
  });

  describe('sign-in', () => {
    it('signs in with the right password', async () => {
      const { email } = await signUp();
      const session = await signIn(email);

      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)
        .expect((res) => expect(res.body.email).toBe(email));
    });

    it('rejects a wrong password with 401', async () => {
      const { email } = await signUp();
      await http()
        .post('/api/auth/sign-in')
        .send({ email, password: 'not-the-password' })
        .expect(401);
    });
  });

  describe('access tokens', () => {
    it('answers 401 when no credentials are sent', async () => {
      await http().get('/api/users/me').expect(401);
    });

    it('answers 401 for a malformed token', async () => {
      await http()
        .get('/api/users/me')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
    });

    it('never accepts a refresh token as an access token', async () => {
      const { refreshCookie } = await signUp();

      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${refreshCookie.value}`)
        .expect(401);
    });

    it('never accepts an access token as a refresh token', async () => {
      const { accessToken } = await signUp();

      await http()
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${accessToken}`)
        .expect(401);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a working access token', async () => {
      const session = await signUp();

      const res = await refresh(session.refreshCookie).expect(200);
      const rotated = refreshCookieFrom(res);

      expect(rotated.value).not.toBe(session.refreshCookie.value);
      expect(res.body).not.toHaveProperty('refreshToken');
      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
      await refresh(rotated).expect(200);
    });

    it('answers 401 when no refresh cookie is sent', async () => {
      await http().post('/api/auth/refresh').expect(401);
    });

    it('revokes the session when a rotated refresh token is reused', async () => {
      const session = await signUp();
      const rotated = refreshCookieFrom(
        await refresh(session.refreshCookie).expect(200),
      );

      // The first token was already rotated: presenting it again means it
      // may have been copied, so the whole session ends.
      await refresh(session.refreshCookie).expect(401);
      await refresh(rotated).expect(401);
    });

    it('leaves the same user’s other sessions alone when one is revoked', async () => {
      const first = await signUp();
      const second = await signIn(first.email);

      await refresh(first.refreshCookie).expect(200);
      await refresh(first.refreshCookie).expect(401);

      await refresh(second.refreshCookie).expect(200);
    });
  });

  describe('sign-out', () => {
    it('clears the refresh cookie and rejects the old refresh token', async () => {
      const session = await signUp();

      const res = await http()
        .post('/api/auth/sign-out')
        .set('Cookie', session.refreshCookie.header)
        .expect(204);

      const cleared = refreshCookieFrom(res);
      expect(cleared.value).toBe('');
      expect(cleared.attributes).toContain(
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      );

      await refresh(session.refreshCookie).expect(401);
    });

    it('succeeds without a session, so the client can always sign out', async () => {
      await http().post('/api/auth/sign-out').expect(204);
    });

    it('schedules the daily clean-up of expired refresh tokens', async () => {
      expect(await app.get(JobsService).getSchedules()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: SESSIONS_CLEANUP_JOB,
            cron: SESSIONS_CLEANUP_CRON,
          }),
        ]),
      );
    });
  });

  describe('account access', () => {
    it('lets a member read and update their own account', async () => {
      const member = await signUp();
      const auth = `Bearer ${member.accessToken}`;

      await http()
        .patch('/api/users/me')
        .set('Authorization', auth)
        .send({ firstName: 'Awa' })
        .expect(200)
        .expect((res) => expect(res.body.firstName).toBe('Awa'));

      await http()
        .get('/api/users/me')
        .set('Authorization', auth)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(member.userId);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('keeps the display currency a member chooses: XOF by default, EUR once chosen, across sessions', async () => {
      const member = await signUp();
      const auth = `Bearer ${member.accessToken}`;

      await http()
        .get('/api/users/me')
        .set('Authorization', auth)
        .expect(200)
        .expect((res) => expect(res.body.displayCurrency).toBe('XOF'));

      await http()
        .patch('/api/users/me')
        .set('Authorization', auth)
        .send({ displayCurrency: 'EUR' })
        .expect(200)
        .expect((res) => expect(res.body.displayCurrency).toBe('EUR'));

      // A new session starts with the stored preference.
      const res = await http()
        .post('/api/auth/sign-in')
        .send({ email: member.email, password: PASSWORD })
        .expect(200);
      expect(res.body.user.displayCurrency).toBe('EUR');
      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200)
        .expect((me) => expect(me.body.displayCurrency).toBe('EUR'));

      // Only the two display currencies are accepted.
      await http()
        .patch('/api/users/me')
        .set('Authorization', auth)
        .send({ displayCurrency: 'USD' })
        .expect(400);
    });

    it('does not let a member change their own role or status', async () => {
      const member = await signUp();

      await http()
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ role: 'ADMIN' })
        .expect(400);
      await http()
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ isActive: false })
        .expect(400);
    });

    it('does not let a member read, list or modify another user’s account', async () => {
      const member = await signUp();
      const other = await signUp();
      const auth = `Bearer ${member.accessToken}`;

      await http().get('/api/users').set('Authorization', auth).expect(403);
      await http()
        .get(`/api/users/${other.userId}`)
        .set('Authorization', auth)
        .expect(403);
      await http()
        .patch(`/api/users/${other.userId}`)
        .set('Authorization', auth)
        .send({ firstName: 'Changed' })
        .expect(403);
      await http()
        .delete(`/api/users/${other.userId}`)
        .set('Authorization', auth)
        .expect(403);

      const otherSelf = await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${other.accessToken}`)
        .expect(200);
      expect(otherSelf.body.firstName).toBeNull();
      expect(otherSelf.body.isActive).toBe(true);
    });

    it('lets an admin list and administer accounts', async () => {
      const admin = await signUp();
      const member = await signUp();
      await app
        .get(DataSource)
        .query(`UPDATE "users" SET "role" = 'ADMIN' WHERE "id" = $1`, [
          admin.userId,
        ]);
      // The role is read at sign-in, so the admin signs in again.
      const { accessToken } = await signIn(admin.email);
      const auth = `Bearer ${accessToken}`;

      const list = await http()
        .get('/api/users')
        .set('Authorization', auth)
        .expect(200);
      expect(list.body.data.map((u: { id: string }) => u.id)).toContain(
        member.userId,
      );
      expect(list.body.data[0]).not.toHaveProperty('password');

      await http()
        .get(`/api/users/${member.userId}`)
        .set('Authorization', auth)
        .expect(200);
      await http()
        .delete(`/api/users/${member.userId}`)
        .set('Authorization', auth)
        .expect(200);
    });

    it('ends a deactivated user’s sessions', async () => {
      const admin = await signUp();
      const member = await signUp();
      await app
        .get(DataSource)
        .query(`UPDATE "users" SET "role" = 'ADMIN' WHERE "id" = $1`, [
          admin.userId,
        ]);
      const { accessToken } = await signIn(admin.email);

      await http()
        .delete(`/api/users/${member.userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await refresh(member.refreshCookie).expect(401);
      // The access token already issued stops working too.
      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(401);
      await http()
        .post('/api/auth/sign-in')
        .send({ email: member.email, password: PASSWORD })
        .expect(401);
    });
  });
});
