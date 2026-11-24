import { readFileSync } from 'fs';
import { join } from 'path';
import type { ParsedTradingDay } from '../prices/price-source';
import { SEED_INDICES, SEED_SECURITIES } from '../seed/boc-seed-data';
import { runChecks } from './boc-checks';
import { BocParser, readNumber } from './boc-parser';

/** Real BOCs downloaded from brvm.org, committed unchanged. */
const FIXTURES = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'boc',
);
const fixture = (date: string) =>
  readFileSync(join(FIXTURES, `boc_${date.replace(/-/g, '')}_2.pdf`));

describe('BocParser (2026 layout, real bulletins)', () => {
  const parser = new BocParser();
  const days = new Map<string, ParsedTradingDay>();

  beforeAll(async () => {
    for (const date of ['2026-11-10', '2026-11-11', '2026-11-20']) {
      days.set(date, await parser.parse(fixture(date)));
    }
  }, 60000);

  const day = (date: string) => days.get(date) as ParsedTradingDay;

  it('reads the session date and bulletin number', () => {
    expect(day('2026-11-10')).toMatchObject({
      tradingDate: '2026-11-10',
      reference: '214',
    });
    expect(day('2026-11-11')).toMatchObject({
      tradingDate: '2026-11-11',
      reference: '215',
    });
    expect(day('2026-11-20')).toMatchObject({
      tradingDate: '2026-11-20',
      reference: '222',
    });
  });

  it('reads every share row of the listing, and nothing else', () => {
    for (const parsed of days.values()) {
      expect(parsed.securities).toHaveLength(48);
      expect(parsed.unreadableRows).toEqual([]);
      const tickers = parsed.securities.map((s) => s.ticker);
      expect(new Set(tickers).size).toBe(48);
      expect(tickers).toEqual(expect.arrayContaining(['SNTS', 'ORAC', 'ETIT']));
    }
  });

  it('agrees with the prices hand-copied from the same bulletins', () => {
    for (const security of SEED_SECURITIES) {
      for (const price of security.prices) {
        const parsed = days.get(price.date);
        if (!parsed) continue;
        const row = parsed.securities.find((s) => s.ticker === security.ticker);
        expect({
          ticker: security.ticker,
          date: price.date,
          ...row,
        }).toMatchObject({
          ticker: security.ticker,
          date: price.date,
          open: price.open,
          close: price.close,
          volume: price.volume,
        });
      }
    }
    for (const index of SEED_INDICES) {
      for (const value of index.values) {
        const parsed = days.get(value.date);
        if (!parsed) continue;
        expect(parsed.indices.find((i) => i.code === index.code)?.value).toBe(
          value.close,
        );
      }
    }
  });

  it('reads a full share row: previous close, open, close, variation, volume, value', () => {
    expect(
      day('2026-11-11').securities.find((s) => s.ticker === 'SNTS'),
    ).toEqual({
      ticker: 'SNTS',
      name: 'SONATEL SN',
      previousClose: '4000',
      open: '4000',
      close: '4190',
      volume: '85624',
      value: '346674225',
      variation: '4.75',
      traded: true,
    });
  });

  it('gives a suspended share its reference price and no open or volume', () => {
    expect(
      day('2026-11-11').securities.find((s) => s.ticker === 'SICC'),
    ).toMatchObject({
      previousClose: '8400',
      open: null,
      close: '8400',
      volume: null,
      value: null,
      traded: false,
    });
  });

  it('reads the headline, compartment, total-return and sector indices', () => {
    const indices = day('2026-11-11').indices;
    expect(indices.map((i) => i.code).sort()).toEqual(
      [
        'BRVM-C',
        'BRVM-30',
        'BRVM-PRESTIGE',
        'BRVM-PRINCIPAL',
        'BRVM-C-TR',
        'BRVM-TEL',
        'BRVM-FIN',
        'BRVM-CD',
        'BRVM-CB',
        'BRVM-IND',
        'BRVM-ENE',
        'BRVM-SPU',
      ].sort(),
    );
    expect(indices.find((i) => i.code === 'BRVM-C')).toEqual({
      code: 'BRVM-C',
      name: 'BRVM COMPOSITE',
      value: '517.17',
      variation: '0.85',
    });
    // The footnote mark printed on some days is not part of the name.
    expect(
      day('2026-11-20').indices.find((i) => i.code === 'BRVM-PRINCIPAL'),
    ).toMatchObject({ name: 'BRVM-PRINCIPAL', value: '337.96' });
  });

  it('keeps the totals and repeated values the checks compare with', () => {
    expect(day('2026-11-11').controls).toEqual({
      totalVolume: '858599',
      repeatedIndexValues: [
        {
          code: 'BRVM-PRESTIGE',
          value: '192.47',
          where: 'index tables, front page',
        },
        {
          code: 'BRVM-PRESTIGE',
          value: '192.47',
          where: 'share listing heading',
        },
        {
          code: 'BRVM-PRINCIPAL',
          value: '361.64',
          where: 'share listing heading',
        },
      ],
    });
  });

  it('reads bulletins that pass every check', () => {
    for (const parsed of days.values()) {
      const failures = runChecks(parsed, {
        expectedTradingDate: parsed.tradingDate,
        catalogueTickers: parsed.securities.map((s) => s.ticker),
        catalogueIndexCodes: parsed.indices.map((i) => i.code),
        previousIndexValues: new Map(),
        publishedCloses: new Map(),
      });
      expect(failures).toEqual([]);
    }
  });

  it('reads index variations consistent with the previous session', () => {
    const previous = day('2026-11-10');
    const failures = runChecks(day('2026-11-11'), {
      expectedTradingDate: '2026-11-11',
      catalogueTickers: [],
      catalogueIndexCodes: [],
      previousIndexValues: new Map(
        previous.indices.map((i) => [i.code, i.value]),
      ),
      publishedCloses: new Map(),
    });
    expect(failures).toEqual([]);
  });

  it('refuses a PDF that is not a BOC', async () => {
    await expect(parser.parse(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});

describe('readNumber', () => {
  it.each([
    ['13 000', '13000'],
    ['1 203 694 075', '1203694075'],
    ['0,85 %', '0.85'],
    ['-0,21 %', '-0.21'],
    ['517,17', '517.17'],
  ])('reads %p as %p', (printed, decimal) => {
    expect(readNumber(printed)).toBe(decimal);
  });

  it.each(['SP', 'NC', '', '7-sept.-26'])('does not read %p', (printed) => {
    expect(readNumber(printed)).toBeNull();
  });
});
