import { twr } from './twr';
import type { TwrDay } from './types';

/*
 * Hand-computed TWR cases (ADR 0007). Each valued day's sub-period return is
 *
 *   (value + money taken out) / (previous value + money put in) − 1
 *
 * and the cumulative TWR is the product of (1 + each one) − 1. The
 * arithmetic is written next to each case.
 */

const day = (
  date: string,
  value: string | null,
  inflow = '0',
  outflow = '0',
): TwrDay => ({ date, value, inflow, outflow });

describe('ledger engine twr', () => {
  it('compounds the daily returns of an unchanged holding', () => {
    // 1000 → 1100 → 1210: 1.1 × 1.1 − 1 = 0.21.
    expect(
      twr([
        day('2025-01-02', '1000', '1000'),
        day('2025-01-03', '1100'),
        day('2025-01-06', '1210'),
      ]),
    ).toEqual([
      { date: '2025-01-02', twr: '0' },
      { date: '2025-01-03', twr: '0.1' },
      { date: '2025-01-06', twr: '0.21' },
    ]);
  });

  it('is not moved by contributions made at different times', () => {
    // Day 3: 1100 more is put in at the close's price, the value is 2200:
    // 2200 / (1100 + 1100) = 1, no return. Day 4: 2420 / 2200 = 1.1.
    // TWR: 1 × 1.1 × 1 × 1.1 − 1 = 0.21, the same as without the
    // contribution, whatever its size.
    expect(
      twr([
        day('2025-01-02', '1000', '1000'),
        day('2025-01-03', '1100'),
        day('2025-01-06', '2200', '1100'),
        day('2025-01-07', '2420'),
      ]).map((p) => p.twr),
    ).toEqual(['0', '0.1', '0.1', '0.21']);
  });

  it('counts a dividend as part of the return', () => {
    // Value unchanged at 1000 and a 50 dividend: (1000 + 50) / 1000 − 1.
    expect(
      twr([
        day('2025-01-02', '1000', '1000'),
        day('2025-01-03', '1000', '0', '50'),
      ]).map((p) => p.twr),
    ).toEqual(['0', '0.05']);
  });

  it('keeps the return reached once everything is sold', () => {
    // Sold for 1100: (0 + 1100) / 1000 − 1 = 0.1. Then nothing is
    // invested: the return stays 0.1.
    expect(
      twr([
        day('2025-01-02', '1000', '1000'),
        day('2025-01-03', '0', '0', '1100'),
        day('2025-01-06', '0'),
      ]).map((p) => p.twr),
    ).toEqual(['0', '0.1', '0.1']);
  });

  it('measures a first buy from its cost', () => {
    // Bought for 1000 plus 10 fees, worth 1100 at the close:
    // 1100 / 1010 − 1 = 0.0891089108910891…
    expect(twr([day('2025-01-02', '1100', '1010')])).toEqual([
      { date: '2025-01-02', twr: '0.0891089109' },
    ]);
  });

  it('leaves a gap without a point and links across it', () => {
    // Day 2 cannot be valued; its 500 buy carries over to day 3:
    // 1650 / (1000 + 500) = 1.1. Nothing is made up for day 2.
    expect(
      twr([
        day('2025-01-02', '1000', '1000'),
        day('2025-01-03', null, '500'),
        day('2025-01-06', '1650'),
      ]),
    ).toEqual([
      { date: '2025-01-02', twr: '0' },
      { date: '2025-01-03', twr: null },
      { date: '2025-01-06', twr: '0.1' },
    ]);
  });
});
