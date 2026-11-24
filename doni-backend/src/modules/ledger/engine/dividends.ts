import { Decimal, ZERO, toDecimalString } from './decimal';
import { replay } from './replay';
import type { DividendEntitlement, EntitlementInput } from './types';

/**
 * What the ledger is entitled to from each reference dividend: for each one
 * whose security was held going into its ex-date, the shares then held and
 * the gross amount they earn. Pure, like `replay`.
 *
 * The shares are those held at the close of the day before the ex-date (a
 * share bought on the ex-date trades without the dividend, one sold on it
 * still earns it), after every corporate action effective on or before the
 * ex-date, so they are in the shares the gross amount is stated in.
 *
 * An entitlement is a suggestion, not a ledger entry: nothing counts it
 * until the user confirms the net amount actually received, which is then
 * recorded as a dividend entry.
 *
 * Returned in the order of `input.dividends`; a dividend with no shares
 * held at its ex-date gets none.
 */
export function dividendEntitlements(
  input: EntitlementInput,
): DividendEntitlement[] {
  const entitlements: DividendEntitlement[] = [];
  for (const dividend of input.dividends) {
    const { securityId, exDate } = dividend;
    const { positions } = replay({
      entries: input.entries.filter(
        (e) => e.securityId === securityId && e.date < exDate,
      ),
      corporateActions: (input.corporateActions ?? []).filter(
        (a) => a.securityId === securityId && a.effectiveDate <= exDate,
      ),
      prices: new Map(),
    });
    const shares = new Decimal(positions[0]?.quantity ?? '0');
    if (shares.lte(ZERO)) continue;
    entitlements.push({
      referenceDividendId: dividend.id,
      securityId,
      shares: toDecimalString(shares),
      grossAmount: toDecimalString(shares.times(dividend.grossPerShare)),
    });
  }
  return entitlements;
}
