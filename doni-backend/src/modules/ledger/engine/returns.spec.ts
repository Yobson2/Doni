import { portfolioReturns } from '.';
import type { CorporateAction, DatedValue, LedgerEntry, ReturnsInput } from '.';

/*
 * Hand-computed portfolio return cases (ADR 0007): a ledger, end-of-day
 * prices and BRVM Composite values in; XIRR, TWR next to the benchmark, and
 * data gaps out. The hand calculation is next to each case. Dates avoid
 * 29 February, so 2025-01-02 → 2026-01-02 → 2027-01-02 are 365 days apart.
 */

const S = 'sec-s';
const T = 'sec-t';

let nextId = 0;
const id = () => `e${String(++nextId).padStart(3, '0')}`;
const trade =
  (kind: 'buy' | 'sell') =>
  (
    date: string,
    quantity: string,
    price: string,
    fees = '0',
    securityId = S,
  ): LedgerEntry => ({
    id: id(),
    kind,
    securityId,
    date,
    quantity,
    price,
    fees,
  });
const buy = trade('buy');
const sell = trade('sell');
const opening = (
  date: string,
  quantity: string,
  pmp: string,
  securityId = S,
): LedgerEntry => ({
  id: id(),
  kind: 'opening_position',
  securityId,
  date,
  quantity,
  pmp,
});
const dividend = (date: string, amount: string): LedgerEntry => ({
  id: id(),
  kind: 'dividend',
  securityId: S,
  date,
  amount,
});

/** A series from [date, value] pairs. */
const series = (...points: [string, string][]): DatedValue[] =>
  points.map(([date, value]) => ({ date, value }));

const run = (input: Partial<ReturnsInput> & Pick<ReturnsInput, 'entries'>) =>
  portfolioReturns({
    prices: new Map(),
    benchmark: [],
    from: '2000-01-01',
    to: '2030-12-31',
    ...input,
  });

