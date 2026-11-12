import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';
const BOC = 'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf';

describe('Securities catalogue and end-of-day prices (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;
  let member: string;
  let admin: string;

  const http = () => request(app.getHttpServer());
  const nextEmail = () => `cat${++emailCounter}-${Date.now()}@example.com`;
  const as = (token: string) => `Bearer ${token}`;

  async function signUp(): Promise<{ email: string; token: string }> {
    const email = nextEmail();
    const res = await http()
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { email, token: res.body.accessToken as string };
  }

  async function signUpAdmin(): Promise<string> {
    const { email } = await signUp();
    await app
      .get(DataSource)
      .query(`UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = $1`, [email]);
    // The role is read at sign-in, so the admin signs in again.
    const res = await http()
      .post('/api/auth/sign-in')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
    member = (await signUp()).token;
    admin = await signUpAdmin();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('as an admin', () => {
    it('builds the catalogue and hand-enters end-of-day prices from a BOC', async () => {
      await http()
        .post('/api/sectors')
        .set('Authorization', as(admin))
        .send({ code: 'TEL', nameFr: 'Télécommunications', nameEn: 'Telecoms' })
        .expect(201);

      await http()
        .post('/api/securities')
        .set('Authorization', as(admin))
        .send({
          ticker: 'TST1',
          name: 'Test Telecom SA',
          sectorCode: 'TEL',
          country: 'SN',
          profileFr: 'Opérateur de test.',
          profileEn: 'Test operator.',
          profileOriginalLanguage: 'fr',
        })
        .expect(201)
        .expect((res) =>
          expect(res.body).toMatchObject({
            ticker: 'TST1',
            sector: { code: 'TEL' },
            country: 'SN',
            latestPrice: null,
          }),
        );

      const res = await http()
        .put('/api/securities/TST1/prices/2026-11-11')
        .set('Authorization', as(admin))
        .send({
          close: '4190',
          open: '4000',
          volume: '85624',
          sourceDocument: BOC,
          publishedOn: '2026-11-11',
        })
        .expect(200);
      expect(res.body).toEqual({
        date: '2026-11-11',
        close: '4190',
        open: '4000',
        high: null,
        low: null,
        volume: '85624',
        sourceDocument: BOC,
        publishedOn: '2026-11-11',
        status: 'published',
      });
    });

    it('corrects a price by entering the same day again', async () => {
      const put = (close: string) =>
        http()
          .put('/api/securities/TST1/prices/2026-11-10')
          .set('Authorization', as(admin))
          .send({ close, sourceDocument: BOC, publishedOn: '2026-11-10' })
          .expect(200);
      await put('4001');
      await put('4000');

      const history = await http()
        .get('/api/securities/TST1/prices')
        .set('Authorization', as(member))
        .expect(200);
      expect(
        history.body.filter((p: { date: string }) => p.date === '2026-11-10'),
      ).toEqual([expect.objectContaining({ close: '4000' })]);
    });

    it('keeps prices exact: numeric strings, never floats', async () => {
      await http()
        .put('/api/securities/TST1/prices/2026-11-09')
        .set('Authorization', as(admin))
        .send({
          close: '4150.125',
          sourceDocument: BOC,
          publishedOn: '2026-11-09',
        })
        .expect(200)
        .expect((res) => expect(res.body.close).toBe('4150.125'));
    });

    it('rejects a price without its source document or publication date', async () => {
      await http()
        .put('/api/securities/TST1/prices/2026-11-06')
        .set('Authorization', as(admin))
        .send({ close: '4100', publishedOn: '2026-11-06' })
        .expect(400);
      await http()
        .put('/api/securities/TST1/prices/2026-11-06')
        .set('Authorization', as(admin))
        .send({ close: '4100', sourceDocument: BOC })
        .expect(400);
      await http()
        .put('/api/securities/TST1/prices/2026-11-06')
        .set('Authorization', as(admin))
        .send({ close: '-1', sourceDocument: BOC, publishedOn: '2026-11-06' })
        .expect(400);
    });

    it('answers 404 for a price on an unknown security', async () => {
      await http()
        .put('/api/securities/NOPE/prices/2026-11-11')
        .set('Authorization', as(admin))
        .send({ close: '1', sourceDocument: BOC, publishedOn: '2026-11-11' })
        .expect(404);
    });
  });

  describe('as a member', () => {
    it('cannot modify the catalogue or prices', async () => {
      const auth = as(member);
      await http()
        .post('/api/sectors')
        .set('Authorization', auth)
        .send({ code: 'FIN', nameFr: 'Finance', nameEn: 'Finance' })
        .expect(403);
      await http()
        .patch('/api/sectors/TEL')
        .set('Authorization', auth)
        .send({ nameEn: 'Changed' })
        .expect(403);
      await http()
        .post('/api/securities')
        .set('Authorization', auth)
        .send({ ticker: 'HACK', name: 'X', sectorCode: 'TEL', country: 'SN' })
        .expect(403);
      await http()
        .patch('/api/securities/TST1')
        .set('Authorization', auth)
        .send({ name: 'Changed' })
        .expect(403);
      await http()
        .put('/api/securities/TST1/prices/2026-11-11')
        .set('Authorization', auth)
        .send({ close: '1', sourceDocument: BOC, publishedOn: '2026-11-11' })
        .expect(403);
      await http()
        .post('/api/indices')
        .set('Authorization', auth)
        .send({ code: 'IDX', name: 'Index' })
        .expect(403);
      await http()
        .put('/api/indices/BRVM-C/prices/2026-11-11')
        .set('Authorization', auth)
        .send({ close: '1', sourceDocument: BOC, publishedOn: '2026-11-11' })
        .expect(403);

      // Nothing changed.
      const security = await http()
        .get('/api/securities/TST1')
        .set('Authorization', auth)
        .expect(200);
      expect(security.body.name).toBe('Test Telecom SA');
      expect(security.body.latestPrice.close).toBe('4190');
    });

    it('needs to be signed in to read the catalogue', async () => {
      await http().get('/api/securities').expect(401);
      await http().get('/api/securities/TST1/prices').expect(401);
    });

    it('lists securities with their latest end-of-day price, source and date', async () => {
      const res = await http()
        .get('/api/securities')
        .set('Authorization', as(member))
        .expect(200);
      const tst = res.body.find((s: { ticker: string }) => s.ticker === 'TST1');
      expect(tst.latestPrice).toMatchObject({
        date: '2026-11-11',
        close: '4190',
        sourceDocument: BOC,
        publishedOn: '2026-11-11',
      });
    });

    it('reads the profile in both languages with its original language', async () => {
      const res = await http()
        .get('/api/securities/TST1')
        .set('Authorization', as(member))
        .expect(200);
      expect(res.body).toMatchObject({
        profileFr: 'Opérateur de test.',
        profileEn: 'Test operator.',
        profileOriginalLanguage: 'fr',
      });
    });

    it('reads the price history oldest first, filtered by date', async () => {
      const all = await http()
        .get('/api/securities/TST1/prices')
        .set('Authorization', as(member))
        .expect(200);
      expect(all.body.map((p: { date: string }) => p.date)).toEqual([
        '2026-11-09',
        '2026-11-10',
        '2026-11-11',
      ]);

      const ranged = await http()
        .get('/api/securities/TST1/prices?from=2026-11-10&to=2026-11-10')
        .set('Authorization', as(member))
        .expect(200);
      expect(ranged.body.map((p: { date: string }) => p.date)).toEqual([
        '2026-11-10',
      ]);
    });
  });

  describe('pending_review', () => {
    it('never shows a pending_review day: users keep seeing the last validated date', async () => {
      await http()
        .put('/api/securities/TST1/prices/2026-11-12')
        .set('Authorization', as(admin))
        .send({
          close: '9999',
          sourceDocument: BOC,
          publishedOn: '2026-11-12',
          status: 'pending_review',
        })
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('pending_review'));

      const history = await http()
        .get('/api/securities/TST1/prices')
        .set('Authorization', as(member))
        .expect(200);
      expect(history.body.map((p: { date: string }) => p.date)).not.toContain(
        '2026-11-12',
      );

      const security = await http()
        .get('/api/securities/TST1')
        .set('Authorization', as(member))
        .expect(200);
      expect(security.body.latestPrice.date).toBe('2026-11-11');

      const list = await http()
        .get('/api/securities')
        .set('Authorization', as(member))
        .expect(200);
      expect(
        list.body.find((s: { ticker: string }) => s.ticker === 'TST1')
          .latestPrice.date,
      ).toBe('2026-11-11');
    });
  });

  describe('seeded BOC data', () => {
    beforeAll(async () => {
      await seedCatalogue(app.get(DataSource));
      // Seeding twice changes nothing.
      await seedCatalogue(app.get(DataSource));
    });

    it('serves the price history of a seeded security, each price with its source and date', async () => {
      const res = await http()
        .get('/api/securities/SNTS/prices')
        .set('Authorization', as(member))
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(3);
      for (const price of res.body) {
        expect(price.sourceDocument).toMatch(/^https:\/\/www\.brvm\.org\//);
        expect(price.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(price.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(price).not.toHaveProperty('status');
      }
      expect(res.body.at(-1)).toMatchObject({
        date: '2026-11-11',
        close: '4190',
        sourceDocument:
          'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf',
      });
    });

    it('serves seeded index values through the same price source', async () => {
      const indices = await http()
        .get('/api/indices')
        .set('Authorization', as(member))
        .expect(200);
      expect(indices.body.map((i: { code: string }) => i.code)).toContain(
        'BRVM-C',
      );

      const res = await http()
        .get('/api/indices/BRVM-C/prices')
        .set('Authorization', as(member))
        .expect(200);
      expect(res.body.at(-1)).toMatchObject({
        date: '2026-11-11',
        close: '517.17',
        publishedOn: '2026-11-11',
      });
    });

    it('lists the seeded sectors', async () => {
      const res = await http()
        .get('/api/sectors')
        .set('Authorization', as(member))
        .expect(200);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'FIN',
            nameEn: 'Financial services',
          }),
        ]),
      );
    });
  });
});
