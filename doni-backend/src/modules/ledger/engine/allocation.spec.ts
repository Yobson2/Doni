import { allocate } from '.';
import type { AllocationShare } from '.';

/*
 * How a portfolio's market value is spread, as displayed percentages that
 * always add up to exactly 100.0 (largest-remainder rounding).
 */

const linesOf = (shares: AllocationShare[]) => allocate(shares).lines;

/** The sum of percentages with one decimal place, in tenths (1000 = 100%). */
const sum = (percents: string[]) =>
  percents.reduce((total, p) => total + Math.round(Number(p) * 10), 0);

describe('ledger engine allocate', () => {
  it('is empty when nothing is valued', () => {
    expect(allocate([])).toEqual({ marketValue: '0', lines: [] });
  });

  it('states the whole market value the percentages are shares of, exactly', () => {
    expect(
      allocate([
        { key: 'A', marketValue: '0.1' },
        { key: 'B', marketValue: '0.2' },
        { key: 'A', marketValue: '377100.000001' },
      ]).marketValue,
    ).toBe('377100.300001');
  });

  it('gives a single holding 100.0%', () => {
    expect(linesOf([{ key: 'SNTS', marketValue: '377100' }])).toEqual([
      { key: 'SNTS', marketValue: '377100', percent: '100.0' },
    ]);
  });

  it('shares market value exactly when the shares are round', () => {
    expect(
      linesOf([
        { key: 'ORAC', marketValue: '250000' },
        { key: 'SNTS', marketValue: '750000' },
      ]),
    ).toEqual([
      { key: 'SNTS', marketValue: '750000', percent: '75.0' },
      { key: 'ORAC', marketValue: '250000', percent: '25.0' },
    ]);
  });

  it('adds the market values of holdings with the same key (a sector)', () => {
    expect(
      linesOf([
        { key: 'TEL', marketValue: '377100' },
        { key: 'FIN', marketValue: '100000' },
        { key: 'TEL', marketValue: '200000' },
      ]),
    ).toEqual([
      // 577100 / 677100 = 85.231...%; 100000 / 677100 = 14.768...%
      { key: 'TEL', marketValue: '577100', percent: '85.2' },
      { key: 'FIN', marketValue: '100000', percent: '14.8' },
    ]);
  });

  it('rounds three equal thirds to 33.4 + 33.3 + 33.3, never 99.9', () => {
    const lines = linesOf([
      { key: 'A', marketValue: '1' },
      { key: 'B', marketValue: '1' },
      { key: 'C', marketValue: '1' },
    ]);
    expect(lines.map((l) => l.percent)).toEqual(['33.4', '33.3', '33.3']);
    expect(sum(lines.map((l) => l.percent))).toBe(1000);
  });

  it('gives the leftover tenths to the largest remainders, not to the largest holdings', () => {
    // 66.66% / 16.67% / 16.67% of 6000: floors 66.6 + 16.6 + 16.6 = 99.8,
    // remainders .6 (A), .7 (B), .7 (C): B and C get the two tenths.
    const lines = linesOf([
      { key: 'A', marketValue: '3999.6' },
      { key: 'B', marketValue: '1000.2' },
      { key: 'C', marketValue: '1000.2' },
    ]);
    expect(lines.map((l) => [l.key, l.percent])).toEqual([
      ['A', '66.6'],
      ['B', '16.7'],
      ['C', '16.7'],
    ]);
  });

  it('never shows 100.1 when every share would round up', () => {
    // Seven equal sevenths: 14.2857...% each. Naive rounding gives 7 × 14.3
    // = 100.1; largest remainder gives 14.3 × 6 + 14.2 = 100.0.
    const lines = linesOf(
      'ABCDEFG'.split('').map((key) => ({ key, marketValue: '5' })),
    );
    expect(lines.map((l) => l.percent)).toEqual([
      '14.3',
      '14.3',
      '14.3',
      '14.3',
      '14.3',
      '14.3',
      '14.2',
    ]);
    expect(sum(lines.map((l) => l.percent))).toBe(1000);
  });

  it('shows a tiny holding as 0.0% while the total stays 100.0', () => {
    const lines = linesOf([
      { key: 'BIG', marketValue: '99999999' },
      { key: 'TINY', marketValue: '1' },
    ]);
    expect(lines).toEqual([
      { key: 'BIG', marketValue: '99999999', percent: '100.0' },
      { key: 'TINY', marketValue: '1', percent: '0.0' },
    ]);
  });

  it('sums to 100.0 across many uneven, fractional market values', () => {
    const lines = linesOf([
      { key: 'A', marketValue: '123456.789' },
      { key: 'B', marketValue: '98765.4321' },
      { key: 'C', marketValue: '5555.55' },
      { key: 'D', marketValue: '42' },
      { key: 'E', marketValue: '777777.7' },
      { key: 'F', marketValue: '3.14159' },
    ]);
    expect(sum(lines.map((l) => l.percent))).toBe(1000);
    expect(lines.map((l) => l.key)).toEqual(['E', 'A', 'B', 'C', 'D', 'F']);
  });

  it('is empty when the whole value is zero, since no share can be computed', () => {
    expect(linesOf([{ key: 'A', marketValue: '0' }])).toEqual([]);
  });
});
