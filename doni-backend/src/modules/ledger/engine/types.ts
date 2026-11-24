/**
 * The ledger engine's interface (ADR 0004): plain data in, plain data out.
 * Every decimal is a string (ADR 0005), every amount is in XOF (ADR 0008),
 * every date is a calendar day as YYYY-MM-DD.
 *
 * The input is one object so that later inputs (corporate actions, voided or
 * superseding entries) are new optional fields, and later ledger entry kinds
 * (opening position, user dividend) are new members of `LedgerEntry`, without
 * changing what existing callers pass.
 */

/** A buy or a sell of a security, as recorded in the ledger. */
export interface TradeEntry {
  /** Stable identity of the ledger entry; echoed in errors. */
  id: string;
  kind: 'buy' | 'sell';
  securityId: string;
  /** The trade date. */
  date: string;
  /** Number of shares, greater than zero. */
  quantity: string;
  /** Price per share, excluding fees. */
  price: string;
  /** Total fees charged by the SGI for this trade, zero or more. */
  fees: string;
}

/**
 * An opening position: the user held `quantity` shares at this `pmp` on
 * `date`, entered instead of the trades that led there (ADR 0001). It is a
 * snapshot of the holding at the start of that day: it sets the quantity and
 * PMP, superseding the security's earlier entries, and realises nothing.
 * A ledger holds at most one per security and day.
 */
export interface OpeningPositionEntry {
  id: string;
  kind: 'opening_position';
  securityId: string;
  /** The day the holding is stated for. */
  date: string;
  /** Number of shares held, greater than zero. */
  quantity: string;
  /** PMP of the shares held, fees included (ADR 0006). */
  pmp: string;
}

/**
 * A user dividend: the net amount the user confirms they actually received
 * for a holding (after withholding tax and charges). It changes neither the
 * quantity nor the PMP; it adds to the position's dividends and so to the
 * portfolio's total gain. A suggestion derived from a reference dividend is
 * not a ledger entry and never reaches the engine until it is confirmed.
 */
export interface DividendEntry {
  id: string;
  kind: 'dividend';
  securityId: string;
  /** The payment date. */
  date: string;
  /** Net amount received, XOF, greater than zero. */
  amount: string;
}

/** One dated, immutable record of a portfolio's ledger. */
export type LedgerEntry = TradeEntry | OpeningPositionEntry | DividendEntry;

/** The end-of-day price a position is valued at, with the day it applies to. */
export interface ValuationPrice {
  close: string;
  date: string;
}

export interface ReplayInput {
  /** The ledger entries, in any order: the engine replays them by date. */
  entries: readonly LedgerEntry[];
  /** End-of-day price to value each security at, by security id. */
  prices: ReadonlyMap<string, ValuationPrice>;
  /**
   * Corporate actions on the securities the ledger touches, in any order.
   * Omitted means none.
   */
  corporateActions?: readonly CorporateAction[];
}

/**
 * An issuer decision that changes the quantity of a security held, as the
 * engine sees it. The ratio reads "`received` shares for every `held`":
 *
 * - `split`, `reverse_split`: the `held` shares are replaced by `received`
 *   new ones (a 1:5 split is held 1, received 5; a 10:1 reverse split is
 *   held 10, received 1).
 * - `free_shares`: `received` free shares are added for every `held`
 *   (one free share for ten held is held 10, received 1).
 * - `rights_issue`: shares held do not change. Subscribed shares are a buy
 *   at the subscription price that the holder records in the ledger.
 *
 * Shares are whole on the BRVM: when the ratio leaves a fraction of a share,
 * the holder keeps the whole shares and the fraction is settled in cash.
 */
export interface CorporateAction {
  /** Stable identity of the corporate action; echoed in errors. */
  id: string;
  kind: CorporateActionKind;
  securityId: string;
  /**
   * The first trading day on which the security trades on the new basis.
   * The action applies before that day's ledger entries, so trades dated
   * that day or later are already in new shares.
   */
  effectiveDate: string;
  /** A whole number greater than zero. */
  held: string;
  /** A whole number greater than zero. */
  received: string;
  /**
   * Cash paid per new share for a fraction of a share (the issuer's
   * "indemnisation des rompus"), when the source notice states it. With it,
   * the fraction is treated as sold at that price and realises a gain or
   * loss. Without it, the fraction's cost stays in the whole shares kept.
   */
  cashInLieuPrice?: string | null;
}

export type CorporateActionKind =
  | 'split'
  | 'reverse_split'
  | 'free_shares'
  | 'rights_issue';

/** A position's value at its end-of-day price. */
export interface PositionValuation {
  /** The end-of-day price used. */
  price: string;
  /** The trading day that price applies to ("as of"). */
  priceDate: string;
  /** quantity × price. */
  marketValue: string;
  /** marketValue − costBasis. */
  unrealisedGain: string;
}

/**
 * The position in one security after replaying the ledger. A security that
 * was held and fully sold stays listed with quantity 0, so its realised gain
 * is not lost.
 */
export interface Position {
  securityId: string;
  quantity: string;
  /** PMP: cost basis per share, fees included. "0" when quantity is 0. */
  pmp: string;
  /** Total cost of the shares still held (quantity × PMP). */
  costBasis: string;
  /** Sum of (net sale proceeds − PMP × quantity sold) over every sale. */
  realisedGain: string;
  /** Sum of the user dividends received on the security (net amounts). */
  dividends: string;
  /** Null when the position is closed or has no end-of-day price. */
  valuation: PositionValuation | null;
}

