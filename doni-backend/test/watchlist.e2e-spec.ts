import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';

/*
 * Seeded BOC prices (see boc-seed-data): latest published closes on
 * 2026-11-11 are SNTS 4190 and ORAC 20000.
 */
describe('Watchlist (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;
  let alice: string;
  let bob: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;

  async function signUp(): Promise<string> {
    const res = await http()
      .post('/api/auth/sign-up')
      .send({
        email: `wl${++emailCounter}-${Date.now()}@example.com`,
        password: PASSWORD,
      })
      .expect(201);
    return res.body.accessToken as string;
  }

  const watch = (token: string, ticker: string) =>
    http().put(`/api/watchlist/${ticker}`).set('Authorization', as(token));

  const unwatch = (token: string, ticker: string) =>
    http().delete(`/api/watchlist/${ticker}`).set('Authorization', as(token));

  const watchlistOf = async (token: string) =>
    (
      await http()
        .get('/api/watchlist')
        .set('Authorization', as(token))
        .expect(200)
    ).body as Array<{
      ticker: string;
      latestPrice: { date: string; close: string } | null;
    }>;

  const tickersOf = async (token: string) =>
    (await watchlistOf(token)).map((item) => item.ticker);

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
    await seedCatalogue(app.get(DataSource));
    alice = await signUp();
    bob = await signUp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('needs to be signed in', async () => {
    await http().get('/api/watchlist').expect(401);
    await http().put('/api/watchlist/SNTS').expect(401);
    await http().delete('/api/watchlist/SNTS').expect(401);
  });

  it('starts empty', async () => {
    expect(await watchlistOf(alice)).toEqual([]);
  });

  it('adds securities and lists them with their latest end-of-day price and its date', async () => {
    const added = await watch(alice, 'SNTS').expect(200);
    expect(added.body).toEqual({
      ticker: 'SNTS',
      name: expect.any(String),
      addedAt: expect.any(String),
      latestPrice: expect.objectContaining({
        date: '2026-11-11',
        close: '4190',
      }),
    });
    await watch(alice, 'ORAC').expect(200);

    const list = await watchlistOf(alice);
    expect(list.map((i) => [i.ticker, i.latestPrice?.close])).toEqual([
      ['ORAC', '20000'],
      ['SNTS', '4190'],
    ]);
    expect(list[0].latestPrice).toMatchObject({
      date: '2026-11-11',
      sourceDocument: expect.any(String),
      publishedOn: expect.any(String),
    });
  });

  it('adding a security already watched changes nothing', async () => {
    await watch(alice, 'SNTS').expect(200);
    expect(await tickersOf(alice)).toEqual(['ORAC', 'SNTS']);
  });

  it('shows only published prices: a pending_review day is ignored', async () => {
    await app.get(DataSource).query(
      `INSERT INTO "eod_prices" ("securityId", "tradingDate", "close", "sourceDocument", "publishedOn", "status")
       SELECT "id", '2026-11-12', 9999, 'boc', '2026-11-12', 'pending_review'
       FROM "securities" WHERE "ticker" = 'SNTS'`,
    );
    const snts = (await watchlistOf(alice)).find((i) => i.ticker === 'SNTS');
    expect(snts?.latestPrice).toMatchObject({
      date: '2026-11-11',
      close: '4190',
    });
  });

  it('removes a security, and removing it again changes nothing', async () => {
    await unwatch(alice, 'ORAC').expect(204);
    expect(await tickersOf(alice)).toEqual(['SNTS']);
    await unwatch(alice, 'ORAC').expect(204);
    expect(await tickersOf(alice)).toEqual(['SNTS']);
  });

  it('can add a removed security back', async () => {
    await watch(alice, 'ORAC').expect(200);
    expect(await tickersOf(alice)).toEqual(['ORAC', 'SNTS']);
  });

  it('rejects an unknown ticker', async () => {
    await watch(alice, 'NOPE').expect(404);
    await unwatch(alice, 'NOPE').expect(404);
  });

  describe('ownership', () => {
    it("a user cannot read another user's watchlist", async () => {
      // Alice watches ORAC and SNTS; Bob's watchlist shows none of them.
      expect(await watchlistOf(bob)).toEqual([]);

      await watch(bob, 'SNTS').expect(200);
      expect(await tickersOf(bob)).toEqual(['SNTS']);
      expect(await tickersOf(alice)).toEqual(['ORAC', 'SNTS']);
    });

    it("a user cannot change another user's watchlist", async () => {
      // Bob removing ORAC only affects his own list, which lacks it.
      await unwatch(bob, 'ORAC').expect(204);
      await unwatch(bob, 'SNTS').expect(204);
      expect(await tickersOf(bob)).toEqual([]);
      expect(await tickersOf(alice)).toEqual(['ORAC', 'SNTS']);
    });
  });
});
