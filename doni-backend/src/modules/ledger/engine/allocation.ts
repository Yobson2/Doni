import { Decimal, ZERO, toDecimalString } from './decimal';
import type { Allocation, AllocationShare } from './types';

/** Percentages are shown to one decimal place: the unit is 0.1%. */
const UNITS_IN_WHOLE = new Decimal('1000');
const UNITS_IN_PERCENT = new Decimal('10');
const ONE_UNIT = new Decimal('1');

/**
 * How a market value is spread across keys (securities, sectors...).
 * Shares with the same key are added together. Each key's percentage is
 * rounded to one decimal place by the largest-remainder method, so the
 * displayed percentages always add up to exactly 100.0: every key first gets
 * its share rounded down, then the tenths left over go, one each, to the keys
 * with the largest remainders (ties to the larger market value, then the
 * key). Lines are ordered by market value, largest first, then by key.
 *
 * Returns the whole market value with the lines. There are no lines when
 * there is nothing to spread (no shares, or a zero total).
 * Market values are XOF amounts, zero or more (ADR 0005, 0008).
 */
export function allocate(shares: readonly AllocationShare[]): Allocation {
  const byKey = new Map<string, Decimal>();
  for (const { key, marketValue } of shares) {
    byKey.set(key, (byKey.get(key) ?? ZERO).plus(new Decimal(marketValue)));
  }
  const total = [...byKey.values()].reduce((a, b) => a.plus(b), ZERO);
  const marketValue = toDecimalString(total);
  if (total.lte(ZERO)) return { marketValue, lines: [] };

  const lines = [...byKey]
    .map(([key, value]) => {
      const scaled = value.times(UNITS_IN_WHOLE);
      const units = scaled.div(total).round(0, Decimal.roundDown);
      // Exact: the remainder of value × 1000 / total, over the same total.
      const remainder = scaled.minus(units.times(total));
      return { key, value, units, remainder };
    })
    .sort((a, b) => b.value.cmp(a.value) || compareKeys(a.key, b.key));

  let leftover = UNITS_IN_WHOLE.minus(
    lines.reduce((sum, line) => sum.plus(line.units), ZERO),
  ).toNumber();
  const byRemainder = [...lines].sort(
    (a, b) =>
      b.remainder.cmp(a.remainder) ||
      b.value.cmp(a.value) ||
      compareKeys(a.key, b.key),
  );
  for (const line of byRemainder) {
    if (leftover <= 0) break;
    line.units = line.units.plus(ONE_UNIT);
    leftover -= 1;
  }

  return {
    marketValue,
    lines: lines.map(({ key, value, units }) => ({
      key,
      marketValue: toDecimalString(value),
      percent: units.div(UNITS_IN_PERCENT).toFixed(1),
    })),
  };
}

const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