export interface PortfolioTotals {
  costBasis: string;
  realisedGain: string;
  /** Null when some open position has no end-of-day price. */
  marketValue: string | null;
  /** Null when some open position has no end-of-day price. */
  unrealisedGain: string | null;
  /** Sum of the user dividends received (net amounts). */
  dividends: string;
  /**
   * realisedGain + unrealisedGain + dividends: what the portfolio has gained
   * overall. Null when some open position has no end-of-day price.
   */
  totalGain: string | null;
}

export interface ReplayResult {
  /** Every security the ledger touches, ordered by security id. */
  positions: Position[];
  totals: PortfolioTotals;
}

/**
 * The terms of a reference dividend the engine needs to work out who is
 * entitled to it: the security, its ex-date and its gross amount per share.
 */
export interface ReferenceDividendTerms {
  /** Stable identity of the reference dividend. */
  id: string;
  securityId: string;
  /**
   * The first trading day on which the security trades without the
   * dividend: shares bought that day or later do not receive it, shares
   * sold that day or later still do.
   */
  exDate: string;
  /** Gross amount per share, XOF, in the shares of the ex-date. */
  grossPerShare: string;
}

export interface EntitlementInput {
  /** The ledger entries, in any order. */
  entries: readonly LedgerEntry[];
  /** Corporate actions on the securities, in any order; omitted means none. */
  corporateActions?: readonly CorporateAction[];
  dividends: readonly ReferenceDividendTerms[];
}

/**
 * What a ledger is entitled to from one reference dividend: the shares held
 * going into its ex-date and the gross amount they earn. A suggestion, not a
 * ledger entry: it counts nowhere until the user confirms the net amount.
 */
export interface DividendEntitlement {
  referenceDividendId: string;
  securityId: string;
  /** Shares held at the close of the day before the ex-date. */
  shares: string;
  /** shares × grossPerShare, XOF. */
  grossAmount: string;
}

/** A market value to allocate, under the key it is grouped by. */
export interface AllocationShare {
  /** What the share is grouped by, e.g. a security or a sector. */
  key: string;
  /** XOF, zero or more. */
  marketValue: string;
}

/** One key's part of an allocation. */
export interface AllocationLine {
  key: string;
  /** The key's total market value, XOF. */
  marketValue: string;
  /**
   * Its share of the whole as a percentage with one decimal place, e.g.
   * "33.4". The lines' percentages add up to exactly "100.0".
   */
  percent: string;
}

/** How a market value is spread across keys. */
export interface Allocation {
  /** The whole market value, XOF: the sum of the shares. */
  marketValue: string;
  /** Largest market value first, then by key. */
  lines: AllocationLine[];
}

/**
 * A dated amount of money between the investor and the portfolio, XOF, from
 * the investor's side: negative when paid in (a buy, the starting value),
 * positive when received (a sale, a user dividend, the final valuation).
 */
export interface CashFlow {
  date: string;
  amount: string;
}

/**
 * An XIRR: the annual rate as a decimal fraction ("0.1" is 10 %), rounded to
 * 10 decimal places, or "no solution" when the flows have none.
 */
export type XirrResult =
  | { status: 'solved'; rate: string }
  | { status: 'no_solution' };

/** One trading day of a portfolio, as the TWR links it. */
export interface TwrDay {
  date: string;
  /**
   * Market value of the holdings at the day's close, XOF; null when it
   * cannot be known (a held security has no end-of-day price that day).
   */
  value: string | null;
  /**
   * Money put in since the previous day: buys, cost and fees, and on the
   * first day the value of the holdings the period starts with.
   */
  inflow: string;
  /**
   * Money taken out since the previous day: sale proceeds net of fees, user
   * dividends, cash paid for fractions of shares.
   */
  outflow: string;
}

/** The cumulative TWR at a day's close, as a fraction; null on a data gap. */
export interface TwrPoint {
  date: string;
  twr: string | null;
}

/** A value on a date: an end-of-day close, an index value. */
export interface DatedValue {
  date: string;
  value: string;
}

export interface ReturnsInput {
  /** The ledger entries, in any order. */
  entries: readonly LedgerEntry[];
  /** Corporate actions on the securities, in any order; omitted means none. */
  corporateActions?: readonly CorporateAction[];
  /**
   * Each security's published end-of-day closes, oldest first, in the
   * shares of their own date (not restated for later corporate actions).
   * They may begin before the period.
   */
  prices: ReadonlyMap<string, readonly DatedValue[]>;
  /** The benchmark's (BRVM Composite) values, oldest first. */
  benchmark: readonly DatedValue[];
  /** First day asked for; moved to the performance start if earlier. */
  from: string;
  /** Last day asked for, usually today. */
  to: string;
}

/**
 * A trading day of the period on which something needed is missing: the
 * benchmark's value, or the end-of-day price of a security held that day.
 * Nothing is interpolated: the day has no point on the affected series.
 */
export interface DataGap {
  date: string;
  benchmark: boolean;
  /** Securities held that day with no end-of-day price, ordered by id. */
  securityIds: string[];
}

/** One trading day of the comparison: both cumulative returns, fractions. */
export interface ReturnsPoint {
  date: string;
  /** The portfolio's TWR since the start of the period; null on a gap. */
  portfolio: string | null;
  /** The benchmark's change since the start of the period; null on a gap. */
  benchmark: string | null;
}

export interface ReturnsResult {
  /**
   * The period measured: from the later of the day asked for and the
   * performance start, to the last trading day on or before the day asked
   * for. Null when the ledger has nothing to measure in it.
   */
  period: { from: string; to: string } | null;
  /**
   * "Mon rendement" over the period; `unpriced` when a security held at
   * its start or end has no end-of-day price on or before that day.
   */
  xirr: XirrResult | { status: 'unpriced' };
  /** Every trading day of the period, oldest first. */
  series: ReturnsPoint[];
  /** The period's data gaps, oldest first. */
  gaps: DataGap[];
}
