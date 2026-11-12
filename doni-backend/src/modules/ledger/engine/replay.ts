import { CorporateActionTimeline } from './corporate-actions';
import { Decimal, ZERO, toDecimalString } from './decimal';
import { InsufficientQuantityError, InvalidLedgerEntryError } from './errors';
import type {
  LedgerEntry,
  OpeningPositionEntry,
  Position,
  PositionValuation,
  ReplayInput,
  ReplayResult,
  TradeEntry,
  ValuationPrice,
} from './types';

/** Running state of one security while the ledger is replayed. */
export interface Holding {
  quantity: Decimal;
  pmp: Decimal;
  realisedGain: Decimal;
}

const EMPTY: Holding = { quantity: ZERO, pmp: ZERO, realisedGain: ZERO };

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
};

const byReplayOrder = (a: LedgerEntry, b: LedgerEntry): number =>
  a.date.localeCompare(b.date) ||
  SAME_DAY_ORDER[a.kind] - SAME_DAY_ORDER[b.kind] ||
  a.id.localeCompare(b.id);

/**
 * Derives a portfolio's positions from its ledger (ADR 0004) and values them
 * at end-of-day prices. Pure: same input, same result, no I/O.
 *
 * Cost basis is the PMP, fees included (ADR 0006): a buy recomputes the PMP,
 * a sale realises its net proceeds minus PMP × quantity sold and leaves the
 * PMP unchanged. All arithmetic is decimal (ADR 0005); the only rounding is
 * the PMP division, to 30 decimal places.
 *
 * @throws InsufficientQuantityError if, at any date, a sale exceeds the
 * shares then held.
 */
export function replay(input: ReplayInput): ReplayResult {
  const holdings = new Map<string, Holding>();
  const corporateActions = new CorporateActionTimeline(input.corporateActions);
  for (const entry of [...input.entries].sort(byReplayOrder)) {
    corporateActions.applyUpTo(holdings, entry.date);
    const holding = holdings.get(entry.securityId) ?? EMPTY;
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
  return {
    ...holding,
    quantity: parse(entry, 'quantity', positive),
    pmp: parse(entry, 'pmp', nonNegative),
  };
}

function applyTrade(holding: Holding, entry: TradeEntry): Holding {
  const quantity = parse(entry, 'quantity', positive);
  const price = parse(entry, 'price', nonNegative);
  const fees = parse(entry, 'fees', nonNegative);
  const gross = quantity.times(price);

  if (entry.kind === 'buy') {
    const held = holding.quantity.plus(quantity);
    const totalCost = holding.quantity
      .times(holding.pmp)
      .plus(gross)
      .plus(fees);
    return { ...holding, quantity: held, pmp: totalCost.div(held) };
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
  const held = holding.quantity.minus(quantity);
  const proceeds = gross.minus(fees);
  return {
    quantity: held,
    pmp: held.eq(ZERO) ? ZERO : holding.pmp,
    realisedGain: holding.realisedGain.plus(
      proceeds.minus(quantity.times(holding.pmp)),
    ),
  };
}

function toPosition(
  securityId: string,
  holding: Holding,
  price: ValuationPrice | undefined,
): Position {
  const costBasis = holding.quantity.times(holding.pmp);
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
    pmp: toDecimalString(holding.pmp),
    costBasis: toDecimalString(costBasis),
    realisedGain: toDecimalString(holding.realisedGain),
    valuation,
  };
}

function totalsOf(positions: Position[]): ReplayResult['totals'] {
  const sum = (values: string[]) =>
    values.reduce((total, value) => total.plus(value), ZERO);
  const open = positions.filter((p) => p.quantity !== '0');
  const valued = open.every((p) => p.valuation !== null);

  return {
    costBasis: toDecimalString(sum(positions.map((p) => p.costBasis))),
    realisedGain: toDecimalString(sum(positions.map((p) => p.realisedGain))),
    marketValue: valued
      ? toDecimalString(sum(open.map((p) => p.valuation!.marketValue)))
      : null,
    unrealisedGain: valued
      ? toDecimalString(sum(open.map((p) => p.valuation!.unrealisedGain)))
      : null,
  };
}
