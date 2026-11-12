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

/** One dated, immutable record of a portfolio's ledger. */
export type LedgerEntry = TradeEntry | OpeningPositionEntry;

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
}

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
}

export interface ReplayResult {
  /** Every security the ledger touches, ordered by security id. */
  positions: Position[];
  totals: PortfolioTotals;
}
