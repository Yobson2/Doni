import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserDataRegistry } from '../src/common/user-data/user-data.registry';
import { uncoveredUserData } from '../src/common/user-data/coverage';
import { seedCatalogue } from '../src/modules/securities/seed/seed-catalogue';
import { migrateEmptyDatabase } from './support/database';
import { refreshCookieFrom, REFRESH_COOKIE } from './support/session';
import { createTestApp } from './support/test-app';

const PASSWORD = 'CorrectHorse9!';
const SGI = 'SGI Test Bourse';

interface Member {
  userId: string;
  email: string;
  accessToken: string;
  refreshCookie: string;
}

describe('Account data export and deletion (e2e)', () => {
  let app: INestApplication;
  let emailCounter = 0;

  const http = () => request(app.getHttpServer());
  const as = (member: Member) => `Bearer ${member.accessToken}`;

  async function signUp(): Promise<Member> {
    const email = `acct${++emailCounter}-${Date.now()}@example.com`;
    const res = await http()
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD, firstName: 'Awa' })
      .expect(201);
    return {
      userId: res.body.user.id as string,
      email,
      accessToken: res.body.accessToken as string,
      refreshCookie: refreshCookieFrom(res).header,
    };
  }

  async function signIn(email: string): Promise<Member> {
    const res = await http()
      .post('/api/auth/sign-in')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      userId: res.body.user.id as string,
      email,
      accessToken: res.body.accessToken as string,
      refreshCookie: refreshCookieFrom(res).header,
    };
  }

  /** A portfolio with a buy and an opening position, and a watched security. */
  async function giveData(member: Member): Promise<string> {
    const portfolio = await http()
      .post('/api/portfolios')
      .set('Authorization', as(member))
      .send({ name: 'Mon PEA' })
      .expect(201);
    const portfolioId = portfolio.body.id as string;
    await http()
      .post(`/api/portfolios/${portfolioId}/entries`)
      .set('Authorization', as(member))
      .send({
        kind: 'buy',
        ticker: 'SNTS',
        date: '2026-01-05',
        quantity: '10',
        price: '4000',
        fees: '50',
        sgi: SGI,
      })
      .expect(201);
    await http()
      .post(`/api/portfolios/${portfolioId}/opening-positions`)
      .set('Authorization', as(member))
      .send({
        ticker: 'ORAC',
        date: '2026-01-02',
        quantity: '3',
        pmp: '18000',
        sgi: SGI,
      })
      .expect(201);
    await http()
      .put('/api/watchlist/ORAC')
      .set('Authorization', as(member))
      .expect(200);
    return portfolioId;
  }

  const exportOf = (member: Member) =>
    http().get('/api/account/export').set('Authorization', as(member));

  const deleteAccount = (member: Member, body?: object) => {
    const req = http()
      .post('/api/account/deletion')
      .set('Authorization', as(member));
    return body ? req.send(body) : req;
  };

  const refresh = (cookie: string) =>
    http().post('/api/auth/refresh').set('Cookie', cookie);

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp({ rateLimit: false });
    await seedCatalogue(app.get(DataSource));
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('export', () => {
    it('needs to be signed in', async () => {
      await http().get('/api/account/export').expect(401);
    });

    it('downloads all of my data as a JSON file', async () => {
      const alice = await signUp();
      const portfolioId = await giveData(alice);
      // Someone else's data never appears in my export.
      await giveData(await signUp());

      const res = await exportOf(alice).expect(200);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="doni-export-\d{4}-\d{2}-\d{2}\.json"$/,
      );
      const body = res.body as Record<string, unknown>;
      expect(body).toMatchObject({
        format: 'doni-account-export',
        version: 1,
        exportedAt: expect.any(String),
      });
      const sections = body.sections as Record<string, unknown>;
      expect(Object.keys(sections).sort()).toEqual([
        'account',
        'portfolios',
        'sessions',
        'watchlist',
      ]);

      expect(sections.account).toEqual({
        id: alice.userId,
        email: alice.email,
        firstName: 'Awa',
        lastName: null,
        role: 'MEMBRE',
        isActive: true,
        displayCurrency: 'XOF',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(JSON.stringify(body)).not.toMatch(/password|tokenHash/i);

      expect(sections.portfolios).toEqual([
        {
          id: portfolioId,
          name: 'Mon PEA',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          ledger: [
            expect.objectContaining({
              kind: 'opening_position',
              ticker: 'ORAC',
              tradeDate: '2026-01-02',
              quantity: '3',
              price: '18000',
              fees: '0',
              sgi: SGI,
            }),
            expect.objectContaining({
              kind: 'buy',
              ticker: 'SNTS',
              tradeDate: '2026-01-05',
              quantity: '10',
              price: '4000',
              fees: '50',
              sgi: SGI,
              createdAt: expect.any(String),
            }),
          ],
          corrections: [],
        },
      ]);

      expect(sections.watchlist).toEqual([
        { ticker: 'ORAC', addedAt: expect.any(String) },
      ]);

      expect(sections.sessions).toEqual([
        {
          startedAt: expect.any(String),
          lastRefreshedAt: expect.any(String),
          expiresAt: expect.any(String),
          ended: false,
        },
      ]);
    });

    it('exports empty sections for a new account', async () => {
      const bob = await signUp();
      const res = await exportOf(bob).expect(200);
      expect(res.body.sections).toMatchObject({
        portfolios: [],
        watchlist: [],
      });
    });
  });

  describe('deletion', () => {
    it('needs to be signed in', async () => {
      await http()
        .post('/api/account/deletion')
        .send({ password: PASSWORD })
        .expect(401);
    });

    it('is refused without re-entering the password', async () => {
      const carol = await signUp();
      await giveData(carol);

      await deleteAccount(carol).expect(400);
      await deleteAccount(carol, { password: '' }).expect(400);
      const wrong = await deleteAccount(carol, {
        password: 'not-my-password',
      }).expect(403);
      expect(wrong.body.code).toBe('AUTH_REAUTH_001');

      // Nothing was removed and the session still works.
      await http()
        .get('/api/users/me')
        .set('Authorization', as(carol))
        .expect(200);
      await refresh(carol.refreshCookie).expect(200);
      const portfolios = await http()
        .get('/api/portfolios')
        .set('Authorization', as(carol))
        .expect(200);
      expect(portfolios.body).toHaveLength(1);
    });

    it('removes my personal data and ends every session', async () => {
      const dave = await signUp();
      const portfolioId = await giveData(dave);
      // A second session, e.g. on another device.
      const otherDevice = await signIn(dave.email);
      const erin = await signUp();
      const erinPortfolio = await giveData(erin);

      const res = await deleteAccount(dave, { password: PASSWORD }).expect(204);
      // The response clears the refresh cookie.
      expect(refreshCookieFrom(res).value).toBe('');

      const db = app.get(DataSource);
      const count = async (sql: string, params: unknown[]) =>
        Number((await db.query(sql, params))[0].count);
      expect(
        await count(`SELECT count(*) FROM "users" WHERE "id" = $1`, [
          dave.userId,
        ]),
      ).toBe(0);
      expect(
        await count(`SELECT count(*) FROM "portfolios" WHERE "ownerId" = $1`, [
          dave.userId,
        ]),
      ).toBe(0);
      expect(
        await count(
          `SELECT count(*) FROM "ledger_entries" WHERE "portfolioId" = $1`,
          [portfolioId],
        ),
      ).toBe(0);
      expect(
        await count(
          `SELECT count(*) FROM "watchlist_items" WHERE "userId" = $1`,
          [dave.userId],
        ),
      ).toBe(0);
      expect(
        await count(
          `SELECT count(*) FROM "refresh_tokens" WHERE "userId" = $1`,
          [dave.userId],
        ),
      ).toBe(0);

      // Every session is rejected: refresh cookies and access tokens alike.
      await refresh(dave.refreshCookie).expect(401);
      await refresh(otherDevice.refreshCookie).expect(401);
      await http()
        .get('/api/users/me')
        .set('Authorization', as(dave))
        .expect(401);
      await http()
        .get('/api/portfolios')
        .set('Authorization', as(otherDevice))
        .expect(401);
      await exportOf(otherDevice).expect(401);
      await http()
        .post('/api/auth/sign-in')
        .send({ email: dave.email, password: PASSWORD })
        .expect(401);

      // Other users keep their data.
      const erinEntries = await http()
        .get(`/api/portfolios/${erinPortfolio}/entries`)
        .set('Authorization', as(erin))
        .expect(200);
      expect(erinEntries.body).toHaveLength(2);
      await refresh(erin.refreshCookie).expect(200);

      // The address can be used for a new account.
      await http()
        .post('/api/auth/sign-up')
        .send({ email: dave.email, password: PASSWORD })
        .expect(201);
    });

    it('clears the refresh cookie for the auth path only', async () => {
      const frank = await signUp();
      const res = await deleteAccount(frank, { password: PASSWORD }).expect(
        204,
      );
      const cookie = refreshCookieFrom(res);
      expect(cookie.header).toBe(`${REFRESH_COOKIE}=`);
      expect(cookie.attributes).toEqual(
        expect.arrayContaining(['Path=/api/auth', 'HttpOnly']),
      );
    });
  });

  describe('export of corrections', () => {
    it('includes deleted and edited ledger entries with their corrections', async () => {
      const bob = await signUp();
      const portfolioId = await giveData(bob);
      const entries = await http()
        .get(`/api/portfolios/${portfolioId}/entries`)
        .set('Authorization', as(bob))
        .expect(200);
      const buy = (entries.body as { id: string; kind: string }[]).find(
        (e) => e.kind === 'buy',
      ) as { id: string };
      await http()
        .delete(`/api/portfolios/${portfolioId}/entries/${buy.id}`)
        .set('Authorization', as(bob))
        .expect(204);

      const res = await exportOf(bob).expect(200);
      const [portfolio] = (res.body.sections as Record<string, unknown>)
        .portfolios as { ledger: { id: string }[]; corrections: unknown[] }[];

      // The ledger keeps every entry ever recorded, the deleted one too.
      expect(portfolio.ledger.map((e) => e.id)).toContain(buy.id);
      expect(portfolio.corrections).toEqual([
        { entryId: buy.id, replacementId: null, createdAt: expect.any(String) },
      ]);
    });
  });

  describe('coverage', () => {
    it('exports and deletes every table that holds a user’s data', () => {
      const problems = uncoveredUserData(
        app.get(DataSource),
        app.get(UserDataRegistry),
      );
      expect(problems).toEqual([]);
    });

    it('reports a user-owned table that no export section covers', () => {
      const partial = new UserDataRegistry();
      for (const section of app.get(UserDataRegistry).sections()) {
        if (section.key !== 'watchlist') partial.register(section);
      }
      expect(uncoveredUserData(app.get(DataSource), partial)).toEqual([
        'watchlist_items holds user data but no export section covers it',
      ]);
    });
  });
});
