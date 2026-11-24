import { Decimal } from '@modules/ledger/engine/decimal';
import { PriceStatus } from '../entities/price-status';
import type { ParsedTradingDay } from '../prices/price-source';

/**
 * The automatic checks a parsed BOC passes before its prices are published
 * (ADR 0003). Each check is a pure function that returns one readable
 * failure per problem; any failure holds the day as pending_review.
 */

export enum BocCheck {
  /** The bulletin covers the trading day it was fetched for. */
  TRADING_DATE = 'trading_date',
  /** Every line that looks like a price row could be read. */
  READABLE = 'readable',
  /** Every security in the catalogue is listed. */
  SECURITIES_PRESENT = 'securities_present',
  /** No daily move exceeds the BRVM variation limit. */
  VARIATION_LIMITS = 'variation_limits',
  /** Index values agree with each other and with the previous session. */
  INDEX_CONSISTENCY = 'index_consistency',
  /** Volumes are non-negative and add up to the printed total. */
  VOLUMES = 'volumes',
  /** Prices already published for that day (hand-entered) are confirmed. */
  AGREES_WITH_PUBLISHED = 'agrees_with_published',
}

export interface CheckFailure {
  check: BocCheck;
  /** The security ticker or index code concerned, when there is one. */
  subject: string | null;
  /** What is wrong, in a sentence an admin can act on. */
  reason: string;
}

/** What the checks compare a parsed day with. */
export interface CheckContext {
  /** The trading day the bulletin was fetched for (YYYY-MM-DD). */
  expectedTradingDate: string;
  /** Tickers of every security in the catalogue. */
  catalogueTickers: string[];
  /** Codes of every index in the catalogue. */
  catalogueIndexCodes: string[];
  /**
   * Each index's published value on the previous trading day, by code. Only
   * the session just before this one: after a gap there is nothing to
   * compare the printed daily variation with.
   */
  previousIndexValues: Map<string, string>;
  /**
   * Closes already published for this same day without a bulletin (entered
   * by hand), by ticker or index code.
   */
  publishedCloses: Map<string, string>;
}

/**
 * The BRVM's daily price variation limit for shares: a share's price may not
 * move more than 7.5% up or down from its reference price in one session
 * (BRVM trading rules, "seuil de variation journalier" of ±7.5% for
 * equities). A larger move in a parsed BOC is either a misread figure or a
 * day an admin should look at (e.g. an ex-dividend reference price).
 */
export const BRVM_DAILY_VARIATION_LIMIT = new Decimal('0.075');

/**
 * Index variations are printed to two decimals, from values printed to two
 * decimals: the recomputed variation may differ from the printed one by
 * rounding only, in percentage points.
 */
export const INDEX_VARIATION_TOLERANCE = new Decimal('0.01');

export function checkTradingDate(
  day: ParsedTradingDay,
  ctx: CheckContext,
): CheckFailure[] {
  if (day.tradingDate === ctx.expectedTradingDate) return [];
  return [
    {
      check: BocCheck.TRADING_DATE,
      subject: null,
      reason: `The bulletin is dated ${day.tradingDate}, not ${ctx.expectedTradingDate}.`,
    },
  ];
}

export function checkReadable(day: ParsedTradingDay): CheckFailure[] {
  return day.unreadableRows.map((row) => ({
    check: BocCheck.READABLE,
    subject: row.split(' ')[0] ?? null,
    reason: `This line of the share listing could not be read: "${row}".`,
  }));
}

export function checkSecuritiesPresent(
  day: ParsedTradingDay,
  ctx: CheckContext,
): CheckFailure[] {
  const listed = new Set(day.securities.map((s) => s.ticker));
  return ctx.catalogueTickers
    .filter((ticker) => !listed.has(ticker))
    .sort()
    .map((ticker) => ({
      check: BocCheck.SECURITIES_PRESENT,
      subject: ticker,
      reason: `${ticker} is in the catalogue but not listed in the bulletin.`,
    }));
}

export function checkVariationLimits(
  day: ParsedTradingDay,
  ctx: CheckContext,
): CheckFailure[] {
  const catalogued = new Set(ctx.catalogueTickers);
  const failures: CheckFailure[] = [];
  for (const row of day.securities) {
    if (!catalogued.has(row.ticker) || !row.previousClose) continue;
    const previous = new Decimal(row.previousClose);
    if (previous.lte('0')) {
      failures.push({
        check: BocCheck.VARIATION_LIMITS,
        subject: row.ticker,
        reason: `${row.ticker}: the previous close (${row.previousClose}) is not a price.`,
      });
      continue;
    }
    const move = new Decimal(row.close).minus(previous).div(previous);
    if (move.abs().gt(BRVM_DAILY_VARIATION_LIMIT)) {
      failures.push({
        check: BocCheck.VARIATION_LIMITS,
        subject: row.ticker,
        reason: `${row.ticker} moved ${percent(move)} (${row.previousClose} to ${row.close}), beyond the BRVM daily limit of ±${percent(BRVM_DAILY_VARIATION_LIMIT)}.`,
      });
    }
  }
  return failures;
}

