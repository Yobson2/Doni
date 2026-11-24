import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';
const SGI = 'SGI Test Bourse';
/** Placeholder notices: test data only, not real notices. */
const NOTICE = 'https://www.brvm.org/fr/avis/test-dividende-snts';
const SPLIT_NOTICE = 'https://www.brvm.org/fr/avis/test-split-snts';

/** A day relative to today (UTC), as YYYY-MM-DD. */
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/*
 * Seeded BOC prices (see boc-seed-data): the latest published close of SNTS
 * is 4190 on 2026-11-11. The holder's SNTS history: 100 bought on
 * 2025-01-06 at 20000 (+ 5000 fees); a 1:5 split effective 2025-03-03 makes
 * them 500 at PMP 4010; a dividend with ex-date 2025-05-12 (gross 100 per
 * share); 200 sold on 2025-06-02 at 4500 (− 1000 fees), after the ex-date.
 */
describe('Dividends (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;
  let admin: string;
  let holder: string;
  let other: string;
  let portfolio: string;
  /** The reference dividend with ex-date 2025-05-12. */
  let paid: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;
  const dividendsPath = (ticker = 'SNTS') =>
    `/api/securities/${ticker}/dividends`;

  async function signUp(): Promise<{ email: string; token: string }> {
    const email = `div${++emailCounter}-${Date.now()}@example.com`;
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
    const res = await http()
      .post('/api/auth/sign-in')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  const declare = (body: object, ticker = 'SNTS') =>
    http()
      .post(dividendsPath(ticker))
      .set('Authorization', as(admin))
      .send({ sourceNoticeUrl: NOTICE, ...body });

  const record = (token: string, portfolioId: string, entry: object) =>
    http()
      .post(`/api/portfolios/${portfolioId}/entries`)
      .set('Authorization', as(token))
      .send({ sgi: SGI, ...entry });

  const calendarOf = async (token: string, portfolioId: string) =>
    (
      await http()
        .get(`/api/portfolios/${portfolioId}/dividends`)
        .set('Authorization', as(token))
        .expect(200)
    ).body as Array<Record<string, string | null>>;

  const valuationOf = async (token: string, portfolioId: string) =>
    (
      await http()
        .get(`/api/portfolios/${portfolioId}/valuation`)
        .set('Authorization', as(token))
        .expect(200)
    ).body as {
      totals: Record<string, string | null>;
      positions: Array<Record<string, unknown>>;
    };

  const confirm = (
    token: string,
    portfolioId: string,
    referenceDividendId: string,
    body: object,
  ) =>
    http()
      .post(
        `/api/portfolios/${portfolioId}/dividends/${referenceDividendId}/confirmation`,
      )
      .set('Authorization', as(token))
      .send(body);

  const dismissal = (
    method: 'put' | 'delete',
    token: string,
    portfolioId: string,
    referenceDividendId: string,
  ) =>
    http()
      [
        method
      ](`/api/portfolios/${portfolioId}/dividends/${referenceDividendId}/dismissal`)
      .set('Authorization', as(token));

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
    await seedCatalogue(app.get(DataSource));
    admin = await signUpAdmin();
    holder = (await signUp()).token;
    other = (await signUp()).token;

    const res = await http()
      .post('/api/portfolios')
      .set('Authorization', as(holder))
      .send({ name: 'Mon PEA' })
      .expect(201);
    portfolio = res.body.id as string;

    await http()
      .post('/api/securities/SNTS/corporate-actions')
      .set('Authorization', as(admin))
      .send({
        kind: 'split',
        effectiveDate: '2025-03-03',
        ratioHeld: 1,
        ratioReceived: 5,
        sourceNoticeUrl: SPLIT_NOTICE,
      })
      .expect(201);
    await record(holder, portfolio, {
      kind: 'buy',
      ticker: 'SNTS',
      date: '2025-01-06',
      quantity: '100',
      price: '20000',
      fees: '5000',
    }).expect(201);
    await record(holder, portfolio, {
      kind: 'sell',
      ticker: 'SNTS',
      date: '2025-06-02',
      quantity: '200',
      price: '4500',
      fees: '1000',
    }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('reference dividends', () => {
    const terms = {
      grossPerShare: '90',
      exDate: '2025-05-12',
      paymentDate: '2025-05-20',
    };

    it('are entered by admins only, and read by any signed-in user', async () => {
      await http()
        .post(dividendsPath())
        .set('Authorization', as(holder))
        .send({ ...terms, sourceNoticeUrl: NOTICE })
        .expect(403);
      await http().get(dividendsPath()).expect(401);
    });

    it('records the gross amount per share, ex-date, payment date and source notice', async () => {
      const res = await declare(terms).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        ticker: 'SNTS',
        ...terms,
        sourceNoticeUrl: NOTICE,
      });
      paid = res.body.id as string;

      const list = await http()
        .get(dividendsPath())
        .set('Authorization', as(holder))
        .expect(200);
      expect(list.body).toEqual([res.body]);
    });

    it('refuses a second dividend with the same ex-date', async () => {
      await declare(terms).expect(409);
    });

    it.each([
      ['a payment date before the ex-date', { paymentDate: '2025-05-11' }],
      ['a gross amount of zero', { grossPerShare: '0' }],
      ['a gross amount that is not a decimal', { grossPerShare: '1e3' }],
      ['a date that does not exist', { exDate: '2025-02-30' }],
      ['no source notice', { sourceNoticeUrl: 'avis 12' }],
    ])('refuses %s', async (_case, change) => {
      await declare({ ...terms, exDate: '2025-07-01', ...change }).expect(400);
    });

    it('are corrected by an admin, and the suggestion follows', async () => {
      const res = await http()
        .put(`${dividendsPath()}/${paid}`)
        .set('Authorization', as(admin))
        .send({ ...terms, grossPerShare: '100', sourceNoticeUrl: NOTICE })
        .expect(200);
      expect(res.body).toMatchObject({ id: paid, grossPerShare: '100' });

      await http()
        .put(`${dividendsPath()}/${paid}`)
        .set('Authorization', as(holder))
        .send({ ...terms, sourceNoticeUrl: NOTICE })
        .expect(403);
    });
  });

  describe('suggestions', () => {
    it('use the shares held at the ex-date: after the split, before the sale', async () => {
      const calendar = await calendarOf(holder, portfolio);

      expect(calendar).toEqual([
        {
          referenceDividendId: paid,
          ticker: 'SNTS',
          securityName: expect.any(String),
          exDate: '2025-05-12',
          paymentDate: '2025-05-20',
          grossPerShare: '100',
          sourceNoticeUrl: NOTICE,
          // 100 bought × 5 (split) = 500; the 200 sold after the ex-date
          // still earned it.
          shares: '500',
          grossAmount: '50000',
          status: 'suggested',
          netAmount: null,
          entryId: null,
        },
      ]);
    });

    it('are never counted while unconfirmed', async () => {
      const { totals, positions } = await valuationOf(holder, portfolio);

      // 300 left at PMP 4010 = 1203000; 300 × 4190 = 1257000.
      // Realised: (200 × 4500 − 1000) − 200 × 4010 = 97000.
      expect(totals).toEqual({
        costBasis: '1203000',
        realisedGain: '97000',
        marketValue: '1257000',
        unrealisedGain: '54000',
        dividends: '0',
        totalGain: '151000',
      });
      expect(positions[0]).toMatchObject({ ticker: 'SNTS', dividends: '0' });
      const entries = await http()
        .get(`/api/portfolios/${portfolio}/entries`)
        .set('Authorization', as(holder))
        .expect(200);
      expect(entries.body).toHaveLength(2);
    });

    it('are not given to a portfolio without shares at the ex-date', async () => {
      // Before the first buy, and on a security never held.
      await declare({
        grossPerShare: '50',
        exDate: '2024-12-02',
        paymentDate: '2024-12-10',
      }).expect(201);
      const orac = await declare(
        {
          grossPerShare: '50',
          exDate: '2025-05-12',
          paymentDate: '2025-05-20',
        },
        'ORAC',
      ).expect(201);

      const calendar = await calendarOf(holder, portfolio);
      expect(calendar.map((item) => item.referenceDividendId)).toEqual([paid]);
      await confirm(holder, portfolio, orac.body.id as string, {
        amount: '100',
      }).expect(404);
    });
  });

  describe('confirming', () => {
    /** A second dividend, with ex-date 2025-04-01. */
    let april: string;

    beforeAll(async () => {
      april = (
        await declare({
          grossPerShare: '10',
          exDate: '2025-04-01',
          paymentDate: '2025-04-10',
        }).expect(201)
      ).body.id as string;
    });

    it('records only the net amount received as a user dividend, which then counts toward the total gain', async () => {
      const res = await confirm(holder, portfolio, paid, {
        amount: '42500',
      }).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        kind: 'dividend',
        ticker: 'SNTS',
        securityName: expect.any(String),
        date: '2025-05-20',
        quantity: '500',
        price: '100',
        fees: '0',
        amount: '42500',
        referenceDividendId: paid,
        // The SGI the shares were bought through.
        sgi: SGI,
        recordedAt: expect.any(String),
        replacesId: null,
      });

      const { totals, positions } = await valuationOf(holder, portfolio);
      // Quantity, PMP and gains are unchanged; only the net amount counts.
      expect(totals).toEqual({
        costBasis: '1203000',
        realisedGain: '97000',
        marketValue: '1257000',
        unrealisedGain: '54000',
        dividends: '42500',
        totalGain: '193500',
      });
      expect(positions[0]).toMatchObject({
        quantity: '300',
        pmp: '4010',
        dividends: '42500',
      });

      const item = (await calendarOf(holder, portfolio)).find(
        (i) => i.referenceDividendId === paid,
      );
      expect(item).toMatchObject({
        status: 'confirmed',
        netAmount: '42500',
        entryId: res.body.id,
      });
    });

    it('is refused a second time', async () => {
      const res = await confirm(holder, portfolio, paid, {
        amount: '42500',
      }).expect(409);
      expect(res.body.code).toBe('LEDGER_DIVIDEND_003');
      await dismissal('put', holder, portfolio, paid).expect(409);
    });

    it.each([
      ['no amount', {}],
      ['an amount of zero', { amount: '0' }],
      ['a negative amount', { amount: '-5' }],
      ['an amount that is not a decimal', { amount: '4e4' }],
    ])('refuses %s', async (_case, body) => {
      await confirm(holder, portfolio, april, body).expect(400);
    });

    it("cannot be done in another user's portfolio", async () => {
      await confirm(other, portfolio, paid, { amount: '1' }).expect(404);
      await http()
        .get(`/api/portfolios/${portfolio}/dividends`)
        .set('Authorization', as(other))
        .expect(404);
    });

    it('is undone by deleting the ledger entry: the suggestion comes back and nothing counts', async () => {
      const [item] = (await calendarOf(holder, portfolio)).filter(
        (i) => i.referenceDividendId === paid,
      );
      await http()
        .delete(`/api/portfolios/${portfolio}/entries/${item.entryId}`)
        .set('Authorization', as(holder))
        .expect(204);

      const after = (await calendarOf(holder, portfolio)).find(
        (i) => i.referenceDividendId === paid,
      );
      expect(after).toMatchObject({ status: 'suggested', netAmount: null });
      expect((await valuationOf(holder, portfolio)).totals).toMatchObject({
        dividends: '0',
        totalGain: '151000',
      });

      await confirm(holder, portfolio, paid, { amount: '42500' }).expect(201);
    });
  });

  describe('calendar', () => {
    let unpaid: string;
    let upcoming: string;

    beforeAll(async () => {
      unpaid = (
        await declare({
          grossPerShare: '75',
          exDate: day(0),
          paymentDate: day(10),
        }).expect(201)
      ).body.id as string;
      upcoming = (
        await declare({
          grossPerShare: '80',
          exDate: day(20),
          paymentDate: day(30),
        }).expect(201)
      ).body.id as string;
    });

    it('lists upcoming and past dividends of the securities held, by payment date', async () => {
      const calendar = await calendarOf(holder, portfolio);

      expect(
        calendar.map((i) => [i.paymentDate, i.status, i.shares, i.grossAmount]),
      ).toEqual([
        ['2025-04-10', 'suggested', '500', '5000'],
        ['2025-05-20', 'confirmed', '500', '50000'],
        // Paid later: the 300 shares held now earn it.
        [day(10), 'awaiting_payment', '300', '22500'],
        // Ex-date to come: the shares held now, an estimate.
        [day(30), 'upcoming', '300', '24000'],
      ]);
    });

    it('confirms a dividend only once it is paid, and suggests nothing before the ex-date', async () => {
      const notPaid = await confirm(holder, portfolio, unpaid, {
        amount: '20000',
      }).expect(422);
      expect(notPaid.body.code).toBe('LEDGER_DIVIDEND_002');
      await confirm(holder, portfolio, upcoming, { amount: '20000' }).expect(
        404,
      );
      await dismissal('put', holder, portfolio, upcoming).expect(404);
    });

    it('dismisses a suggestion, which stays listed and counts nowhere, and restores it', async () => {
      const statusOf = async (id: string) =>
        (await calendarOf(holder, portfolio)).find(
          (i) => i.referenceDividendId === id,
        )?.status;

      await dismissal('put', holder, portfolio, unpaid).expect(204);
      await dismissal('put', holder, portfolio, unpaid).expect(204);
      expect(await statusOf(unpaid)).toBe('dismissed');
      expect((await valuationOf(holder, portfolio)).totals.dividends).toBe(
        '42500',
      );

      await dismissal('delete', holder, portfolio, unpaid).expect(204);
      expect(await statusOf(unpaid)).toBe('awaiting_payment');

      await dismissal('put', other, portfolio, unpaid).expect(404);
    });
  });

  describe('account data', () => {
    it('exports user dividends with the ledger, and dismissed suggestions', async () => {
      const april = (await calendarOf(holder, portfolio)).find(
        (i) => i.paymentDate === '2025-04-10',
      )!.referenceDividendId as string;
      await dismissal('put', holder, portfolio, april).expect(204);

      const res = await http()
        .get('/api/account/export')
        .set('Authorization', as(holder))
        .expect(200);
      const [exported] = res.body.sections.portfolios as Array<{
        ledger: Array<Record<string, unknown>>;
        dismissedDividends: unknown[];
      }>;

      expect(exported.ledger).toContainEqual(
        expect.objectContaining({
          kind: 'dividend',
          ticker: 'SNTS',
          tradeDate: '2025-05-20',
          quantity: '500',
          price: '100',
          amount: '42500',
          referenceDividendId: paid,
        }),
      );
      expect(exported.dismissedDividends).toEqual([
        {
          referenceDividendId: april,
          ticker: 'SNTS',
          exDate: '2025-04-01',
          dismissedAt: expect.any(String),
        },
      ]);
    });

    it('deletes user dividends and dismissals with the account, and keeps reference dividends', async () => {
      await http()
        .post('/api/account/deletion')
        .set('Authorization', as(holder))
        .send({ password: PASSWORD })
        .expect(204);

      const db = app.get(DataSource);
      const count = async (sql: string, params: unknown[] = []) =>
        Number((await db.query(sql, params))[0].count);
      expect(
        await count(
          `SELECT count(*) FROM "ledger_entries" WHERE "portfolioId" = $1`,
          [portfolio],
        ),
      ).toBe(0);
      expect(
        await count(
          `SELECT count(*) FROM "dividend_dismissals" WHERE "portfolioId" = $1`,
          [portfolio],
        ),
      ).toBe(0);
      expect(
        await count(`SELECT count(*) FROM "reference_dividends"`),
      ).toBeGreaterThan(0);
    });
  });
});
