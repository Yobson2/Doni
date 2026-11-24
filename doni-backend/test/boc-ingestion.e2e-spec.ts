import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { MailService } from '../src/common/mail/mail.service';
import {
  BOC_FETCHER,
  type BocFetcher,
  type FetchedBoc,
} from '../src/modules/securities/boc/boc-fetcher';
import { BOC_DAY_PUBLISHED } from '../src/modules/securities/boc/boc-ingestion.service';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';

/** Real BOCs downloaded from brvm.org (test/fixtures/boc). */
const fixture = (day: string) =>
  readFileSync(join(__dirname, 'fixtures', 'boc', `boc_${day}_2.pdf`));
const boc = (day: string, document = fixture(day)): FetchedBoc => ({
  document,
  sourceUrl: `https://www.brvm.org/sites/default/files/boc_${day}_2.pdf`,
});
/** The same bulletin with a different checksum (bytes after %%EOF). */
const reissued = (day: string) =>
  boc(day, Buffer.concat([fixture(day), Buffer.from('\n% reissued\n')]));

/*
 * The seed catalogue holds SNTS, ORAC, ETIT, PALC, SGBC and the BRVM-C and
 * BRVM-30 indices, with BOC prices for 9, 10 and 11 November 2026. The prices
 * of the 10th and 11th are removed first, so that those days arrive through
 * ingestion of the real bulletins: the last validated day starts as the 9th.
 */