export function checkIndexConsistency(
  day: ParsedTradingDay,
  ctx: CheckContext,
): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const fail = (subject: string, reason: string) =>
    failures.push({ check: BocCheck.INDEX_CONSISTENCY, subject, reason });
  const byCode = new Map(day.indices.map((i) => [i.code, i]));

  for (const code of [...ctx.catalogueIndexCodes].sort()) {
    if (!byCode.has(code)) {
      fail(code, `${code} is in the catalogue but not in the bulletin.`);
    }
  }
  for (const index of day.indices) {
    if (new Decimal(index.value).lte('0')) {
      fail(index.code, `${index.code} has a value of ${index.value}.`);
    }
  }
  for (const repeat of day.controls.repeatedIndexValues) {
    const index = byCode.get(repeat.code);
    if (index && !new Decimal(index.value).eq(repeat.value)) {
      fail(
        repeat.code,
        `${repeat.code} is ${index.value} on the front page but ${repeat.value} in the ${repeat.where}.`,
      );
    }
  }
  for (const index of day.indices) {
    const previous = ctx.previousIndexValues.get(index.code);
    if (!previous || index.variation === null) continue;
    const prev = new Decimal(previous);
    if (prev.lte('0')) continue;
    const computed = new Decimal(index.value).div(prev).minus('1').times('100');
    if (computed.minus(index.variation).abs().gt(INDEX_VARIATION_TOLERANCE)) {
      fail(
        index.code,
        `${index.code} went from ${previous} to ${index.value} (${computed.toFixed(2)}%), but the bulletin prints a daily variation of ${index.variation}%.`,
      );
    }
  }
  return failures;
}

export function checkVolumes(day: ParsedTradingDay): CheckFailure[] {
  const failures: CheckFailure[] = [];
  let total = new Decimal('0');
  for (const row of day.securities) {
    for (const [field, value] of [
      ['volume', row.volume],
      ['value traded', row.value],
    ] as const) {
      if (value !== null && new Decimal(value).lt('0')) {
        failures.push({
          check: BocCheck.VOLUMES,
          subject: row.ticker,
          reason: `${row.ticker} has a negative ${field} (${value}).`,
        });
      }
    }
    if (row.volume !== null) total = total.plus(row.volume);
  }
  const printed = day.controls.totalVolume;
  if (printed !== null && !total.eq(printed)) {
    failures.push({
      check: BocCheck.VOLUMES,
      subject: null,
      reason: `Share volumes add up to ${total.toFixed()}, but the bulletin prints a total of ${printed}.`,
    });
  }
  return failures;
}

export function checkAgreesWithPublished(
  day: ParsedTradingDay,
  ctx: CheckContext,
): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const parsed = [
    ...day.securities.map((s) => [s.ticker, s.close] as const),
    ...day.indices.map((i) => [i.code, i.value] as const),
  ];
  for (const [subject, close] of parsed) {
    const published = ctx.publishedCloses.get(subject);
    if (published !== undefined && !new Decimal(published).eq(close)) {
      failures.push({
        check: BocCheck.AGREES_WITH_PUBLISHED,
        subject,
        reason: `${subject}: the bulletin gives ${close}, but ${published} is already published for that day.`,
      });
    }
  }
  return failures;
}

/** Every check, in the order their failures are reported. */
export function runChecks(
  day: ParsedTradingDay,
  ctx: CheckContext,
): CheckFailure[] {
  return [
    ...checkTradingDate(day, ctx),
    ...checkReadable(day),
    ...checkSecuritiesPresent(day, ctx),
    ...checkVariationLimits(day, ctx),
    ...checkIndexConsistency(day, ctx),
    ...checkVolumes(day),
    ...checkAgreesWithPublished(day, ctx),
  ];
}

/** Published when every check passes; otherwise held for review. */
export function outcomeOf(failures: CheckFailure[]): PriceStatus {
  return failures.length === 0
    ? PriceStatus.PUBLISHED
    : PriceStatus.PENDING_REVIEW;
}

const percent = (fraction: Decimal) => `${fraction.times('100').toFixed(2)}%`;
