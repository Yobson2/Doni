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
      // 377100 / 577100 = 65.34%, 200000 / 577100 = 34.66%: rounded down to
      // 65.3 + 34.6, the leftover tenth goes to the larger remainder (ORAC).
      allocation: {
        marketValue: '577100',
        bySecurity: [
          {
            ticker: 'SNTS',
            name: expect.any(String),
            marketValue: '377100',
            percent: '65.3',
          },
          {
            ticker: 'ORAC',
            name: expect.any(String),
            marketValue: '200000',
            percent: '34.7',
          },
        ],
        bySector: [
          {
            code: 'TEL',
            nameFr: expect.any(String),
            nameEn: expect.any(String),
            marketValue: '577100',
            percent: '100.0',
          },
        ],
        unpriced: [],
      },
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

  describe('allocation', () => {
    it('spreads the market value by security and by sector, summing to 100.0%, and states the positions left out for want of a price', async () => {
      const carol = await signUp();
      const portfolio = await createPortfolio(carol, 'Réparti');
      // A listed security with no end-of-day price yet.
      await app.get(DataSource).query(
        `INSERT INTO "securities" ("ticker", "name", "sectorId", "country")
         SELECT 'NOPX', 'Sans Cours SA', "id", 'CI' FROM "sectors" WHERE "code" = 'FIN'`,
      );
      const buy = (ticker: string, quantity: string) =>
        record(carol, portfolio, {
          kind: 'buy',
          ticker,
          date: '2026-02-02',
          quantity,
          price: '1000',
        }).expect(201);
      await buy('SNTS', '100'); // 100 × 4190 = 419000 (TEL)
      await buy('SGBC', '10'); //   10 × 38600 = 386000 (FIN)
      await buy('PALC', '50'); //   50 × 7590 = 379500 (CB)
      await buy('ORAC', '10'); //   10 × 20000 = 200000 (TEL)
      await buy('NOPX', '10'); //   no price: left out, and said so
      await buy('ETIT', '10'); //   sold below: a closed position
      await record(carol, portfolio, {
        kind: 'sell',
        ticker: 'ETIT',
        date: '2026-02-03',
        quantity: '10',
        price: '1000',
      }).expect(201);

      const res = await http()
        .get(`/api/portfolios/${portfolio}/valuation`)
        .set('Authorization', as(carol))
        .expect(200);

      // Total 1384500. By security: 30.26 / 27.88 / 27.41 / 14.45%, rounded
      // down to 30.2 + 27.8 + 27.4 + 14.4 = 99.8; the two tenths left go to
      // the largest remainders, SGBC (.80) then SNTS (.64).
      const { allocation } = res.body;
      expect(allocation.marketValue).toBe('1384500');
      expect(
        allocation.bySecurity.map((l: Record<string, string>) => [
          l.ticker,
          l.marketValue,
          l.percent,
        ]),
      ).toEqual([
        ['SNTS', '419000', '30.3'],
        ['SGBC', '386000', '27.9'],
        ['PALC', '379500', '27.4'],
        ['ORAC', '200000', '14.4'],
      ]);
      // By sector: 44.71 / 27.88 / 27.41%; FIN takes the leftover tenth.
      expect(
        allocation.bySector.map((l: Record<string, string>) => [
          l.code,
          l.marketValue,
          l.percent,
        ]),
      ).toEqual([
        ['TEL', '619000', '44.7'],
        ['FIN', '386000', '27.9'],
        ['CB', '379500', '27.4'],
      ]);
      expect(allocation.unpriced).toEqual([
        { ticker: 'NOPX', name: 'Sans Cours SA' },
      ]);
      // The portfolio total stays unknown while a position has no price.
      expect(res.body.totals.marketValue).toBeNull();
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

  describe('correcting the ledger', () => {
    let owner: string;

    const edit = (
      token: string,
      portfolioId: string,
      entryId: string,
      body: object,
    ) =>
      http()
        .put(`/api/portfolios/${portfolioId}/entries/${entryId}`)
        .set('Authorization', as(token))
        .send({ sgi: SGI, ...body });

    const editOpening = (
      token: string,
      portfolioId: string,
      entryId: string,
      body: object,
    ) =>
      http()
        .put(`/api/portfolios/${portfolioId}/opening-positions/${entryId}`)
        .set('Authorization', as(token))
        .send({ sgi: SGI, ...body });

    const remove = (token: string, portfolioId: string, entryId: string) =>
      http()
        .delete(`/api/portfolios/${portfolioId}/entries/${entryId}`)
        .set('Authorization', as(token));

    const open = (token: string, portfolioId: string, body: object) =>
      http()
        .post(`/api/portfolios/${portfolioId}/opening-positions`)
        .set('Authorization', as(token))
        .send({ sgi: SGI, ...body });

    const snts = async (token: string, portfolioId: string) =>
      (
        await http()
          .get(`/api/portfolios/${portfolioId}/valuation`)
          .set('Authorization', as(token))
          .expect(200)
      ).body.positions.find((p: { ticker: string }) => p.ticker === 'SNTS');

    /** Records the entries in order and returns their ids. */
    async function ledgerOf(
      token: string,
      portfolioId: string,
      entries: object[],
    ): Promise<string[]> {
      const ids: string[] = [];
      for (const entry of entries) {
        const res = await record(token, portfolioId, {
          ticker: 'SNTS',
          ...entry,
        }).expect(201);
        ids.push(res.body.id as string);
      }
      return ids;
    }

    beforeAll(async () => {
      owner = await signUp();
    });

    it('editing a trade from years ago updates the current PMP and realised gains', async () => {
      const portfolio = await createPortfolio(owner, 'Historique');
      const [oldBuy] = await ledgerOf(owner, portfolio, [
        // Mistyped years ago: the price was 1500 and the fees 500.
        {
          kind: 'buy',
          date: '2019-03-04',
          quantity: '100',
          price: '2000',
          fees: '1000',
        },
        { kind: 'buy', date: '2026-01-05', quantity: '100', price: '4000' },
        { kind: 'sell', date: '2026-03-16', quantity: '50', price: '4500' },
      ]);
      // Before: (201000 + 400000) / 200 = 3005; realised 225000 − 150250
      expect(await snts(owner, portfolio)).toMatchObject({
        quantity: '150',
        pmp: '3005',
        realisedGain: '74750',
      });

      const res = await edit(owner, portfolio, oldBuy, {
        kind: 'buy',
        ticker: 'SNTS',
        date: '2019-03-04',
        quantity: '100',
        price: '1500',
        fees: '500',
      }).expect(200);
      expect(res.body).toMatchObject({
        kind: 'buy',
        date: '2019-03-04',
        price: '1500',
        fees: '500',
        replacesId: oldBuy,
      });
      expect(res.body.id).not.toBe(oldBuy);

      // After: (150500 + 400000) / 200 = 2752.5
      // realised 50 × 4500 − 50 × 2752.5 = 225000 − 137625 = 87375
      // 150 left = 412875; 150 × 4190 = 628500; unrealised 215625
      expect(await snts(owner, portfolio)).toMatchObject({
        quantity: '150',
        pmp: '2752.5',
        costBasis: '412875',
        realisedGain: '87375',
        valuation: { marketValue: '628500', unrealisedGain: '215625' },
      });

      // The ledger lists the correction in place of the entry it replaces.
      const entries = await entriesOf(owner, portfolio);
      expect(entries.map((e) => [e.date, e.kind, e.price])).toEqual([
        ['2019-03-04', 'buy', '1500'],
        ['2026-01-05', 'buy', '4000'],
        ['2026-03-16', 'sell', '4500'],
      ]);
      expect(entries.map((e) => e.id)).not.toContain(oldBuy);
    });

    describe('an edit or a deletion that would make a position negative at any point in time', () => {
      let portfolio: string;
      let firstBuy: string;
      let sale: string;
      let laterBuy: string;

      beforeAll(async () => {
        portfolio = await createPortfolio(owner, 'Négatif');
        // 100 bought, 80 sold, 100 bought: 120 held today.
        [firstBuy, sale, laterBuy] = await ledgerOf(owner, portfolio, [
          { kind: 'buy', date: '2020-02-03', quantity: '100', price: '2000' },
          { kind: 'sell', date: '2021-06-01', quantity: '80', price: '2500' },
          { kind: 'buy', date: '2022-09-05', quantity: '100', price: '3000' },
        ]);
      });

      it('is refused even when the position today would stay positive', async () => {
        // 50 bought then 80 sold in 2021: −30 then, although 70 today.
        const res = await edit(owner, portfolio, firstBuy, {
          kind: 'buy',
          ticker: 'SNTS',
          date: '2020-02-03',
          quantity: '50',
          price: '2000',
        }).expect(422);
        expect(res.body.errors[0]).toMatchObject({
          code: 'LEDGER_ENTRY_001',
          context: {
            ticker: 'SNTS',
            date: '2021-06-01',
            held: '50',
            sold: '80',
          },
        });
      });

      it('is refused when moving a buy after the sale it covered', async () => {
        await edit(owner, portfolio, firstBuy, {
          kind: 'buy',
          ticker: 'SNTS',
          date: '2021-06-02',
          quantity: '100',
          price: '2000',
        }).expect(422);
      });

      it('is refused when deleting the buy a sale needed', async () => {
        const res = await remove(owner, portfolio, firstBuy).expect(422);
        expect(res.body.errors[0]).toMatchObject({
          code: 'LEDGER_ENTRY_001',
          context: { held: '0', sold: '80' },
        });
      });

      it('leaves the ledger and the positions as they were', async () => {
        expect((await entriesOf(owner, portfolio)).map((e) => e.id)).toEqual([
          firstBuy,
          sale,
          laterBuy,
        ]);
        expect(await snts(owner, portfolio)).toMatchObject({
          quantity: '120',
        });
      });

      it('deletes an entry the ledger does not need, and recomputes', async () => {
        await remove(owner, portfolio, laterBuy).expect(204);

        expect((await entriesOf(owner, portfolio)).map((e) => e.id)).toEqual([
          firstBuy,
          sale,
        ]);
        // 20 left at 2000; realised 80 × 2500 − 80 × 2000 = 40000
        expect(await snts(owner, portfolio)).toMatchObject({
          quantity: '20',
          pmp: '2000',
          realisedGain: '40000',
        });
      });

      it('deletes a sale, after which its buy may be edited down', async () => {
        await remove(owner, portfolio, sale).expect(204);
        await edit(owner, portfolio, firstBuy, {
          kind: 'buy',
          ticker: 'SNTS',
          date: '2020-02-03',
          quantity: '50',
          price: '2000',
        }).expect(200);

        expect(await snts(owner, portfolio)).toMatchObject({
          quantity: '50',
          realisedGain: '0',
        });
      });
    });

    describe('opening positions', () => {
      let portfolio: string;
      let opening: string;

      beforeAll(async () => {
        portfolio = await createPortfolio(owner, 'Ouverture');
        opening = (
          await open(owner, portfolio, {
            ticker: 'SNTS',
            date: '2026-01-02',
            quantity: '200',
            pmp: '3850.25',
          }).expect(201)
        ).body.id as string;
        await record(owner, portfolio, {
          kind: 'sell',
          ticker: 'SNTS',
          date: '2026-03-16',
          quantity: '80',
          price: '4200',
          fees: '1680',
        }).expect(201);
      });

      it('edits an opening position: its quantity, PMP and date', async () => {
        const res = await editOpening(owner, portfolio, opening, {
          ticker: 'SNTS',
          date: '2026-01-05',
          quantity: '180',
          pmp: '3900',
        }).expect(200);
        expect(res.body).toMatchObject({
          kind: 'opening_position',
          date: '2026-01-05',
          quantity: '180',
          price: '3900',
          fees: '0',
          replacesId: opening,
        });
        opening = res.body.id as string;

        // realised (80 × 4200 − 1680) − 80 × 3900 = 334320 − 312000 = 22320
        // 100 left at 3900 = 390000
        expect(await snts(owner, portfolio)).toMatchObject({
          quantity: '100',
          pmp: '3900',
          costBasis: '390000',
          realisedGain: '22320',
        });
        const valuation = await http()
          .get(`/api/portfolios/${portfolio}/valuation`)
          .set('Authorization', as(owner))
          .expect(200);
        expect(valuation.body.performanceSince).toBe('2026-01-05');
      });

      it('refuses an edit of an opening position that leaves a later sale uncovered', async () => {
        await editOpening(owner, portfolio, opening, {
          ticker: 'SNTS',
          date: '2026-01-05',
          quantity: '79',
          pmp: '3900',
        }).expect(422);
      });

      it('refuses deleting an opening position a later sale needs', async () => {
        await remove(owner, portfolio, opening).expect(422);
      });

      it('refuses a second opening position for the same security on the same day: edit the first instead', async () => {
        const res = await open(owner, portfolio, {
          ticker: 'SNTS',
          date: '2026-01-05',
          quantity: '500',
          pmp: '4000',
        }).expect(422);
        expect(res.body.errors[0]).toMatchObject({
          code: 'LEDGER_ENTRY_005',
          context: { ticker: 'SNTS', date: '2026-01-05' },
        });
      });

      it('refuses moving an opening position onto the day of another for the same security', async () => {
        const other = (
          await open(owner, portfolio, {
            ticker: 'SNTS',
            date: '2026-06-01',
            quantity: '100',
            pmp: '4000',
          }).expect(201)
        ).body.id as string;
        await editOpening(owner, portfolio, other, {
          ticker: 'SNTS',
          date: '2026-01-05',
          quantity: '100',
          pmp: '4000',
        }).expect(422);
        // An opening position with nothing depending on it can go.
        await remove(owner, portfolio, other).expect(204);
      });

      it('deletes an opening position once nothing depends on it', async () => {
        const sale = (await entriesOf(owner, portfolio)).find(
          (e) => e.kind === 'sell',
        ) as Record<string, string>;
        await remove(owner, portfolio, sale.id).expect(204);
        await remove(owner, portfolio, opening).expect(204);

        expect(await entriesOf(owner, portfolio)).toEqual([]);
        const valuation = await http()
          .get(`/api/portfolios/${portfolio}/valuation`)
          .set('Authorization', as(owner))
          .expect(200);
        expect(valuation.body.performanceSince).toBeNull();
      });
    });

    describe('answers 404', () => {
      let portfolio: string;
      let buy: string;
      let opening: string;

      beforeAll(async () => {
        portfolio = await createPortfolio(owner, 'Introuvable');
        [buy] = await ledgerOf(owner, portfolio, [
          { kind: 'buy', date: '2026-02-02', quantity: '10', price: '4000' },
        ]);
        opening = (
          await open(owner, portfolio, {
            ticker: 'ORAC',
            date: '2026-01-02',
            quantity: '5',
            pmp: '20000',
          }).expect(201)
        ).body.id as string;
      });

      const trade = {
        kind: 'buy',
        ticker: 'SNTS',
        date: '2026-02-02',
        quantity: '12',
        price: '4000',
      };

      it("for another user's portfolio, and changes nothing", async () => {
        await edit(bob, portfolio, buy, trade).expect(404);
        await remove(bob, portfolio, buy).expect(404);
        // Bob's own portfolio does not hold Alice's entry either.
        const bobs = await createPortfolio(bob, 'Bob 2');
        await edit(bob, bobs, buy, trade).expect(404);
        await remove(bob, bobs, buy).expect(404);
        expect((await entriesOf(owner, portfolio)).map((e) => e.id)).toEqual([
          opening,
          buy,
        ]);
      });

      it('for an entry already replaced or deleted', async () => {
        const replacement = (
          await edit(owner, portfolio, buy, trade).expect(200)
        ).body.id as string;
        await edit(owner, portfolio, buy, trade).expect(404);
        await remove(owner, portfolio, buy).expect(404);

        await remove(owner, portfolio, replacement).expect(204);
        await remove(owner, portfolio, replacement).expect(404);
      });

      it('for an opening position edited as a trade, and a trade as an opening position', async () => {
        await edit(owner, portfolio, opening, {
          ...trade,
          ticker: 'ORAC',
        }).expect(404);
        const [another] = await ledgerOf(owner, portfolio, [trade]);
        await editOpening(owner, portfolio, another, {
          ticker: 'SNTS',
          date: '2026-02-02',
          quantity: '1',
          pmp: '1',
        }).expect(404);
      });

      it('for an id that is not a uuid: 400', async () => {
        await remove(owner, portfolio, 'nope').expect(400);
      });
    });

    it.each([
      ['an unknown ticker', { ticker: 'NOPE' }],
      ['a trade date after today', { date: '2999-01-01' }],
      ['a zero quantity', { quantity: '0' }],
    ])('rejects an edit with %s', async (_case, override) => {
      const portfolio = await createPortfolio(owner, 'Invalide');
      const [buy] = await ledgerOf(owner, portfolio, [
        { kind: 'buy', date: '2026-02-02', quantity: '10', price: '4000' },
      ]);
      await edit(owner, portfolio, buy, {
        kind: 'buy',
        ticker: 'SNTS',
        date: '2026-02-02',
        quantity: '10',
        price: '4000',
        ...override,
      }).expect(400);
    });

    it('keeps corrections append-only: the database refuses to change one', async () => {
      await expect(
        app
          .get(DataSource)
          .query(`UPDATE "ledger_entry_voids" SET "replacementId" = NULL`),
      ).rejects.toThrow(/append-only/);
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
