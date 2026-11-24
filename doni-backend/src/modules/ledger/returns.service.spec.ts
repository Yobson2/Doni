import { periodStart, toPercent } from './returns.service';

describe('returns periods', () => {
  it('starts each period on the same day of an earlier month', () => {
    expect(periodStart('1M', '2026-11-24')).toBe('2026-10-24');
    expect(periodStart('3M', '2026-11-24')).toBe('2026-08-24');
    expect(periodStart('1Y', '2026-11-24')).toBe('2025-11-24');
    expect(periodStart('YTD', '2026-11-24')).toBe('2026-01-01');
  });

  it('uses the last day of a shorter month', () => {
    expect(periodStart('1M', '2026-03-31')).toBe('2026-02-28');
    expect(periodStart('3M', '2026-05-31')).toBe('2026-02-28');
    expect(periodStart('1Y', '2028-02-29')).toBe('2027-02-28');
    expect(periodStart('1M', '2026-01-15')).toBe('2025-12-15');
  });

  it('starts the whole history before any ledger entry', () => {
    expect(periodStart('ALL', '2026-11-24') < '1900-01-01').toBe(true);
  });
});

describe('returns as percentages', () => {
  it('has two decimal places', () => {
    expect(toPercent('0.1')).toBe('10.00');
    expect(toPercent('-0.0012345')).toBe('-0.12');
    expect(toPercent('0')).toBe('0.00');
    expect(toPercent('0.0891089109')).toBe('8.91');
  });
});