describe('ledger engine portfolioReturns', () => {
  it('measures contributions made at different times: XIRR and TWR', () => {
    // 10 S bought at 100 on 2025-01-02, 10 more at 110 a year later.
    //
    //   date        close  shares  value  paid in
    //   2025-01-02   100     10    1000    1000
    //   2025-12-31   110     10    1100
    //   2026-01-02   110     20    2200    1100
    //   2027-01-02   121     20    2420
    //
    // XIRR: −1000, −1100 a year later, +2420 after two years. At 10 %:
    // 2420 / 1.21 = 2000 = 1000 + 1100 / 1.1, so 0.1.
    // TWR: 1000/1000 = 1; 1100/1000 = 1.1; 2200/(1100 + 1100) = 1;
    // 2420/2200 = 1.1. Cumulative: 0, 0.1, 0.1, 0.21.
    // BRVM Composite: 200, 210, 210, 231, so 0, 0.05, 0.05, 0.155.
    const result = run({
      entries: [buy('2025-01-02', '10', '100'), buy('2026-01-02', '10', '110')],
      prices: new Map([
        [
          S,
          series(
            ['2025-01-02', '100'],
            ['2025-12-31', '110'],
            ['2026-01-02', '110'],
            ['2027-01-02', '121'],
          ),
        ],
      ]),
      benchmark: series(
        ['2025-01-02', '200'],
        ['2025-12-31', '210'],
        ['2026-01-02', '210'],
        ['2027-01-02', '231'],
      ),
    });

    expect(result.period).toEqual({ from: '2025-01-02', to: '2027-01-02' });
    expect(result.xirr).toEqual({ status: 'solved', rate: '0.1' });
    expect(result.series).toEqual([
      { date: '2025-01-02', portfolio: '0', benchmark: '0' },
      { date: '2025-12-31', portfolio: '0.1', benchmark: '0.05' },
      { date: '2026-01-02', portfolio: '0.1', benchmark: '0.05' },
      { date: '2027-01-02', portfolio: '0.21', benchmark: '0.155' },
    ]);
    expect(result.gaps).toEqual([]);
  });

  it('counts a user dividend as money received on its payment date', () => {
    // 10 S at 100; a 100 net dividend on 2026-01-02 (price unchanged);
    // worth 1100 on 2027-01-02.
    // XIRR: −1000, +100, +1100: 100/1.1 + 1100/1.21 = 1000, so 0.1.
    // TWR: 1000/1000 = 1; (1000 + 100)/1000 = 1.1; 1100/1000 = 1.1.
    // Cumulative: 0, 0.1, 0.21.
    const result = run({
      entries: [buy('2025-01-02', '10', '100'), dividend('2026-01-02', '100')],
      prices: new Map([
        [
          S,
          series(
            ['2025-01-02', '100'],
            ['2026-01-02', '100'],
            ['2027-01-02', '110'],
          ),
        ],
      ]),
      benchmark: series(
        ['2025-01-02', '100'],
        ['2026-01-02', '100'],
        ['2027-01-02', '100'],
      ),
    });

    expect(result.xirr).toEqual({ status: 'solved', rate: '0.1' });
    expect(result.series.map((p) => p.portfolio)).toEqual(['0', '0.1', '0.21']);
  });

  it('starts from an opening position at its value on that date, not its PMP', () => {
    // An earlier buy of S at 50 is superseded by the opening position:
    // 10 S held on 2025-01-02 at a PMP of 80. Performance starts then,
    // even when "since the start" is asked for. They are worth
    // 10 × 100 = 1000 on that day: money paid in. 1100 a year later.
    // XIRR: −1000, +1100, so 0.1 (from the PMP, 80 → 110, it would be
    // 37.5 %: not a return of this period). TWR: 0, then 0.1.
    const result = run({
      entries: [
        buy('2024-03-01', '4', '50'),
        opening('2025-01-02', '10', '80'),
      ],
      prices: new Map([
        [
          S,
          series(
            ['2024-03-01', '50'],
            ['2025-01-02', '100'],
            ['2026-01-02', '110'],
          ),
        ],
      ]),
      benchmark: series(['2025-01-02', '100'], ['2026-01-02', '120']),
    });

    expect(result.period).toEqual({ from: '2025-01-02', to: '2026-01-02' });
    expect(result.xirr).toEqual({ status: 'solved', rate: '0.1' });
    expect(result.series).toEqual([
      { date: '2025-01-02', portfolio: '0', benchmark: '0' },
      { date: '2026-01-02', portfolio: '0.1', benchmark: '0.2' },
    ]);
  });

  it('values the holdings a shorter period starts with at their latest close', () => {
    // Bought 10 S at 50 in 2024 (before the period: its cost plays no
    // part). The period asked for runs from Saturday 2025-01-04 to Sunday
    // 2026-01-04. It starts with 10 S at Friday's close, 100: −1000 on
    // 2025-01-04. It ends on the last trading day, Friday 2026-01-02, 363
    // days later: +10 × 110 = 1100 (the 2026-01-05 close is after it).
    // XIRR: (1 + r)^(363/365) = 1.1, so r = 1.1^(365/363) − 1.
    // TWR: 1100 / 1000 − 1 = 0.1. Benchmark from Friday's 100: 150 is +0.5.
    const result = run({
      entries: [buy('2024-06-03', '10', '50')],
      prices: new Map([
        [
          S,
          series(
            ['2024-06-03', '50'],
            ['2025-01-03', '100'],
            ['2026-01-02', '110'],
            ['2026-01-05', '110.05'],
          ),
        ],
      ]),
      benchmark: series(
        ['2025-01-03', '100'],
        ['2026-01-02', '150'],
        ['2026-01-05', '150'],
      ),
      from: '2025-01-04',
      to: '2026-01-04',
    });

    expect(result.period).toEqual({ from: '2025-01-04', to: '2026-01-02' });
    expect(result.series).toEqual([
      { date: '2026-01-02', portfolio: '0.1', benchmark: '0.5' },
    ]);
    const rate = Number((result.xirr as { rate: string }).rate);
    expect(rate).toBeCloseTo(Math.pow(1.1, 365 / 363) - 1, 9);
  });

  it('is unchanged by a split in the period', () => {
    // 10 S at 100. A 1:2 split effective 2025-06-02: 20 shares, and the
    // close halves from 104 to 52. Value 10 × 104 = 1040 the day before,
    // 20 × 52 = 1040 on the day: no jump. 20 × 55 = 1100 on 2026-01-02.
    // XIRR: −1000, +1100 a year later, so 0.1.
    // TWR: 0, 1040/1000 − 1 = 0.04, 0.04, 1100/1000 − 1 = 0.1.
    const split: CorporateAction = {
      id: 'ca1',
      kind: 'split',
      securityId: S,
      effectiveDate: '2025-06-02',
      held: '1',
      received: '2',
    };
    const result = run({
      entries: [buy('2025-01-02', '10', '100')],
      corporateActions: [split],
      prices: new Map([
        [
          S,
          series(
            ['2025-01-02', '100'],
            ['2025-05-30', '104'],
            ['2025-06-02', '52'],
            ['2026-01-02', '55'],
          ),
        ],
      ]),
      benchmark: series(
        ['2025-01-02', '100'],
        ['2025-05-30', '100'],
        ['2025-06-02', '100'],
        ['2026-01-02', '100'],
      ),
    });

    expect(result.xirr).toEqual({ status: 'solved', rate: '0.1' });
    expect(result.series.map((p) => p.portfolio)).toEqual([
      '0',
      '0.04',
      '0.04',
      '0.1',
    ]);
  });

  it('counts the cash paid for a fraction of a share as money received', () => {
    // 10 S at 100. A 4:1 reverse split effective 2026-01-02 with cash in
    // lieu at 400 per new share: 10 × 1/4 = 2.5 new shares, 2 kept and
    // 0.5 × 400 = 200 paid. Close 400: 2 × 400 = 800 held + 200 received
    // = 1000, no return. 2 × 550 = 1100 on 2027-01-02.
    // XIRR: −1000, +200 after a year, +1100 after two:
    // 200/1.1 + 1100/1.21 = 181.81… + 909.09… = 1090.9… > 1000, so above
    // 10 %. Solving 1000 = 200/(1+r) + 1100/(1+r)²: (1+r) = 1.1844…,
    // r = (0.2 + √(0.04 + 4.4)) / 2 − 1 = 0.15356…
    // TWR: 0; (800 + 200)/1000 = 1; 1100/800 = 1.375, so 0, 0, 0.375.
    const reverse: CorporateAction = {
      id: 'ca2',
      kind: 'reverse_split',
      securityId: S,
      effectiveDate: '2026-01-02',
      held: '4',
      received: '1',
      cashInLieuPrice: '400',
    };
    const result = run({
      entries: [buy('2025-01-02', '10', '100')],
      corporateActions: [reverse],
      prices: new Map([
        [
          S,
          series(
            ['2025-01-02', '100'],
            ['2026-01-02', '400'],
            ['2027-01-02', '550'],
          ),
        ],
      ]),
      benchmark: series(
        ['2025-01-02', '1'],
        ['2026-01-02', '1'],
        ['2027-01-02', '1'],
      ),
    });

    expect(result.series.map((p) => p.portfolio)).toEqual(['0', '0', '0.375']);
    const rate = Number((result.xirr as { rate: string }).rate);
    expect(rate).toBeCloseTo((0.2 + Math.sqrt(0.04 + 4.4)) / 2 - 1, 9);
  });

  it('measures a sale as money received, and nothing once all is sold', () => {
    // 10 S at 100, all sold at 110 less 10 fees a year later: 1090.
    // XIRR: −1000, +1090, so 0.09. TWR: 0, (0 + 1090)/1000 − 1 = 0.09,
    // then nothing invested: 0.09.
    const result = run({
      entries: [
        buy('2025-01-02', '10', '100'),
        sell('2026-01-02', '10', '110', '10'),
      ],
      prices: new Map([
        [
          S,
          series(
            ['2025-01-02', '100'],
            ['2026-01-02', '110'],
            ['2026-01-05', '120'],
          ),
        ],
      ]),
      benchmark: series(
        ['2025-01-02', '1'],
        ['2026-01-02', '1'],
        ['2026-01-05', '1'],
      ),
    });

    expect(result.xirr).toEqual({ status: 'solved', rate: '0.09' });
    expect(result.series.map((p) => p.portfolio)).toEqual([
      '0',
      '0.09',
      '0.09',
    ]);
  });

  describe('data gaps', () => {
    it('lists each day a held security has no price or the benchmark has no value, and leaves its point out', () => {
      // S and T held. 2025-01-03: no T price, so no portfolio point.
      // 2025-01-06: no benchmark value, so no benchmark point. Nothing is
      // carried forward: the TWR links 2025-01-02 straight to 2025-01-07.
      // Values: 10 × 100 + 10 × 100 = 2000; ?; 2100; 2200.
      // TWR: 0, null, 2100/2000 − 1 = 0.05, 2200/2000 − 1 = 0.1.
      const result = run({
        entries: [
          buy('2025-01-02', '10', '100'),
          buy('2025-01-02', '10', '100', '0', T),
        ],
        prices: new Map([
          [
            S,
            series(
              ['2025-01-02', '100'],
              ['2025-01-03', '105'],
              ['2025-01-06', '105'],
              ['2025-01-07', '110'],
            ),
          ],
          [
            T,
            series(
              ['2025-01-02', '100'],
              ['2025-01-06', '105'],
              ['2025-01-07', '110'],
            ),
          ],
        ]),
        benchmark: series(
          ['2025-01-02', '100'],
          ['2025-01-03', '101'],
          ['2025-01-07', '102'],
        ),
      });

      expect(result.gaps).toEqual([
        { date: '2025-01-03', benchmark: false, securityIds: [T] },
        { date: '2025-01-06', benchmark: true, securityIds: [] },
      ]);
      expect(result.series).toEqual([
        { date: '2025-01-02', portfolio: '0', benchmark: '0' },
        { date: '2025-01-03', portfolio: null, benchmark: '0.01' },
        { date: '2025-01-06', portfolio: '0.05', benchmark: null },
        { date: '2025-01-07', portfolio: '0.1', benchmark: '0.02' },
      ]);
    });

    it('does not count a missing price of a security no longer held', () => {
      // T is sold on 2025-01-02; it has no price afterwards: not a gap.
      const result = run({
        entries: [
          buy('2025-01-02', '10', '100'),
          buy('2025-01-02', '10', '100', '0', T),
          sell('2025-01-03', '10', '100', '0', T),
        ],
        prices: new Map([
          [
            S,
            series(
              ['2025-01-02', '100'],
              ['2025-01-03', '100'],
              ['2025-01-06', '100'],
            ),
          ],
          [T, series(['2025-01-02', '100'], ['2025-01-03', '100'])],
        ]),
        benchmark: series(
          ['2025-01-02', '1'],
          ['2025-01-03', '1'],
          ['2025-01-06', '1'],
        ),
      });

      expect(result.gaps).toEqual([]);
      expect(result.series.every((p) => p.portfolio !== null)).toBe(true);
    });

    it('cannot compute the XIRR when the holdings at the start have no price on or before it', () => {
      // The opening position's security has no close until after it.
      const result = run({
        entries: [opening('2025-01-02', '10', '80')],
        prices: new Map([[S, series(['2025-01-03', '100'])]]),
        benchmark: series(['2025-01-02', '100'], ['2025-01-03', '100']),
      });

      expect(result.xirr).toEqual({ status: 'unpriced' });
      expect(result.gaps).toEqual([
        { date: '2025-01-02', benchmark: false, securityIds: [S] },
      ]);
      expect(result.series.map((p) => p.portfolio)).toEqual([null, null]);
    });
  });

  it('has nothing to measure for an empty ledger', () => {
    expect(run({ entries: [] })).toEqual({
      period: null,
      xirr: { status: 'no_solution' },
      series: [],
      gaps: [],
    });
  });
});
