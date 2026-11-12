import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';
const SGI = 'SGI Test Bourse';

/*
 * Seeded BOC prices (see boc-seed-data): latest published closes on
 * 2026-11-11 are SNTS 4190 and ORAC 20000.
 */
describe('Portfolios and ledger (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;
  let alice: string;
  let bob: string;
  let alicePortfolio: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;

  async function signUp(): Promise<string> {
    const res = await http()
      .post('/api/auth/sign-up')
      .send({
        email: `pf${++emailCounter}-${Date.now()}@example.com`,
        password: PASSWORD,
      })
      .expect(201);
    return res.body.accessToken as string;
  }

  async function createPortfolio(token: string, name: string) {
    const res = await http()
      .post('/api/portfolios')
      .set('Authorization', as(token))
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  const record = (token: string, portfolioId: string, entry: object) =>
    http()
      .post(`/api/portfolios/${portfolioId}/entries`)
      .set('Authorization', as(token))
      .send({ sgi: SGI, ...entry });

  const entriesOf = async (token: string, portfolioId: string) =>
    (
      await http()
        .get(`/api/portfolios/${portfolioId}/entries`)
        .set('Authorization', as(token))
        .expect(200)
    ).body as Array<Record<string, string>>;

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
    await seedCatalogue(app.get(DataSource));
    alice = await signUp();
    bob = await signUp();
    alicePortfolio = await createPortfolio(alice, 'Mon portefeuille');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('needs to be signed in', async () => {
    await http().get('/api/portfolios').expect(401);
    await http().post('/api/portfolios').send({ name: 'X' }).expect(401);
  });

  it('records buys and sells with their fees and SGI', async () => {
    const buy = await record(alice, alicePortfolio, {
      kind: 'buy',
      ticker: 'SNTS',
      date: '2026-01-05',
      quantity: '100',
      price: '4000',
      fees: '2000',
    }).expect(201);
    expect(buy.body).toMatchObject({
      kind: 'buy',
      ticker: 'SNTS',
      securityName: expect.any(String),
      date: '2026-01-05',
      quantity: '100',
      price: '4000',
      fees: '2000',
      sgi: SGI,
    });

    await record(alice, alicePortfolio, {
      kind: 'sell',
      ticker: 'SNTS',
      date: '2026-03-16',
      quantity: '60',
      price: '4500',
      fees: '1350',
    }).expect(201);
    // Recorded after the sale, dated before it.
    await record(alice, alicePortfolio, {
      kind: 'buy',
      ticker: 'SNTS',
      date: '2026-02-10',
      quantity: '50',
      price: '4300',
      fees: '1075',
    }).expect(201);
    await record(alice, alicePortfolio, {
      kind: 'buy',
      ticker: 'ORAC',
      date: '2026-04-01',
      quantity: '10',
      price: '20500',
    }).expect(201);

    const entries = await entriesOf(alice, alicePortfolio);
    expect(
      entries.map((e) => [e.date, e.kind, e.ticker, e.fees, e.sgi]),
    ).toEqual([
      ['2026-01-05', 'buy', 'SNTS', '2000', SGI],
      ['2026-02-10', 'buy', 'SNTS', '1075', SGI],
      ['2026-03-16', 'sell', 'SNTS', '1350', SGI],
      ['2026-04-01', 'buy', 'ORAC', '0', SGI],
    ]);
  });

  it('values positions at the latest end-of-day price, with its date', async () => {
    const res = await http()
      .get(`/api/portfolios/${alicePortfolio}/valuation`)
      .set('Authorization', as(alice))
      .expect(200);

    // ORAC: 10 × 20500 = 205000; 10 × 20000 = 200000
    // SNTS: PMP 618075 / 150 = 4120.5; 90 left = 370845; 90 × 4190 = 377100
    //       realised (60 × 4500 − 1350) − 60 × 4120.5 = 21420
    expect(res.body).toEqual({
      portfolio: {
        id: alicePortfolio,
        name: 'Mon portefeuille',
        createdAt: expect.any(String),
      },
      positions: [
        {
          ticker: 'ORAC',
          name: expect.any(String),
          quantity: '10',
          pmp: '20500',
          costBasis: '205000',
          realisedGain: '0',
          valuation: {
            price: '20000',
            priceDate: '2026-11-11',
            marketValue: '200000',
            unrealisedGain: '-5000',
          },
        },
        {
          ticker: 'SNTS',
          name: expect.any(String),
          quantity: '90',
          pmp: '4120.5',
          costBasis: '370845',
          realisedGain: '21420',
          valuation: {
            price: '4190',
            priceDate: '2026-11-11',
            marketValue: '377100',
            unrealisedGain: '6255',
          },
        },
      ],
      totals: {
        costBasis: '575845',
        realisedGain: '21420',
        marketValue: '577100',
        unrealisedGain: '1255',
      },
      // The full trade history: performance runs from the first entry.
      performanceSince: '2026-01-05',
    });
  });

  it('values only at published prices: a pending_review day is ignored', async () => {
    await app.get(DataSource).query(
      `INSERT INTO "eod_prices" ("securityId", "tradingDate", "close", "sourceDocument", "publishedOn", "status")
       SELECT "id", '2026-11-12', 9999, 'boc', '2026-11-12', 'pending_review'
       FROM "securities" WHERE "ticker" = 'SNTS'`,
    );

    const res = await http()
      .get(`/api/portfolios/${alicePortfolio}/valuation`)
      .set('Authorization', as(alice))
      .expect(200);
    expect(
      res.body.positions.find((p: { ticker: string }) => p.ticker === 'SNTS')
        .valuation,
    ).toMatchObject({ price: '4190', priceDate: '2026-11-11' });
  });

  describe('rejects', () => {
    it('selling more than is held, and records nothing', async () => {
      const res = await record(alice, alicePortfolio, {
        kind: 'sell',
        ticker: 'SNTS',
        date: '2026-05-01',
        quantity: '91',
        price: '4500',
      }).expect(422);
      expect(res.body.errors[0]).toMatchObject({
        code: 'LEDGER_ENTRY_001',
        context: { ticker: 'SNTS', held: '90', sold: '91' },
      });
      expect(await entriesOf(alice, alicePortfolio)).toHaveLength(4);
    });

    it('a sale dated before the shares were bought', async () => {
      await record(alice, alicePortfolio, {
        kind: 'sell',
        ticker: 'ORAC',
        date: '2026-03-31',
        quantity: '1',
        price: '20000',
      }).expect(422);
    });

    it('a backdated sale that would leave a later sale uncovered', async () => {
      // 150 held from 2026-02-10 until the sale of 60 on 2026-03-16.
      await record(alice, alicePortfolio, {
        kind: 'sell',
        ticker: 'SNTS',
        date: '2026-03-01',
        quantity: '100',
        price: '4500',
      }).expect(422);
    });

    it.each([
      ['an unknown ticker', { ticker: 'NOPE' }],
      ['a trade date after today', { date: '2999-01-01' }],
      ['an impossible date', { date: '2026-02-30' }],
      ['a fractional quantity', { quantity: '1.5' }],
      ['a zero quantity', { quantity: '0' }],
      ['a negative price', { price: '-1' }],
      ['a float-style number', { price: '4e3' }],
      ['negative fees', { fees: '-5' }],
      ['a missing SGI', { sgi: '' }],
    ])('%s', async (_case, override) => {
      await record(alice, alicePortfolio, {
        kind: 'buy',
        ticker: 'SNTS',
        date: '2026-05-01',
        quantity: '1',
        price: '4000',
        ...override,
      }).expect(400);
    });
  });

  describe('opening positions', () => {
    let holder: string;
    let portfolio: string;

    const open = (token: string, portfolioId: string, body: object) =>
      http()
        .post(`/api/portfolios/${portfolioId}/opening-positions`)
        .set('Authorization', as(token))
        .send({ sgi: SGI, ...body });

    beforeAll(async () => {
      holder = await signUp();
      portfolio = await createPortfolio(holder, 'Déjà investi');
    });

    it('starts an empty portfolio with no performance date', async () => {
      const res = await http()
        .get(`/api/portfolios/${portfolio}/valuation`)
        .set('Authorization', as(holder))
        .expect(200);
      expect(res.body.performanceSince).toBeNull();
    });

    it('records an opening position as a ledger entry, its PMP as the price and no fees', async () => {
      const res = await open(holder, portfolio, {
        ticker: 'SNTS',
        date: '2026-01-02',
        quantity: '200',
        pmp: '3850.25',
      }).expect(201);
      expect(res.body).toMatchObject({
        kind: 'opening_position',
        ticker: 'SNTS',
        date: '2026-01-02',
        quantity: '200',
        price: '3850.25',
        fees: '0',
        sgi: SGI,
      });
    });

    it('combines with later trades, and measures performance only from its date', async () => {
      await record(holder, portfolio, {
        kind: 'sell',
        ticker: 'SNTS',
        date: '2026-03-16',
        quantity: '80',
        price: '4200',
        fees: '1680',
      }).expect(201);
      // A trade of another security dated before the opening position.
      await record(holder, portfolio, {
        kind: 'buy',
        ticker: 'ORAC',
        date: '2025-12-01',
        quantity: '10',
        price: '20500',
      }).expect(201);

      const res = await http()
        .get(`/api/portfolios/${portfolio}/valuation`)
        .set('Authorization', as(holder))
        .expect(200);

      // SNTS: realised (80 × 4200 − 1680) − 80 × 3850.25 = 334320 − 308020
      //       = 26300; 120 left at 3850.25 = 462030; 120 × 4190 = 502800
      // ORAC: 205000 at cost; 10 × 20000 = 200000
      expect(
        res.body.positions.find((p: { ticker: string }) => p.ticker === 'SNTS'),
      ).toMatchObject({
        quantity: '120',
        pmp: '3850.25',
        costBasis: '462030',
        realisedGain: '26300',
        valuation: { marketValue: '502800', unrealisedGain: '40770' },
      });
      expect(res.body.totals).toEqual({
        costBasis: '667030',
        realisedGain: '26300',
        marketValue: '702800',
        unrealisedGain: '35770',
      });
      // SNTS before 2026-01-02 is unknown: never earlier, despite ORAC.
      expect(res.body.performanceSince).toBe('2026-01-02');
    });

    it('is refused when a later sale would then exceed the shares held', async () => {
      // A new opening position of 50 on 2026-03-01 leaves the sale of 80
      // on 2026-03-16 uncovered.
      const res = await open(holder, portfolio, {
        ticker: 'SNTS',
        date: '2026-03-01',
        quantity: '50',
        pmp: '4000',
      }).expect(422);
      expect(res.body.errors[0]).toMatchObject({
        code: 'LEDGER_ENTRY_001',
        context: { ticker: 'SNTS', held: '50', sold: '80' },
      });
      expect(await entriesOf(holder, portfolio)).toHaveLength(3);
    });

    it('cannot be recorded through the buy and sell endpoint', async () => {
      await record(holder, portfolio, {
        kind: 'opening_position',
        ticker: 'SNTS',
        date: '2026-01-02',
        quantity: '1',
        price: '4000',
      }).expect(400);
    });

    it.each([
      ['an unknown ticker', { ticker: 'NOPE' }],
      ['a date after today', { date: '2999-01-01' }],
      ['a fractional quantity', { quantity: '1.5' }],
      ['a zero quantity', { quantity: '0' }],
      ['a negative PMP', { pmp: '-1' }],
      ['a missing PMP', { pmp: undefined }],
      ['a missing SGI', { sgi: '' }],
    ])('rejects %s', async (_case, override) => {
      await open(holder, portfolio, {
        ticker: 'ORAC',
        date: '2026-01-02',
        quantity: '1',
        pmp: '20000',
        ...override,
      }).expect(400);
    });

    it("cannot be recorded in another user's portfolio", async () => {
      await open(bob, portfolio, {
        ticker: 'SNTS',
        date: '2026-01-02',
        quantity: '1',
        pmp: '1',
      }).expect(404);
      expect(await entriesOf(holder, portfolio)).toHaveLength(3);
    });
  });

  describe('ownership', () => {
    it("never lists another user's portfolio", async () => {
      const bobsOwn = await createPortfolio(bob, 'Bob');
      const res = await http()
        .get('/api/portfolios')
        .set('Authorization', as(bob))
        .expect(200);
      expect(res.body.map((p: { id: string }) => p.id)).toEqual([bobsOwn]);
    });

    it("cannot read another user's portfolio: it answers as if it did not exist", async () => {
      await http()
        .get(`/api/portfolios/${alicePortfolio}/valuation`)
        .set('Authorization', as(bob))
        .expect(404);
      await http()
        .get(`/api/portfolios/${alicePortfolio}/entries`)
        .set('Authorization', as(bob))
        .expect(404);
    });

    it("cannot record entries in another user's portfolio", async () => {
      await record(bob, alicePortfolio, {
        kind: 'sell',
        ticker: 'SNTS',
        date: '2026-05-01',
        quantity: '90',
        price: '1',
      }).expect(404);
      await record(bob, alicePortfolio, {
        kind: 'buy',
        ticker: 'SNTS',
        date: '2026-05-01',
        quantity: '1',
        price: '1',
      }).expect(404);

      // Alice's ledger is untouched.
      expect(await entriesOf(alice, alicePortfolio)).toHaveLength(4);
    });
  });

  it('keeps the ledger append-only: the database refuses to change an entry', async () => {
    await expect(
      app
        .get(DataSource)
        .query(`UPDATE "ledger_entries" SET "quantity" = 1000000`),
    ).rejects.toThrow(/append-only/);
  });
});
