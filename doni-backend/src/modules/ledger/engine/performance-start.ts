import type { LedgerEntry } from './types';

/**
 * The first day from which the portfolio's performance can be measured
 * ("performance since <date>", ADR 0007), or null for an empty ledger.
 *
 * With the full trade history, that is the first entry's date. An opening
 * position says nothing about its security before its date, so performance
 * never starts before the latest opening position: earlier, at least one
 * holding is unknown, and no return is computed for that period.
 */
export function performanceStart(
  entries: readonly LedgerEntry[],
): string | null {
  const openings = entries.filter((e) => e.kind === 'opening_position');
  if (openings.length > 0) {
    return openings.map((e) => e.date).reduce((a, b) => (b > a ? b : a));
  }
  if (entries.length === 0) return null;
  return entries.map((e) => e.date).reduce((a, b) => (b < a ? b : a));
}
