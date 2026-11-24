import { CorporateActionTimeline } from './corporate-actions';
import { Decimal, ZERO, toDecimalString } from './decimal';
import {
  ConflictingOpeningPositionsError,
  InsufficientQuantityError,
  InvalidLedgerEntryError,
} from './errors';
import type {
  DividendEntry,
  LedgerEntry,
  OpeningPositionEntry,
  Position,
  PositionValuation,
  ReplayInput,
  ReplayResult,
  TradeEntry,
  ValuationPrice,
} from './types';

/**
 * Running state of one security while the ledger is replayed. It keeps the
 * exact total cost of the shares held rather than the PMP: the PMP is that
 * cost divided by the quantity, and dividing only when the PMP is needed
 * keeps the result independent of the order of same-day entries.
 */
export interface Holding {
  quantity: Decimal;
  /** Total cost of the shares held, fees included (quantity × PMP). */
  cost: Decimal;
  realisedGain: Decimal;
}

const EMPTY: Holding = { quantity: ZERO, cost: ZERO, realisedGain: ZERO };

/** A holding's PMP: its cost per share, 0 when nothing is held. */
const pmpOf = (holding: Holding): Decimal =>
  holding.quantity.eq(ZERO) ? ZERO : holding.cost.div(holding.quantity);

/**
 * Within one day, an opening position comes first (it states the holding at
 * the start of the day, so that day's trades apply on top of it), then
 * entries that add shares, then entries that remove them. A day's result
 * does not depend on the order its entries were recorded in.
 */
const SAME_DAY_ORDER: Record<LedgerEntry['kind'], number> = {
  opening_position: 0,
  buy: 1,
  sell: 2,
  // A user dividend changes no quantity; it is placed last for a fixed order.
  dividend: 3,
};

const byReplayOrder = (a: LedgerEntry, b: LedgerEntry): number =>
  a.date.localeCompare(b.date) ||
  SAME_DAY_ORDER[a.kind] - SAME_DAY_ORDER[b.kind] ||
  a.id.localeCompare(b.id);

/**
 * Derives a portfolio's positions from its ledger (ADR 0004) and values them
 * at end-of-day prices. Pure: same input, same result, no I/O.
 *
 * A user dividend changes neither quantity nor PMP: its net amount adds to
 * the position's dividends and to the portfolio's total gain.
 *
 * Cost basis is the PMP, fees included (ADR 0006): a buy recomputes the PMP,
 * a sale realises its net proceeds minus PMP × quantity sold and leaves the
 * PMP unchanged. All arithmetic is decimal (ADR 0005); the only rounding is
 * the PMP division (cost / quantity), to 30 decimal places, done only when a
 * sale or the result needs the PMP.
 *
 * @throws InsufficientQuantityError if, at any date, a sale exceeds the
 * shares then held.
 * @throws ConflictingOpeningPositionsError if two opening positions state
 * the same security's holding on the same day.
 */
export function replay(input: ReplayInput): ReplayResult {
  const holdings = new Map<string, Holding>();
  const dividends = new Map<string, Decimal>();
  const corporateActions = new CorporateActionTimeline(input.corporateActions);
  const openings = new Set<string>();
  for (const entry of [...input.entries].sort(byReplayOrder)) {
    if (entry.kind === 'opening_position') {
      const key = `${entry.securityId}@${entry.date}`;
      if (openings.has(key)) {
        throw new ConflictingOpeningPositionsError(
          entry.id,
          entry.securityId,
          entry.date,
        );
      }
      openings.add(key);
    }
    corporateActions.applyUpTo(holdings, entry.date);
    const holding = holdings.get(entry.securityId) ?? EMPTY;
    if (entry.kind === 'dividend') {
      holdings.set(entry.securityId, holding);
      dividends.set(
        entry.securityId,
        (dividends.get(entry.securityId) ?? ZERO).plus(dividendAmount(entry)),
      );
      continue;
    }
    holdings.set(
      entry.securityId,
      entry.kind === 'opening_position'
        ? applyOpening(holding, entry)
        : applyTrade(holding, entry),
    );
  }
  corporateActions.applyUpTo(holdings);

  const positions = [...holdings]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([securityId, holding]) =>
      toPosition(
        securityId,
        holding,
        dividends.get(securityId) ?? ZERO,
        corporateActions.restate(securityId, input.prices.get(securityId)),
      ),
    );
  return { positions, totals: totalsOf(positions) };
}

