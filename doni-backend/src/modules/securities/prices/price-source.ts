/**
 * The single entry point through which end-of-day prices are obtained
 * (ADR 0003). Consumers inject `PRICE_SOURCE` and depend on this interface
 * only, so where prices come from (hand-seeded BOC data, parsed BOC PDFs, a
 * licensed feed) can change without touching them.
 *
 * A PriceSource only ever returns published prices: a `pending_review` day is
 * never returned, so users keep seeing the last validated date.
 */
export interface PriceSource {
  /** The most recent published price, or null if there is none. */
  getLatest(subject: PriceSubject): Promise<EndOfDayPrice | null>;

  /** The most recent published price of each security that has one, by id. */
  getLatestForSecurities(
    securityIds: string[],
  ): Promise<Map<string, EndOfDayPrice>>;

  /** Published prices, oldest first, optionally within a date range. */
  getHistory(
    subject: PriceSubject,
    range?: DateRange,
  ): Promise<EndOfDayPrice[]>;
}

export const PRICE_SOURCE = Symbol('PriceSource');

/** What a price is for: a security or an index. */
export type PriceSubject = { securityId: string } | { indexId: string };

/** Inclusive bounds, as YYYY-MM-DD. */
export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * One trading day's end-of-day price with its provenance. Decimal values are
 * strings (ADR 0005); dates are YYYY-MM-DD.
 */
export interface EndOfDayPrice {
  /** The trading day the price applies to. */
  date: string;
  close: string;
  open: string | null;
  high: string | null;
  low: string | null;
  volume: string | null;
  /** The BOC the price was read from. */
  sourceDocument: string;
  /** The date that BOC was published. */
  publishedOn: string;
}
