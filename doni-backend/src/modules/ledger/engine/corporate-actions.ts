import { Decimal, ZERO, toDecimalString } from './decimal';
import { InvalidCorporateActionError } from './errors';
import type { Holding } from './replay';
import type { CorporateAction, ValuationPrice } from './types';

/**
 * Corporate actions in effective-date order, applied to the holdings as the
 * replay reaches each one's date.
 */
export class CorporateActionTimeline {
  private readonly pending: CorporateAction[];

  constructor(private readonly actions: readonly CorporateAction[] = []) {
    actions.forEach(validate);
    this.pending = [...actions].sort(
      (a, b) =>
        a.effectiveDate.localeCompare(b.effectiveDate) ||
        a.id.localeCompare(b.id),
    );
  }

  /** An end-of-day price of the security, restated in today's shares. */
  restate(
    securityId: string,
    price: ValuationPrice | undefined,
  ): ValuationPrice | undefined {
    if (!price) return undefined;
    const actions = this.actions.filter((a) => a.securityId === securityId);
    return { ...price, close: adjustPrice(price.close, price.date, actions) };
  }

  /**
   * Applies every action effective on or before `date` that has not been
   * applied yet. Without a date, applies all that remain.
   */
  applyUpTo(holdings: Map<string, Holding>, date?: string): void {
    while (
      this.pending.length > 0 &&
      (date === undefined || this.pending[0].effectiveDate <= date)
    ) {
      const action = this.pending.shift() as CorporateAction;
      const holding = holdings.get(action.securityId);
      if (action.kind !== 'rights_issue' && holding?.quantity.gt(ZERO)) {
        holdings.set(action.securityId, apply(holding, action));
      }
    }
  }
}

/**
 * A per-share amount (an end-of-day price) of the given date, restated in
 * the shares of today: divided by the quantity factor of every split,
 * reverse split and free-share allotment effective after that date. A
 * rights issue does not restate prices. `actions` are one security's.
 */
export function adjustPrice(
  amount: string,
  date: string,
  actions: readonly CorporateAction[],
): string {
  const adjusted = actions
    .filter((a) => a.kind !== 'rights_issue' && a.effectiveDate > date)
    .reduce(
      (value, a) => value.times(a.held).div(sharesAfter(a)),
      new Decimal(amount),
    );
  return toDecimalString(adjusted);
}

const WHOLE_POSITIVE = /^[1-9]\d*$/;
const PLAIN_NON_NEGATIVE = /^\d+(\.\d+)?$/;

function validate(action: CorporateAction): void {
  const check = (field: keyof CorporateAction, pattern: RegExp) => {
    const value = action[field];
    if (typeof value !== 'string' || !pattern.test(value)) {
      throw new InvalidCorporateActionError(action.id, field, String(value));
    }
  };
  check('held', WHOLE_POSITIVE);
  check('received', WHOLE_POSITIVE);
  if (action.cashInLieuPrice != null) {
    check('cashInLieuPrice', PLAIN_NON_NEGATIVE);
  }
}

/** Shares held after the action for every `held` shares before it. */
function sharesAfter(action: CorporateAction): Decimal {
  const received = new Decimal(action.received);
  return action.kind === 'free_shares' ? received.plus(action.held) : received;
}

/**
 * The holding after the action: quantity scaled by the ratio, total cost
 * preserved. Shares are whole, so a fraction of a share is cut off and
 * settled in cash: at the cash-in-lieu price when there is one (realising a
 * gain or loss on the fraction), otherwise its cost stays in the whole
 * shares kept. With no whole share kept and no price, the cost is realised
 * as a loss, since nothing is known to have been paid.
 */
function apply(holding: Holding, action: CorporateAction): Holding {
  const entitled = holding.quantity
    .times(sharesAfter(action))
    .div(new Decimal(action.held));
  const kept = entitled.round(0, Decimal.roundDown);
  const fraction = entitled.minus(kept);
  const totalCost = holding.quantity.times(holding.pmp);

  if (action.cashInLieuPrice == null && kept.gt(ZERO)) {
    return { ...holding, quantity: kept, pmp: totalCost.div(kept) };
  }

  const pmp = totalCost.div(entitled);
  const cash = fraction.times(action.cashInLieuPrice ?? ZERO);
  return {
    quantity: kept,
    pmp: kept.gt(ZERO) ? pmp : ZERO,
    realisedGain: holding.realisedGain.plus(cash.minus(fraction.times(pmp))),
  };
}
