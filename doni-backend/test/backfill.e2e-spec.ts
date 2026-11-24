import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { MailService } from '../src/common/mail/mail.service';
import {
  BackfillDayOutcome,
  BocBackfillService,
  type BackfillSummary,
} from '../src/modules/securities/boc/boc-backfill.service';
import {
  countBackfill,
  renderBackfillReport,
} from '../src/modules/securities/boc/boc-backfill-report';
import type {
  BocFetcher,
  FetchedBoc,
} from '../src/modules/securities/boc/boc-fetcher';
import { BOC_DAY_PUBLISHED } from '../src/modules/securities/boc/boc-ingestion.service';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';

/** Real BOCs downloaded from brvm.org (test/fixtures/boc/README.md). */
const FILES: Record<string, string> = {
  '2019-01-15': 'boc_20190115.pdf',
  '2020-01-15': 'boc_20200115.pdf',
  '2022-12-30': 'boc_20221230_2.pdf',
  '2025-01-02': 'boc_20250102_2.pdf',
  '2025-06-16': 'boc_20250616_2.pdf',
};
const fetched = (date: string): FetchedBoc => ({
  document: readFileSync(join(__dirname, 'fixtures', 'boc', FILES[date])),
  sourceUrl: `https://www.brvm.org/sites/default/files/${FILES[date]}`,
});

/** The sample run: one weekday without a bulletin, five with one. */
const DAYS = ['2019-01-14', ...Object.keys(FILES)];
const BACKFILLED = ['2019-01-15', '2025-06-16'];
const SEEDED = ['2026-11-09', '2026-11-10', '2026-11-11'];

/*
 * The seed catalogue holds SNTS, ORAC, ETIT, PALC, SGBC and the BRVM-C and
 * BRVM-30 indices, with BOC prices for 9 to 11 November 2026. SGBC's and
 * BRVM-30's seeded prices are removed, so their latest price can only come
 * from backfilled history: that is what each endpoint must hide or show.
 */
