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

// ─── Ingestion side ──────────────────────────────────────────

/**
 * The ingestion side of the PriceSource: reads one source document (today a
 * BOC PDF) into a trading day's prices, before they are checked and stored.
 * Replacing BOC parsing with a licensed feed means another implementation of
 * this interface; the read side above does not change.
 */
export interface PriceDocumentParser {
  parse(document: Uint8Array): Promise<ParsedTradingDay>;
}

export const PRICE_DOCUMENT_PARSER = Symbol('PriceDocumentParser');

/**
 * One trading day as read from a source document, before any check. Decimal
 * values are strings (ADR 0005); percentages are in percent ("4.75" = 4.75%).
 */
export interface ParsedTradingDay {
  /** The trading day the document says it covers (YYYY-MM-DD). */
  tradingDate: string;
  /** The bulletin's number, e.g. "215", when printed. */
  reference: string | null;
  /**
   * Which layout of the source document was read (e.g. "2026",
   * "sector-2018"), when the source has several. Absent on days stored before
   * layouts were told apart.
   */
  layout?: string;
  securities: ParsedSecurityPrice[];
  indices: ParsedIndexValue[];
  /** Figures printed twice or as totals, which checks compare with the rows. */
  controls: ParsedControls;
  /** Lines that looked like price rows but could not be read, verbatim. */
  unreadableRows: string[];
}

export interface ParsedSecurityPrice {
  ticker: string;
  name: string;
  /** The previous session's close, as printed. */
  previousClose: string | null;
  open: string | null;
  /** The close, or the reference price when the security did not trade. */
  close: string;
  /** Shares traded; null when the security did not trade. */
  volume: string | null;
  /** Value traded, XOF; null when the security did not trade. */
  value: string | null;
  /** The day's variation as printed, in percent. */
  variation: string | null;
  /** False when the BOC marks the security suspended or not quoted. */
  traded: boolean;
}

export interface ParsedIndexValue {
  /** Doni's code for the index, e.g. BRVM-C. */
  code: string;
  /** The index's name as printed. */
  name: string;
  value: string;
  /** The day's variation as printed, in percent. */
  variation: string | null;
}

export interface ParsedControls {
  /** Total shares volume printed for the equity market. */
  totalVolume: string | null;
  /** An index value printed a second time elsewhere in the document. */
  repeatedIndexValues: { code: string; value: string; where: string }[];
}
