import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';
const SGI = 'SGI Test Bourse';
/** Placeholder BOC reference: test data only. */
const BOC = 'https://www.brvm.org/sites/default/files/test-boc.pdf';

interface Returns {
  period: string;
  from: string | null;
  to: string | null;
  xirr: {
    method: string;
    annualised: boolean;
    status: string;
    percent: string | null;
  };
  comparison: {
    method: string;
    benchmark: { code: string; name: string };
    points: Array<{
      date: string;
      portfolio: string | null;
      benchmark: string | null;
    }>;
  };
  gaps: Array<{ date: string; benchmark: boolean; tickers: string[] }>;
}

/*
 * Seeded BOC data (see boc-seed-data): SNTS closes 4150, 4000, 4190 and the
 * BRVM Composite 521.88, 512.81, 517.17 on 2026-11-09, -10, -11. The holder
 * buys 10 SNTS on 2026-11-09 at 4150, no fees: 41 500 paid in.
 */
describe('Portfolio returns (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;
  let admin: string;
  let holder: string;
  let portfolio: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;

  async function signUp(): Promise<{ email: string; token: string }> {
    const email = `ret${++emailCounter}-${Date.now()}@example.com`;
    const res = await http()
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { email, token: res.body.accessToken as string };
  }

  const returnsOf = async (token: string, query = '') =>
    (
      await http()
        .get(`/api/portfolios/${portfolio}/returns${query}`)
        .set('Authorization', as(token))
        .expect(200)
    ).body as Returns;

  const putPrice = (path: string, close: string, status?: string) =>
    http()
      .put(path)
      .set('Authorization', as(admin))
      .send({ close, sourceDocument: BOC, publishedOn: '2026-11-13', status })
      .expect(200);

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
    await seedCatalogue(app.get(DataSource));

    const adminUser = await signUp();
    await app
      .get(DataSource)
      .query(`UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = $1`, [
        adminUser.email,
      ]);
    admin = (
      await http()
        .post('/api/auth/sign-in')
        .send({ email: adminUser.email, password: PASSWORD })
        .expect(200)
    ).body.accessToken as string;

    holder = (await signUp()).token;
    portfolio = (
      await http()
        .post('/api/portfolios')
        .set('Authorization', as(holder))
        .send({ name: 'Rendement' })
        .expect(201)
    ).body.id as string;
    await http()
      .post(`/api/portfolios/${portfolio}/entries`)
      .set('Authorization', as(holder))
      .send({
        kind: 'buy',
        ticker: 'SNTS',
        date: '2026-11-09',
        quantity: '10',
        price: '4150',
        sgi: SGI,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('gives the XIRR and the TWR against the BRVM Composite, each with its method and period', async () => {
    const returns = await returnsOf(holder);

    expect(returns.period).toBe('ALL');
    expect(returns.from).toBe('2026-11-09');
    expect(returns.to).toBe('2026-11-11');
    expect(returns.comparison.method).toBe('twr');
    expect(returns.comparison.benchmark).toEqual({
      code: 'BRVM-C',
      name: 'BRVM Composite',
    });
    // Portfolio: 41 500, 40 000, 41 900 for 41 500 paid in.
    // BRVM Composite: 512.81 / 521.88 − 1 = −1.738 %; 517.17 / 521.88 − 1
    // = −0.903 %.
    expect(returns.comparison.points).toEqual([
      { date: '2026-11-09', portfolio: '0.00', benchmark: '0.00' },
      { date: '2026-11-10', portfolio: '-3.61', benchmark: '-1.74' },
      { date: '2026-11-11', portfolio: '0.96', benchmark: '-0.90' },
    ]);
    // −41 500, then +41 900 two days later, annualised.
    expect(returns.xirr).toMatchObject({
      method: 'xirr',
      annualised: true,
      status: 'solved',
    });
    expect(Number(returns.xirr.percent)).toBeCloseTo(
      (Math.pow(41_900 / 41_500, 365 / 2) - 1) * 100,
      1,
    );
    expect(returns.gaps).toEqual([]);
  });

  it('lists the days with data missing and leaves them out, without interpolating', async () => {
    // 2026-11-12: a BRVM Composite value, but SNTS's price is held for
    // review (never shown). 2026-11-13: an SNTS price, no index value.
    await putPrice('/api/indices/BRVM-C/prices/2026-11-12', '520');
    await putPrice(
      '/api/securities/SNTS/prices/2026-11-12',
      '4300',
      'pending_review',
    );
    await putPrice('/api/securities/SNTS/prices/2026-11-13', '4150');

    const returns = await returnsOf(holder);

    expect(returns.gaps).toEqual([
      { date: '2026-11-12', benchmark: false, tickers: ['SNTS'] },
      { date: '2026-11-13', benchmark: true, tickers: [] },
    ]);
    expect(returns.comparison.points.slice(3)).toEqual([
      { date: '2026-11-12', portfolio: null, benchmark: '-0.36' },
      { date: '2026-11-13', portfolio: '0.00', benchmark: null },
    ]);
    expect(returns.to).toBe('2026-11-13');
  });

  it('never measures from before the performance start', async () => {
    const returns = await returnsOf(holder, '?period=1Y');
    expect(returns.period).toBe('1Y');
    expect(returns.from).toBe('2026-11-09');
  });

  it('refuses an unknown period', async () => {
    await http()
      .get(`/api/portfolios/${portfolio}/returns?period=2W`)
      .set('Authorization', as(holder))
      .expect(400);
  });

  it('is not found for someone else’s portfolio', async () => {
    const other = (await signUp()).token;
    await http()
      .get(`/api/portfolios/${portfolio}/returns`)
      .set('Authorization', as(other))
      .expect(404);
  });

  it('has nothing to measure in an empty portfolio', async () => {
    const empty = (
      await http()
        .post('/api/portfolios')
        .set('Authorization', as(holder))
        .send({ name: 'Vide' })
        .expect(201)
    ).body.id as string;
    const res = await http()
      .get(`/api/portfolios/${empty}/returns?period=YTD`)
      .set('Authorization', as(holder))
      .expect(200);
    expect(res.body).toMatchObject({
      period: 'YTD',
      from: null,
      to: null,
      xirr: { status: 'no_solution', percent: null },
      comparison: { points: [] },
      gaps: [],
    });
  });
});
