import { xirr } from './xirr';

/*
 * Hand-computed XIRR cases (ADR 0007). The XIRR is the annual rate r with
 *
 *   Σ amount / (1 + r)^(days since the first flow / 365) = 0
 *
 * Each expected rate below was checked by hand by discounting the flows at
 * it, as written next to the case. The dates avoid 29 February, so a year
 * is 365 days: 2025-01-02 → 2026-01-02 → 2027-01-02.
 */

const flow = (date: string, amount: string) => ({ date, amount });

describe('ledger engine xirr', () => {
  it('is 10 % for 1000 paid in and 1100 back a year later', () => {
    // 1100 / 1.1 = 1000.
    expect(
      xirr([flow('2025-01-02', '-1000'), flow('2026-01-02', '1100')]),
    ).toEqual({ status: 'solved', rate: '0.1' });
  });

  it('weighs contributions made at different times by how long they were invested', () => {
    // 1000 in on day 0, 1100 more a year later, 2420 back after two years.
    // At 10 %: 2420 / 1.21 = 2000 = 1000 + 1100 / 1.1. A simple gain on the
    // 2100 paid in (+15.2 %) would ignore that half of it was invested for
    // one year only.
    expect(
      xirr([
        flow('2025-01-02', '-1000'),
        flow('2026-01-02', '-1100'),
        flow('2027-01-02', '2420'),
      ]),
    ).toEqual({ status: 'solved', rate: '0.1' });
  });

  it('counts a dividend received as money back on its date', () => {
    // 1000 in, a 100 dividend after one year, 1100 at the end of the
    // second: 100 / 1.1 + 1100 / 1.21 = 90.909… + 909.090… = 1000.
    expect(
      xirr([
        flow('2025-01-02', '-1000'),
        flow('2026-01-02', '100'),
        flow('2027-01-02', '1100'),
      ]),
    ).toEqual({ status: 'solved', rate: '0.1' });
  });

  it('is negative for a loss', () => {
    // 810 back after two years: (1 + r)² = 0.81, r = −0.1.
    expect(
      xirr([flow('2025-01-02', '-1000'), flow('2027-01-02', '810')]),
    ).toEqual({ status: 'solved', rate: '-0.1' });
  });

  it('annualises a period shorter than a year', () => {
    // +5 % over 182 days: r = 1.05^(365/182) − 1 = 0.10279… per year.
    const result = xirr([
      flow('2025-01-02', '-1000'),
      flow('2025-07-03', '1050'),
    ]);
    expect(result.status).toBe('solved');
    const rate = Number((result as { rate: string }).rate);
    expect(rate).toBeCloseTo(Math.pow(1.05, 365 / 182) - 1, 9);
  });

  it('sums the flows of one day and ignores their order', () => {
    // Same as the first case, split into several flows in any order.
    expect(
      xirr([
        flow('2026-01-02', '1000'),
        flow('2025-01-02', '-600'),
        flow('2026-01-02', '100'),
        flow('2025-01-02', '-400'),
      ]),
    ).toEqual({ status: 'solved', rate: '0.1' });
  });

  it('falls back to bisection where Newton’s method does not converge', () => {
    // 1000 in, 1 back a year later: r = 1 / 1000 − 1 = −0.999. From r = 0,
    // Newton's first step overshoots far beyond the root and creeps back
    // too slowly; the bisection fallback finds it.
    expect(
      xirr([flow('2025-01-02', '-1000'), flow('2026-01-02', '1')]),
    ).toEqual({ status: 'solved', rate: '-0.999' });
  });

  it('has no solution without money both paid in and received', () => {
    expect(xirr([])).toEqual({ status: 'no_solution' });
    expect(
      xirr([flow('2025-01-02', '-1000'), flow('2026-01-02', '-100')]),
    ).toEqual({ status: 'no_solution' });
    expect(xirr([flow('2026-01-02', '1100')])).toEqual({
      status: 'no_solution',
    });
  });

  it('has no solution when everything happens on one day', () => {
    expect(
      xirr([flow('2025-01-02', '-1000'), flow('2025-01-02', '1100')]),
    ).toEqual({ status: 'no_solution' });
  });
});
