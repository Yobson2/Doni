import { performanceStart } from '.';
import type { LedgerEntry } from '.';

/*
 * The first day from which a portfolio's performance can be measured
 * (ADR 0007): before it, at least one holding is not known.
 */

let nextId = 0;
const buy = (date: string, securityId = 'snts'): LedgerEntry => ({
  id: `e${++nextId}`,
  kind: 'buy',
  securityId,
  date,
  quantity: '10',
  price: '1000',
  fees: '0',
});
const opening = (date: string, securityId = 'snts'): LedgerEntry => ({
  id: `e${++nextId}`,
  kind: 'opening_position',
  securityId,
  date,
  quantity: '10',
  pmp: '1000',
});

describe('ledger engine performanceStart', () => {
  it('is unknown for an empty ledger', () => {
    expect(performanceStart([])).toBeNull();
  });

  it('is the first entry date when the full trade history was entered', () => {
    expect(
      performanceStart([buy('2026-03-01'), buy('2025-07-15', 'orac')]),
    ).toBe('2025-07-15');
  });

  it('is the date of the opening position', () => {
    expect(performanceStart([buy('2026-03-01'), opening('2026-01-02')])).toBe(
      '2026-01-02',
    );
  });

  it('never starts before an opening position, even when other securities have earlier trades', () => {
    // ORAC's history goes back to 2024, but SNTS before 2026-01-02 is unknown.
    expect(
      performanceStart([
        buy('2024-05-06', 'orac'),
        opening('2026-01-02'),
        opening('2025-06-30', 'orac'),
      ]),
    ).toBe('2026-01-02');
  });
});