describe('Daily BOC ingestion (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let emailCounter = 0;
  let admin: string;
  let adminEmail: string;
  let member: string;
  let portfolioId: string;
  const published: string[] = [];

  /** What the fake fetcher serves, by trading day; unset means not online. */
  const online = new Map<string, FetchedBoc>();
  const fetcher: BocFetcher = {
    fetch: (tradingDate) => Promise.resolve(online.get(tradingDate) ?? null),
  };
  const sendMail = jest.fn().mockResolvedValue(undefined);

  const http = () => request(app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;

  async function signUp(): Promise<{ email: string; token: string }> {
    const email = `boc${++emailCounter}-${Date.now()}@example.com`;
    const res = await http()
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { email, token: res.body.accessToken as string };
  }

  const ingest = async (date: string) =>
    (
      await http()
        .post(`/api/bulletins/${date}/ingest`)
        .set('Authorization', as(admin))
        .expect(200)
    ).body as { outcome: string; failures: { check: string }[] };

  /** Every stored trace of a trading day, to prove a re-run changed nothing. */
  const snapshot = async (date: string) => ({
    bulletin: (await db.query(
      `SELECT "id", "checksum", "status", "failures", "parsed", "updatedAt"
       FROM "boc_bulletins" WHERE "tradingDate" = $1`,
      [date],
    )) as unknown[],
    prices: (await db.query(
      `SELECT "id", "securityId", "indexId", "close", "status", "bulletinId", "updatedAt"
       FROM "eod_prices" WHERE "tradingDate" = $1 ORDER BY "id"`,
      [date],
    )) as unknown[],
  });

  /**
   * The trading days every price-serving endpoint shows to a member: the
   * catalogue, the company page and its history, the indices and their
   * history, the portfolio valuation and the watchlist.
   */
  async function servedDays(): Promise<Record<string, unknown>> {
    const get = async (path: string) =>
      (await http().get(path).set('Authorization', as(member)).expect(200))
        .body as unknown;
    type Priced = { ticker: string; latestPrice: { date: string } | null };
    const catalogue = (await get('/api/securities')) as Priced[];
    const company = (await get('/api/securities/SNTS')) as Priced;
    const history = (await get('/api/securities/SNTS/prices')) as {
      date: string;
    }[];
    const indices = (await get('/api/indices')) as {
      code: string;
      latestPrice: { date: string } | null;
    }[];
    const indexHistory = (await get('/api/indices/BRVM-C/prices')) as {
      date: string;
    }[];
    const valuation = (await get(
      `/api/portfolios/${portfolioId}/valuation`,
    )) as {
      positions: { ticker: string; valuation: { priceDate: string } | null }[];
    };
    const watchlist = (await get('/api/watchlist')) as Priced[];
    return {
      // Securities without any price yet (none here but ZZZZ) show nothing.
      catalogue: [
        ...new Set(catalogue.flatMap((s) => s.latestPrice?.date ?? [])),
      ],
      company: company.latestPrice?.date,
      history: history.map((p) => p.date),
      indices: [...new Set(indices.map((i) => i.latestPrice?.date ?? null))],
      indexHistory: indexHistory.map((p) => p.date),
      valuation: valuation.positions[0].valuation?.priceDate,
      watchlist: watchlist[0].latestPrice?.date,
    };
  }

  /** What servedDays() returns when `last` is the last validated day. */
  const allShowing = (days: string[]) => {
    const last = days[days.length - 1];
    return {
      catalogue: [last],
      company: last,
      history: days,
      indices: [last],
      indexHistory: days,
      valuation: last,
      watchlist: last,
    };
  };

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({
      rateLimit: false,
      override: (builder) =>
        builder
          .overrideProvider(BOC_FETCHER)
          .useValue(fetcher)
          .overrideProvider(MailService)
          .useValue({ sendMail }),
    });
    db = app.get(DataSource);
    await seedCatalogue(db);
    await db.query(
      `DELETE FROM "eod_prices" WHERE "tradingDate" >= '2026-11-10'`,
    );
    app
      .get(EventEmitter2)
      .on(BOC_DAY_PUBLISHED, (event: { tradingDate: string }) =>
        published.push(event.tradingDate),
      );

    const adminAccount = await signUp();
    adminEmail = adminAccount.email;
    await db.query(`UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = $1`, [
      adminEmail,
    ]);
    admin = (
      await http()
        .post('/api/auth/sign-in')
        .send({ email: adminEmail, password: PASSWORD })
        .expect(200)
    ).body.accessToken as string;

    member = (await signUp()).token;
    portfolioId = (
      await http()
        .post('/api/portfolios')
        .set('Authorization', as(member))
        .send({ name: 'PEA' })
        .expect(201)
    ).body.id as string;
    await http()
      .post(`/api/portfolios/${portfolioId}/entries`)
      .set('Authorization', as(member))
      .send({
        kind: 'buy',
        ticker: 'SNTS',
        date: '2026-01-05',
        quantity: '10',
        price: '4000',
        fees: '0',
        sgi: 'SGI Test',
      })
      .expect(201);
    await http()
      .put('/api/watchlist/SNTS')
      .set('Authorization', as(member))
      .expect(200);
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => sendMail.mockClear());

  it('starts from the last validated day', async () => {
    expect(await servedDays()).toEqual(allShowing(['2026-11-09']));
  });

  it('is for admins only', async () => {
    await http()
      .get('/api/bulletins')
      .set('Authorization', as(member))
      .expect(403);
    await http()
      .post('/api/bulletins/2026-11-10/ingest')
      .set('Authorization', as(member))
      .expect(403);
    await http().get('/api/bulletins').expect(401);
  });

  it('reports a day whose BOC is not online', async () => {
    expect(await ingest('2026-11-13')).toEqual({
      tradingDate: '2026-11-13',
      outcome: 'not_available',
      failures: [],
    });
    expect((await snapshot('2026-11-13')).bulletin).toEqual([]);
  });

  describe('a day that fails a check', () => {
    beforeAll(async () => {
      // A catalogued security the bulletin does not list.
      await http()
        .post('/api/securities')
        .set('Authorization', as(admin))
        .send({
          ticker: 'ZZZZ',
          name: 'Not Listed SA',
          sectorCode: 'TEL',
          country: 'SN',
        })
        .expect(201);
      online.set('2026-11-10', boc('20261110'));
    });

    it('is held as pending_review with a readable reason, and the admins are emailed', async () => {
      expect(await ingest('2026-11-10')).toEqual({
        tradingDate: '2026-11-10',
        outcome: 'held',
        failures: [
          {
            check: 'securities_present',
            subject: 'ZZZZ',
            reason: 'ZZZZ is in the catalogue but not listed in the bulletin.',
          },
        ],
      });

      const { bulletin, prices } = await snapshot('2026-11-10');
      expect(bulletin).toEqual([
        expect.objectContaining({ status: 'pending_review' }),
      ]);
      // 5 seed securities and 2 indices, all held with the bulletin.
      expect(prices).toHaveLength(7);
      expect(prices).toEqual(
        Array(7).fill(expect.objectContaining({ status: 'pending_review' })),
      );

      expect(sendMail).toHaveBeenCalledWith(
        adminEmail,
        expect.stringContaining('2026-11-10'),
        'boc-day-held',
        expect.objectContaining({
          tradingDate: '2026-11-10',
          reasons: ['ZZZZ is in the catalogue but not listed in the bulletin.'],
        }),
      );
      expect(published).toEqual([]);
    });

    it('is never served: every endpoint keeps the last validated day', async () => {
      expect(await servedDays()).toEqual(allShowing(['2026-11-09']));
    });

    it('stays served nowhere even if a held price row says published', async () => {
      await db.query(
        `UPDATE "eod_prices" SET "status" = 'published' WHERE "tradingDate" = '2026-11-10'`,
      );
      expect(await servedDays()).toEqual(allShowing(['2026-11-09']));
      await db.query(
        `UPDATE "eod_prices" SET "status" = 'pending_review' WHERE "tradingDate" = '2026-11-10'`,
      );
    });

    it('re-running with the same PDF changes nothing (idempotent)', async () => {
      const before = await snapshot('2026-11-10');
      expect(await ingest('2026-11-10')).toMatchObject({
        outcome: 'unchanged',
      });
      expect(await snapshot('2026-11-10')).toEqual(before);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('a different PDF for the held day replaces the held data', async () => {
      const before = await snapshot('2026-11-10');
      online.set('2026-11-10', reissued('20261110'));
      expect(await ingest('2026-11-10')).toMatchObject({ outcome: 'held' });

      const after = await snapshot('2026-11-10');
      const checksum = (s: typeof before) =>
        (s.bulletin[0] as { checksum: string }).checksum;
      expect(checksum(after)).not.toBe(checksum(before));
      expect(after.prices).toHaveLength(7);
      const ids = (s: typeof before) =>
        s.prices.map((p) => (p as { id: string }).id);
      expect(ids(after)).not.toEqual(ids(before));
      expect(await servedDays()).toEqual(allShowing(['2026-11-09']));
    });
  });

  describe('the admin review of a held day', () => {
    it('lists the held day with its reasons', async () => {
      const res = await http()
        .get('/api/bulletins?status=pending_review')
        .set('Authorization', as(admin))
        .expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({
          tradingDate: '2026-11-10',
          status: 'pending_review',
          reference: '214',
          failures: [expect.objectContaining({ subject: 'ZZZZ' })],
        }),
      ]);
    });

    it('shows every row read from the bulletin', async () => {
      const res = await http()
        .get('/api/bulletins/2026-11-10')
        .set('Authorization', as(admin))
        .expect(200);
      expect(res.body.securities).toHaveLength(48);
      expect(
        res.body.securities.find(
          (s: { ticker: string }) => s.ticker === 'SNTS',
        ),
      ).toMatchObject({ inCatalogue: true, close: '4000', traded: true });
      expect(
        res.body.indices.find((i: { code: string }) => i.code === 'BRVM-C'),
      ).toEqual({
        code: 'BRVM-C',
        name: 'BRVM COMPOSITE',
        inCatalogue: true,
        value: '512.81',
        variation: '-1.74',
      });
    });

    it('serves the original PDF', async () => {
      const res = await http()
        .get('/api/bulletins/2026-11-10/document')
        .set('Authorization', as(admin))
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200)
        .expect('Content-Type', 'application/pdf');
      expect((res.body as Buffer).equals(reissued('20261110').document)).toBe(
        true,
      );
    });

    it('corrects a value: the held price changes, and stays held', async () => {
      const res = await http()
        .patch('/api/bulletins/2026-11-10')
        .set('Authorization', as(admin))
        .send({ securities: [{ ticker: 'SNTS', close: '4005' }] })
        .expect(200);
      expect(res.body.status).toBe('pending_review');
      expect(
        res.body.securities.find(
          (s: { ticker: string }) => s.ticker === 'SNTS',
        ),
      ).toMatchObject({ close: '4005' });
      const [{ close, status }] = (await db.query(
        `SELECT p."close", p."status" FROM "eod_prices" p JOIN "securities" s ON s."id" = p."securityId"
         WHERE s."ticker" = 'SNTS' AND p."tradingDate" = '2026-11-10'`,
      )) as { close: string; status: string }[];
      expect({ close, status }).toEqual({
        close: '4005',
        status: 'pending_review',
      });
      expect(await servedDays()).toEqual(allShowing(['2026-11-09']));

      // Put the value as printed back.
      await http()
        .patch('/api/bulletins/2026-11-10')
        .set('Authorization', as(admin))
        .send({ securities: [{ ticker: 'SNTS', close: '4000' }] })
        .expect(200);
    });

    it('refuses a correction for a row the bulletin does not have', async () => {
      await http()
        .patch('/api/bulletins/2026-11-10')
        .set('Authorization', as(admin))
        .send({ securities: [{ ticker: 'NOPE', close: '1' }] })
        .expect(400);
    });

    it('publishes the day: its prices are served from then on', async () => {
      const res = await http()
        .post('/api/bulletins/2026-11-10/publish')
        .set('Authorization', as(admin))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'published',
        reviewedAt: expect.any(String),
      });
      expect(await servedDays()).toEqual(
        allShowing(['2026-11-09', '2026-11-10']),
      );
      expect(published).toEqual(['2026-11-10']);
    });

    it('refuses to publish or correct a day already published', async () => {
      await http()
        .post('/api/bulletins/2026-11-10/publish')
        .set('Authorization', as(admin))
        .expect(409);
      await http()
        .patch('/api/bulletins/2026-11-10')
        .set('Authorization', as(admin))
        .send({ securities: [{ ticker: 'SNTS', close: '1' }] })
        .expect(409);
    });
  });

  describe('a day that passes every check', () => {
    beforeAll(async () => {
      await db.query(`DELETE FROM "securities" WHERE "ticker" = 'ZZZZ'`);
      online.set('2026-11-11', boc('20261111'));
    });

    it('is published straight away and served everywhere', async () => {
      expect(await ingest('2026-11-11')).toEqual({
        tradingDate: '2026-11-11',
        outcome: 'published',
        failures: [],
      });
      expect(await servedDays()).toEqual(
        allShowing(['2026-11-09', '2026-11-10', '2026-11-11']),
      );
      const snts = await http()
        .get('/api/securities/SNTS')
        .set('Authorization', as(member))
        .expect(200);
      expect(snts.body.latestPrice).toEqual({
        date: '2026-11-11',
        close: '4190',
        open: '4000',
        high: null,
        low: null,
        volume: '85624',
        sourceDocument:
          'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf',
        publishedOn: '2026-11-11',
      });
      expect(sendMail).not.toHaveBeenCalled();
      expect(published).toEqual(['2026-11-10', '2026-11-11']);
    });

    it('re-running with the same PDF changes nothing (idempotent)', async () => {
      const before = await snapshot('2026-11-11');
      expect(await ingest('2026-11-11')).toMatchObject({
        outcome: 'unchanged',
      });
      expect(await snapshot('2026-11-11')).toEqual(before);
      expect(published).toEqual(['2026-11-10', '2026-11-11']);
    });

    it('is never silently overwritten by a different PDF', async () => {
      const before = await snapshot('2026-11-11');
      online.set('2026-11-11', reissued('20261111'));
      expect(await ingest('2026-11-11')).toMatchObject({
        outcome: 'published_kept',
      });
      expect(await snapshot('2026-11-11')).toEqual(before);
      expect(sendMail).toHaveBeenCalledWith(
        adminEmail,
        expect.stringContaining('2026-11-11'),
        'boc-day-held',
        expect.anything(),
      );
    });
  });

  it('holds a bulletin that is not for the day it was fetched for', async () => {
    online.set('2026-11-12', boc('20261120'));
    const result = await ingest('2026-11-12');
    expect(result.outcome).toBe('held');
    expect(result.failures).toContainEqual({
      check: 'trading_date',
      subject: null,
      reason: 'The bulletin is dated 2026-11-20, not 2026-11-12.',
    });
    expect((await servedDays()).company).toBe('2026-11-11');
  });
});