/** A plain decimal string: digits, an optional point, an optional sign. */
const PLAIN_DECIMAL = /^-?\d+(\.\d+)?$/;

function parse<Field extends string>(
  entry: { id: string } & Record<Field, string>,
  field: Field,
  accept: (value: Decimal) => boolean,
): Decimal {
  const raw = entry[field];
  const value = PLAIN_DECIMAL.test(raw) ? new Decimal(raw) : null;
  if (!value || !accept(value)) {
    throw new InvalidLedgerEntryError(entry.id, field, raw);
  }
  return value;
}

const positive = (value: Decimal) => value.gt(ZERO);
const nonNegative = (value: Decimal) => value.gte(ZERO);

/**
 * Sets the holding to the stated quantity and PMP: its cost basis is
 * quantity × PMP. Gains already realised on the security are kept.
 */
function applyOpening(holding: Holding, entry: OpeningPositionEntry): Holding {
  const quantity = parse(entry, 'quantity', positive);
  const pmp = parse(entry, 'pmp', nonNegative);
  return { ...holding, quantity, cost: quantity.times(pmp) };
}

function applyTrade(holding: Holding, entry: TradeEntry): Holding {
  const quantity = parse(entry, 'quantity', positive);
  const price = parse(entry, 'price', nonNegative);
  const fees = parse(entry, 'fees', nonNegative);
  const gross = quantity.times(price);

  if (entry.kind === 'buy') {
    return {
      ...holding,
      quantity: holding.quantity.plus(quantity),
      cost: holding.cost.plus(gross).plus(fees),
    };
  }

  if (quantity.gt(holding.quantity)) {
    throw new InsufficientQuantityError(
      entry.id,
      entry.securityId,
      entry.date,
      toDecimalString(holding.quantity),
      toDecimalString(quantity),
    );
  }
  // The shares kept cost held × PMP, so their PMP stays exactly the same.
  const pmp = pmpOf(holding);
  const held = holding.quantity.minus(quantity);
  const proceeds = gross.minus(fees);
  return {
    quantity: held,
    cost: held.times(pmp),
    realisedGain: holding.realisedGain.plus(
      proceeds.minus(quantity.times(pmp)),
    ),
  };
}

/** A user dividend's net amount: it changes nothing else. */
const dividendAmount = (entry: DividendEntry): Decimal =>
  parse(entry, 'amount', positive);

function toPosition(
  securityId: string,
  holding: Holding,
  dividends: Decimal,
  price: ValuationPrice | undefined,
): Position {
  const costBasis = holding.cost;
  let valuation: PositionValuation | null = null;
  if (price && holding.quantity.gt(ZERO)) {
    const marketValue = holding.quantity.times(price.close);
    valuation = {
      price: toDecimalString(new Decimal(price.close)),
      priceDate: price.date,
      marketValue: toDecimalString(marketValue),
      unrealisedGain: toDecimalString(marketValue.minus(costBasis)),
    };
  }
  return {
    securityId,
    quantity: toDecimalString(holding.quantity),
    pmp: toDecimalString(pmpOf(holding)),
    costBasis: toDecimalString(costBasis),
    realisedGain: toDecimalString(holding.realisedGain),
    dividends: toDecimalString(dividends),
    valuation,
  };
}

function totalsOf(positions: Position[]): ReplayResult['totals'] {
  const sum = (values: string[]) =>
    values.reduce((total, value) => total.plus(value), ZERO);
  const open = positions.filter((p) => p.quantity !== '0');
  const valued = open.every((p) => p.valuation !== null);
  const realisedGain = sum(positions.map((p) => p.realisedGain));
  const dividends = sum(positions.map((p) => p.dividends));
  const unrealisedGain = valued
    ? sum(open.map((p) => p.valuation!.unrealisedGain))
    : null;

  return {
    costBasis: toDecimalString(sum(positions.map((p) => p.costBasis))),
    realisedGain: toDecimalString(realisedGain),
    marketValue: valued
      ? toDecimalString(sum(open.map((p) => p.valuation!.marketValue)))
      : null,
    unrealisedGain: unrealisedGain ? toDecimalString(unrealisedGain) : null,
    dividends: toDecimalString(dividends),
    totalGain: unrealisedGain
      ? toDecimalString(realisedGain.plus(unrealisedGain).plus(dividends))
      : null,
  };
}
