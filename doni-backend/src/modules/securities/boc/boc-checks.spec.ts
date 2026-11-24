import { PriceStatus } from '../entities/price-status';
import type { ParsedTradingDay } from '../prices/price-source';
import {
  BocCheck,
  type CheckContext,
  outcomeOf,
  runChecks,
} from './boc-checks';

/** A small day that passes every check; each test breaks one thing. */
function goodDay(): ParsedTradingDay {
  return {
    tradingDate: '2026-11-11',
    reference: '215',
    securities: [
      {
        ticker: 'SNTS',
        name: 'SONATEL SN',
        previousClose: '4000',
        open: '4000',
        close: '4190',
        volume: '85624',
        value: '346674225',
        variation: '4.75',
        traded: true,
      },
      {
        ticker: 'ORAC',
        name: "ORANGE COTE D'IVOIRE",
        previousClose: '20000',
        open: '20000',
        close: '20000',
        volume: '1309',
        value: '26433210',
        variation: '0.00',
        traded: true,
      },
      {
        ticker: 'SICC',
        name: 'SICOR CI',
        previousClose: '8400',
        open: null,
        close: '8400',
        volume: null,
        value: null,
        variation: '0.00',
        traded: false,
      },
    ],
    indices: [
      {
        code: 'BRVM-C',
        name: 'BRVM COMPOSITE',
        value: '517.17',
        variation: '0.85',
      },
      {
        code: 'BRVM-PRESTIGE',
        name: 'BRVM PRESTIGE',
        value: '192.47',
        variation: '0.45',
      },
    ],
    controls: {
      totalVolume: '86933',
      repeatedIndexValues: [
        {
          code: 'BRVM-PRESTIGE',
          value: '192.47',
          where: 'share listing heading',
        },
      ],
    },
    unreadableRows: [],
  };
}

function context(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    expectedTradingDate: '2026-11-11',
    catalogueTickers: ['SNTS', 'ORAC', 'SICC'],
    catalogueIndexCodes: ['BRVM-C', 'BRVM-PRESTIGE'],
    // BRVM-C was 512.81 the session before: +0.85%.
    previousIndexValues: new Map([['BRVM-C', '512.81']]),
    publishedCloses: new Map(),
    ...overrides,
  };
}

/** Runs every check and returns the day's status and its reasons. */
function evaluate(day: ParsedTradingDay, ctx = context()) {
  const failures = runChecks(day, ctx);
  return { status: outcomeOf(failures), failures };
}

describe('BOC checks', () => {
  it('publishes a day that passes every check', () => {
    expect(evaluate(goodDay())).toEqual({
      status: PriceStatus.PUBLISHED,
      failures: [],
    });
  });

  it('holds a bulletin dated another day than the one fetched', () => {
    const day = { ...goodDay(), tradingDate: '2026-11-10' };
    expect(evaluate(day)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.TRADING_DATE,
          subject: null,
          reason: 'The bulletin is dated 2026-11-10, not 2026-11-11.',
        },
      ],
    });
  });

  it('holds a day with a share row that could not be read', () => {
    const day = { ...goodDay(), unreadableRows: ['XXXC SOME TITLE 1 200 ??'] };
    expect(evaluate(day)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.READABLE,
          subject: 'XXXC',
          reason:
            'This line of the share listing could not be read: "XXXC SOME TITLE 1 200 ??".',
        },
      ],
    });
  });

  it('holds a day when a catalogued security is missing from the bulletin', () => {
    const ctx = context({ catalogueTickers: ['SNTS', 'ORAC', 'SICC', 'BOAB'] });
    expect(evaluate(goodDay(), ctx)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.SECURITIES_PRESENT,
          subject: 'BOAB',
          reason: 'BOAB is in the catalogue but not listed in the bulletin.',
        },
      ],
    });
  });

  it('holds a day when a move exceeds the BRVM daily variation limit', () => {
    const day = goodDay();
    // 4000 to 4400 is +10%, beyond ±7.5%.
    day.securities[0] = { ...day.securities[0], close: '4400' };
    expect(evaluate(day)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.VARIATION_LIMITS,
          subject: 'SNTS',
          reason:
            'SNTS moved 10.00% (4000 to 4400), beyond the BRVM daily limit of ±7.50%.',
        },
      ],
    });
  });

  it('accepts a move of exactly the limit', () => {
    const day = goodDay();
    day.securities[0] = { ...day.securities[0], close: '3700' }; // -7.5%
    expect(evaluate(day).failures).toEqual([]);
  });

  it('holds a day whose index values disagree with each other', () => {
    const day = goodDay();
    day.controls.repeatedIndexValues[0].value = '192.74';
    expect(evaluate(day)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.INDEX_CONSISTENCY,
          subject: 'BRVM-PRESTIGE',
          reason:
            'BRVM-PRESTIGE is 192.47 on the front page but 192.74 in the share listing heading.',
        },
      ],
    });
  });

  it('holds a day whose index variation does not match the previous session', () => {
    const ctx = context({ previousIndexValues: new Map([['BRVM-C', '500']]) });
    expect(evaluate(goodDay(), ctx)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.INDEX_CONSISTENCY,
          subject: 'BRVM-C',
          reason:
            'BRVM-C went from 500 to 517.17 (3.43%), but the bulletin prints a daily variation of 0.85%.',
        },
      ],
    });
  });

  it('holds a day when a catalogued index is missing', () => {
    const ctx = context({
      catalogueIndexCodes: ['BRVM-C', 'BRVM-PRESTIGE', 'BRVM-30'],
    });
    expect(evaluate(goodDay(), ctx).failures).toEqual([
      {
        check: BocCheck.INDEX_CONSISTENCY,
        subject: 'BRVM-30',
        reason: 'BRVM-30 is in the catalogue but not in the bulletin.',
      },
    ]);
  });

  it('holds a day with a negative volume', () => {
    const day = goodDay();
    day.securities[1] = { ...day.securities[1], volume: '-1309' };
    day.controls.totalVolume = '84315';
    expect(evaluate(day)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.VOLUMES,
          subject: 'ORAC',
          reason: 'ORAC has a negative volume (-1309).',
        },
      ],
    });
  });

  it('holds a day whose volumes do not add up to the printed total', () => {
    const day = goodDay();
    day.controls.totalVolume = '90000';
    expect(evaluate(day)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.VOLUMES,
          subject: null,
          reason:
            'Share volumes add up to 86933, but the bulletin prints a total of 90000.',
        },
      ],
    });
  });

  it('holds a day that contradicts a price already published for it', () => {
    const ctx = context({ publishedCloses: new Map([['SNTS', '4200']]) });
    expect(evaluate(goodDay(), ctx)).toEqual({
      status: PriceStatus.PENDING_REVIEW,
      failures: [
        {
          check: BocCheck.AGREES_WITH_PUBLISHED,
          subject: 'SNTS',
          reason:
            'SNTS: the bulletin gives 4190, but 4200 is already published for that day.',
        },
      ],
    });
  });

  it('reports every failure, not just the first', () => {
    const day = { ...goodDay(), tradingDate: '2026-11-10' };
    day.controls.totalVolume = '1';
    const ctx = context({ catalogueTickers: ['SNTS', 'ORAC', 'SICC', 'BOAB'] });
    expect(evaluate(day, ctx).failures.map((f) => f.check)).toEqual([
      BocCheck.TRADING_DATE,
      BocCheck.SECURITIES_PRESENT,
      BocCheck.VOLUMES,
    ]);
  });
});
