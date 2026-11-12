import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';
const SGI = 'SGI Test Bourse';
const BOC = 'https://www.brvm.org/sites/default/files/boc_test.pdf';
/** A placeholder notice: test data only, not a real BRVM notice. */
const NOTICE = 'https://www.brvm.org/fr/avis/test-split-tsplit';

/*
 * A test security TSPL with a 1:5 split effective 2026-04-02. Its BOC
 * closes are 20500 on 2026-04-01 (before the split) and 4150 on 2026-04-02.
 */
describe('Corporate actions (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;
  let member: string;
  let admin: string;
  let splitId: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => `Bearer ${token}`;
  const actionsPath = (ticker = 'TSPL') =>
    `/api/securities/${ticker}/corporate-actions`;

  async function signUp(): Promise<{ email: string; token: string }> {
    const email = `ca${++emailCounter}-${Date.now()}@example.com`;
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

  const putPrice = (date: string, close: string) =>
    http()
      .put(`/api/securities/TSPL/prices/${date}`)
      .set('Authorization', as(admin))
      .send({ close, open: close, sourceDocument: BOC, publishedOn: date })
      .expect(200);

  const split = {
    kind: 'split',
    effectiveDate: '2026-04-02',
    ratioHeld: 1,
    ratioReceived: 5,
    sourceNoticeUrl: NOTICE,
  };

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
    member = (await signUp()).token;
    admin = await signUpAdmin();

    await http()
      .post('/api/sectors')
      .set('Authorization', as(admin))
      .send({ code: 'TST', nameFr: 'Test', nameEn: 'Test' })
      .expect(201);
    await http()
      .post('/api/securities')
      .set('Authorization', as(admin))
      .send({
        ticker: 'TSPL',
        name: 'Test Split SA',
        sectorCode: 'TST',
        country: 'CI',
      })
      .expect(201);
    await putPrice('2026-04-01', '20500');
    await putPrice('2026-04-02', '4150');
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('entering corporate actions', () => {
    it('is for admins only', async () => {
      await http()
        .post(actionsPath())
        .set('Authorization', as(member))
        .send(split)
        .expect(403);
      await http().get(actionsPath()).expect(401);
    });

    it('records a split with its ratio, effective date and source notice', async () => {
      const res = await http()
        .post(actionsPath())
        .set('Authorization', as(admin))
        .send(split)
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        ticker: 'TSPL',
        kind: 'split',
        effectiveDate: '2026-04-02',
        ratioHeld: 1,
        ratioReceived: 5,
        cashInLieuPrice: null,
        subscriptionPrice: null,
        sourceNoticeUrl: NOTICE,
      });
      splitId = res.body.id as string;
    });

    it('refuses the same kind of action twice on one date', async () => {
      await http()
        .post(actionsPath())
        .set('Authorization', as(admin))
        .send(split)
        .expect(409);
    });

    it.each([
      ['no source notice', { ...split, sourceNoticeUrl: undefined }],
      [
        'a source notice that is not a link',
        { ...split, sourceNoticeUrl: 'avis 12' },
      ],
      ['a ratio that is not a whole number', { ...split, ratioReceived: 2.5 }],
      ['a split that does not add shares', { ...split, ratioReceived: 1 }],
      [
        'a reverse split that does not remove shares',
        { ...split, kind: 'reverse_split', ratioHeld: 1, ratioReceived: 5 },
      ],
      [
        'a rights issue without its subscription price',
        { ...split, kind: 'rights_issue', ratioHeld: 4, ratioReceived: 1 },
      ],
      [
        'a subscription price on a split',
        { ...split, effectiveDate: '2026-05-01', subscriptionPrice: '3000' },
      ],
    ])('rejects %s', async (_case, body) => {
      await http()
        .post(actionsPath())
        .set('Authorization', as(admin))
        .send(body)
        .expect(400);
    });

    it('corrects and removes an action', async () => {
      const created = await http()
        .post(actionsPath())
        .set('Authorization', as(admin))
        .send({
          kind: 'rights_issue',
          effectiveDate: '2026-06-15',
          ratioHeld: 4,
          ratioReceived: 1,
          subscriptionPrice: '3000',
          sourceNoticeUrl: NOTICE,
        })
        .expect(201);
      const id = created.body.id as string;

      await http()
        .put(`${actionsPath()}/${id}`)
        .set('Authorization', as(admin))
        .send({
          kind: 'rights_issue',
          effectiveDate: '2026-06-15',
          ratioHeld: 5,
          ratioReceived: 1,
          subscriptionPrice: '3100',
          sourceNoticeUrl: NOTICE,
        })
        .expect(200)
        .expect((res) =>
          expect(res.body).toMatchObject({
            ratioHeld: 5,
            subscriptionPrice: '3100',
          }),
        );

      await http()
        .delete(`${actionsPath()}/${id}`)
        .set('Authorization', as(member))
        .expect(403);
      await http()
        .delete(`${actionsPath()}/${id}`)
        .set('Authorization', as(admin))
        .expect(204);
      await http()
        .delete(`${actionsPath()}/${id}`)
        .set('Authorization', as(admin))
        .expect(404);
    });
  });

  describe('as a user', () => {
    it('lists each corporate action with its source notice', async () => {
      const res = await http()
        .get(actionsPath())
        .set('Authorization', as(member))
        .expect(200);

      expect(res.body).toEqual([
        expect.objectContaining({
          id: splitId,
          kind: 'split',
          sourceNoticeUrl: NOTICE,
        }),
      ]);
    });

    it('sees the price history restated in today’s shares, with the published close kept', async () => {
      const res = await http()
        .get('/api/securities/TSPL/prices')
        .set('Authorization', as(member))
        .expect(200);

      expect(res.body).toEqual([
        expect.objectContaining({
          date: '2026-04-01',
          close: '4100',
          open: '4100',
          publishedClose: '20500',
          sourceDocument: BOC,
        }),
        expect.objectContaining({
          date: '2026-04-02',
          close: '4150',
          publishedClose: null,
        }),
      ]);
    });

    it('holds the adjusted position: quantity × 5, PMP ÷ 5, total cost kept', async () => {
      const portfolio = (
        await http()
          .post('/api/portfolios')
          .set('Authorization', as(member))
          .send({ name: 'Split' })
          .expect(201)
      ).body.id as string;
      const record = (entry: object) =>
        http()
          .post(`/api/portfolios/${portfolio}/entries`)
          .set('Authorization', as(member))
          .send({ sgi: SGI, ticker: 'TSPL', ...entry });

      // 100 × 20000 + 5000 = 2005000 → 500 shares at 4010 after the split
      await record({
        kind: 'buy',
        date: '2026-01-05',
        quantity: '100',
        price: '20000',
        fees: '5000',
      }).expect(201);
      // More than the 100 bought, fewer than the 500 held after the split.
      await record({
        kind: 'sell',
        date: '2026-05-11',
        quantity: '300',
        price: '4500',
      }).expect(201);
      await record({
        kind: 'sell',
        date: '2026-05-12',
        quantity: '201',
        price: '4500',
      }).expect(422);

      const res = await http()
        .get(`/api/portfolios/${portfolio}/valuation`)
        .set('Authorization', as(member))
        .expect(200);
      // 200 left at 4010 = 802000; realised 300 × 4500 − 300 × 4010 = 147000
      // valued at 4150 (2026-04-02): 830000; unrealised 28000
      expect(res.body.positions).toEqual([
        expect.objectContaining({
          ticker: 'TSPL',
          quantity: '200',
          pmp: '4010',
          costBasis: '802000',
          realisedGain: '147000',
          valuation: {
            price: '4150',
            priceDate: '2026-04-02',
            marketValue: '830000',
            unrealisedGain: '28000',
          },
        }),
      ]);
    });

    it('checks an edit or a deletion of a ledger entry against the corporate actions in effect', async () => {
      const portfolio = (
        await http()
          .post('/api/portfolios')
          .set('Authorization', as(member))
          .send({ name: 'Split corrections' })
          .expect(201)
      ).body.id as string;
      const entries = `/api/portfolios/${portfolio}/entries`;
      const buy = {
        sgi: SGI,
        ticker: 'TSPL',
        kind: 'buy',
        date: '2026-01-05',
        quantity: '100',
        price: '20000',
      };
      const bought = (
        await http()
          .post(entries)
          .set('Authorization', as(member))
          .send(buy)
          .expect(201)
      ).body.id as string;
      // 300 sold: only covered by the 500 shares held after the split.
      await http()
        .post(entries)
        .set('Authorization', as(member))
        .send({ ...buy, kind: 'sell', date: '2026-05-11', quantity: '300' })
        .expect(201);
      const extra = (
        await http()
          .post(entries)
          .set('Authorization', as(member))
          .send({ ...buy, date: '2026-05-20', quantity: '10' })
          .expect(201)
      ).body.id as string;

      // Accepted: with the split, 500 shares cover the sale of 300.
      const edited = await http()
        .put(`${entries}/${bought}`)
        .set('Authorization', as(member))
        .send({ ...buy, fees: '5000' })
        .expect(200);
      await http()
        .delete(`${entries}/${extra}`)
        .set('Authorization', as(member))
        .expect(204);

      // Refused: 50 bought are 250 after the split, short of the 300 sold.
      const res = await http()
        .put(`${entries}/${edited.body.id}`)
        .set('Authorization', as(member))
        .send({ ...buy, quantity: '50' })
        .expect(422);
      expect(res.body.errors[0]).toMatchObject({
        code: 'LEDGER_ENTRY_001',
        context: { ticker: 'TSPL', held: '250', sold: '300' },
      });
    });

    it('does not apply an announced action before its effective date', async () => {
      await http()
        .post(actionsPath())
        .set('Authorization', as(admin))
        .send({ ...split, effectiveDate: '2099-01-05', ratioReceived: 2 })
        .expect(201);

      const res = await http()
        .get('/api/securities/TSPL/prices')
        .set('Authorization', as(member))
        .expect(200);
      expect(res.body.at(-1)).toMatchObject({
        close: '4150',
        publishedClose: null,
      });
    });

    it('explains, rather than fails, a ledger that a later corporate action makes oversold', async () => {
      await http()
        .post('/api/securities')
        .set('Authorization', as(admin))
        .send({
          ticker: 'TREV',
          name: 'Test Reverse SA',
          sectorCode: 'TST',
          country: 'CI',
        })
        .expect(201);
      const portfolio = (
        await http()
          .post('/api/portfolios')
          .set('Authorization', as(member))
          .send({ name: 'Reverse' })
          .expect(201)
      ).body.id as string;
      const record = (entry: object) =>
        http()
          .post(`/api/portfolios/${portfolio}/entries`)
          .set('Authorization', as(member))
          .send({ sgi: SGI, ticker: 'TREV', ...entry })
          .expect(201);
      await record({
        kind: 'buy',
        date: '2026-01-05',
        quantity: '100',
        price: '400',
      });
      await record({
        kind: 'sell',
        date: '2026-06-01',
        quantity: '100',
        price: '450',
      });

      // Entered afterwards: 10:1 from 2026-05-01 leaves 10 shares to sell 100.
      await http()
        .post(actionsPath('TREV'))
        .set('Authorization', as(admin))
        .send({
          ...split,
          kind: 'reverse_split',
          effectiveDate: '2026-05-01',
          ratioHeld: 10,
          ratioReceived: 1,
        })
        .expect(201);

      const res = await http()
        .get(`/api/portfolios/${portfolio}/valuation`)
        .set('Authorization', as(member))
        .expect(422);
      expect(res.body).toMatchObject({
        code: 'LEDGER_ENTRY_001',
        errors: [
          expect.objectContaining({
            context: {
              ticker: 'TREV',
              date: '2026-06-01',
              held: '10',
              sold: '100',
            },
          }),
        ],
      });
    });
  });
});