describe('Historical BOC backfill and the licence gate (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: string;
  let member: string;
  let portfolioId: string;
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const announced: string[] = [];
  const requested: string[] = [];
  const fetcher: BocFetcher = {
    fetch: (date) => {
      requested.push(date);
      return Promise.resolve(FILES[date] ? fetched(date) : null);
    },
  };

  const http = () => request(app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;

  async function boot(historyPublic: boolean): Promise<void> {
    process.env.HISTORY_PUBLIC = String(historyPublic);
    app = await createTestApp({
      rateLimit: false,
      override: (builder) =>
        builder.overrideProvider(MailService).useValue({ sendMail }),
    });
    db = app.get(DataSource);
    app
      .get(EventEmitter2)
      .on(BOC_DAY_PUBLISHED, (e: { tradingDate: string }) =>
        announced.push(e.tradingDate),
      );
  }

  const signIn = async (email: string) =>
    (
      await http()
        .post('/api/auth/sign-in')
        .send({ email, password: PASSWORD })
        .expect(200)
    ).body.accessToken as string;

  /**
   * The trading days every price-serving endpoint shows a member: the
   * catalogue, the company page and its history, the indices and their
   * history, the portfolio valuation, its returns and benchmark, and the
   * watchlist.
   */
  async function served(token: string) {
    const get = async (path: string) =>
      (await http().get(path).set('Authorization', as(token)).expect(200))
        .body as never;
    type Priced = { ticker: string; latestPrice: { date: string } | null };
    const catalogue: Priced[] = await get('/api/securities');
    const company: Priced = await get('/api/securities/SGBC');
    const history: { date: string }[] = await get(
      '/api/securities/SNTS/prices',
    );
    const indices: { code: string; latestPrice: { date: string } | null }[] =
      await get('/api/indices');
    const indexHistory: { date: string }[] = await get(
      '/api/indices/BRVM-C/prices',
    );
    const valuation: {
      positions: { ticker: string; valuation: { priceDate: string } | null }[];
    } = await get(`/api/portfolios/${portfolioId}/valuation`);
    const returns: { comparison: { points: { date: string }[] } } = await get(
      `/api/portfolios/${portfolioId}/returns`,
    );
    const watchlist: Priced[] = await get('/api/watchlist');
    return {
      catalogue: catalogue.find((s) => s.ticker === 'SGBC')?.latestPrice?.date,
      company: company.latestPrice?.date,
      history: history.map((p) => p.date),
      indices: indices.find((i) => i.code === 'BRVM-30')?.latestPrice?.date,
      indexHistory: indexHistory.map((p) => p.date),
      valuation: valuation.positions.find((p) => p.ticker === 'SGBC')?.valuation
        ?.priceDate,
      returns: returns.comparison.points.map((p) => p.date),
      watchlist: watchlist.find((s) => s.ticker === 'SGBC')?.latestPrice?.date,
    };
  }

  let summary: BackfillSummary;
  const adminEmail = `backfill-admin-${Date.now()}@example.com`;
  const memberEmail = `backfill-member-${Date.now()}@example.com`;

  beforeAll(async () => {
    await migrateEmptyDatabase();
    await boot(false);
    await seedCatalogue(db);
    await db.query(
      `DELETE FROM "eod_prices" WHERE "securityId" = (SELECT "id" FROM "securities" WHERE "ticker" = 'SGBC')
          OR "indexId" = (SELECT "id" FROM "market_indices" WHERE "code" = 'BRVM-30')`,
    );
    for (const email of [adminEmail, memberEmail]) {
      await http()
        .post('/api/auth/sign-up')
        .send({ email, password: PASSWORD })
        .expect(201);
    }
    await db.query(`UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = $1`, [
      adminEmail,
    ]);
    admin = await signIn(adminEmail);
    member = await signIn(memberEmail);
    portfolioId = (
      await http()
        .post('/api/portfolios')
        .set('Authorization', as(member))
        .send({ name: 'PEA' })
        .expect(201)
    ).body.id as string;
    for (const ticker of ['SNTS', 'SGBC']) {
      await http()
        .post(`/api/portfolios/${portfolioId}/entries`)
        .set('Authorization', as(member))
        .send({
          kind: 'buy',
          ticker,
          date: '2019-01-10',
          quantity: '10',
          price: '1000',
          fees: '0',
          sgi: 'SGI Test',
        })
        .expect(201);
      await http()
        .put(`/api/watchlist/${ticker}`)
        .set('Authorization', as(member))
        .expect(200);
    }

    summary = await app.get(BocBackfillService).run({ days: DAYS, fetcher });
  }, 240000);

  afterAll(async () => {
    await app?.close();
    delete process.env.HISTORY_PUBLIC;
  });

  describe('the backfill command', () => {
    it('imports, holds and misses days, and counts them in its report', () => {
      expect(
        summary.days.map((d) => [d.tradingDate, d.outcome, d.layout]),
      ).toEqual([
        ['2019-01-14', BackfillDayOutcome.NOT_FOUND, null],
        ['2019-01-15', BackfillDayOutcome.IMPORTED, 'sector-2018'],
        // ETIT moved one tick (7.69%), beyond the variation limit.
        ['2020-01-15', BackfillDayOutcome.HELD, 'sector-2018'],
        // ORAC's row is printed without its open.
        ['2022-12-30', BackfillDayOutcome.HELD, 'sector-2018'],
        // An English edition, in no known layout.
        ['2025-01-02', BackfillDayOutcome.HELD, null],
        ['2025-06-16', BackfillDayOutcome.IMPORTED, 'compartment-2023'],
      ]);
      expect(countBackfill(summary)).toEqual({
        weekdays: 6,
        imported: 2,
        held: 3,
        notFound: 1,
        alreadyStored: 0,
        layouts: { 'sector-2018': 3, 'compartment-2023': 1 },
      });

      const report = renderBackfillReport(summary, {
        title: 'Sample',
        from: '2019-01-14',
        to: '2025-06-16',
        generatedAt: 'now',
      });
      expect(report).toContain('| Weekdays considered | 6 |');
      expect(report).toContain('| Imported (every check passed) | 2 |');
      expect(report).toContain('| Held for review (pending_review) | 3 |');
      expect(report).toContain('| No bulletin found | 1 |');
      expect(report).toContain('- sector-2018: 3 day(s)');
      expect(report).toContain(
        '- **readable**: 2 day(s) (2022-12-30, 2025-01-02).',
      );
      expect(report).toContain(
        '- **variation_limits**: 1 day(s) (2020-01-15). E.g. 2020-01-15: ETIT moved 7.69%',
      );
      expect(report).toContain('- **volumes**: 1 day(s) (2022-12-30).');
      expect(report).toContain(
        '1 weekday(s), BRVM holidays or bulletins not online: 2019-01-14.',
      );
      // Listed then, not in the catalogue now: read but not stored.
      expect(report).toMatch(/not catalogued\): .*BICC \(4\)/);
    });

    it('marks what it stored as backfill, and emails one summary, not one per held day', async () => {
      const rows = (await db.query(
        `SELECT "tradingDate"::text AS "date", "origin", "status" FROM "boc_bulletins" ORDER BY "tradingDate"`,
      )) as { date: string; origin: string; status: string }[];
      expect(rows).toEqual([
        { date: '2019-01-15', origin: 'backfill', status: 'published' },
        { date: '2020-01-15', origin: 'backfill', status: 'pending_review' },
        { date: '2022-12-30', origin: 'backfill', status: 'pending_review' },
        { date: '2025-01-02', origin: 'backfill', status: 'pending_review' },
        { date: '2025-06-16', origin: 'backfill', status: 'published' },
      ]);
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][1]).toBe(
        '[Doni] BOC 2019-01-14 to 2025-06-16: backfill: 3 day(s) held for review',
      );
      // History is not news: nothing listening for new prices heard of it.
      expect(announced).toEqual([]);
    });

    it('runs again without downloading or changing anything', async () => {
      const before = (await db.query(
        `SELECT "id", "checksum", "status", "updatedAt" FROM "boc_bulletins" ORDER BY "tradingDate"`,
      )) as unknown[];
      requested.length = 0;
      sendMail.mockClear();

      const again = await app
        .get(BocBackfillService)
        .run({ days: DAYS, fetcher });

      // Only the day with no bulletin is asked for again.
      expect(requested).toEqual(['2019-01-14']);
      expect(countBackfill(again)).toEqual(countBackfill(summary));
      expect(
        await db.query(
          `SELECT "id", "checksum", "status", "updatedAt" FROM "boc_bulletins" ORDER BY "tradingDate"`,
        ),
      ).toEqual(before);
      // Still held: the same one summary.
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('never overwrites a published day, even when retrying held ones', async () => {
      requested.length = 0;
      const retried = await app
        .get(BocBackfillService)
        .run({ days: DAYS, fetcher, retryHeld: true });
      expect(requested).toEqual([
        '2019-01-14',
        '2020-01-15',
        '2022-12-30',
        '2025-01-02',
      ]);
      expect(countBackfill(retried)).toEqual(countBackfill(summary));
    });

    it('leaves a day the daily ingestion stored alone', async () => {
      requested.length = 0;
      await db.query(
        `INSERT INTO "boc_bulletins" ("tradingDate", "status", "origin", "document", "checksum", "sourceUrl", "fetchedAt")
         VALUES ('2026-11-12', 'pending_review', 'daily', '\\x00', repeat('0', 64), 'daily', now())`,
      );
      const kept = await app
        .get(BocBackfillService)
        .run({ days: ['2026-11-12'], fetcher, retryHeld: true });
      expect(kept.days[0].outcome).toBe(BackfillDayOutcome.ALREADY_STORED);
      expect(requested).toEqual([]);
      await db.query(
        `DELETE FROM "boc_bulletins" WHERE "tradingDate" = '2026-11-12'`,
      );
    });
  });

  describe('with HISTORY_PUBLIC off (the default)', () => {
    it('serves no backfilled price on any endpoint', async () => {
      expect(await served(member)).toEqual({
        catalogue: undefined,
        company: undefined,
        history: SEEDED,
        indices: undefined,
        indexHistory: SEEDED,
        valuation: undefined,
        returns: SEEDED,
        watchlist: undefined,
      });
    });

    it('still lets admins review the backfilled bulletins', async () => {
      const list = (
        await http()
          .get('/api/bulletins')
          .set('Authorization', as(admin))
          .expect(200)
      ).body as { tradingDate: string; origin: string }[];
      expect(
        list.filter((b) => b.origin === 'backfill').map((b) => b.tradingDate),
      ).toEqual(expect.arrayContaining(BACKFILLED));
    });
  });

  describe('with HISTORY_PUBLIC on (licence gate cleared)', () => {
    beforeAll(async () => {
      await app.close();
      await boot(true);
      member = await signIn(memberEmail);
    }, 60000);

    it('serves the published backfilled days on every endpoint, never the held ones', async () => {
      expect(await served(member)).toEqual({
        catalogue: '2025-06-16',
        company: '2025-06-16',
        history: [...BACKFILLED, ...SEEDED],
        indices: '2025-06-16',
        indexHistory: [...BACKFILLED, ...SEEDED],
        valuation: '2025-06-16',
        returns: expect.arrayContaining(BACKFILLED),
        watchlist: '2025-06-16',
      });
    });
  });
});
