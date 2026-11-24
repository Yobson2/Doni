import { cashInLieu } from './corporate-actions';
import { Decimal, ZERO, toDecimalString } from './decimal';
import { performanceStart } from './performance-start';
import { replay } from './replay';
import { twr } from './twr';
import type {
  CashFlow,
  CorporateAction,
  DataGap,
  DatedValue,
  LedgerEntry,
  ReturnsInput,
  ReturnsResult,
  TwrDay,
} from './types';
import { xirr } from './xirr';

const ONE = new Decimal('1');
/** Decimal places of the benchmark's returns, as for the TWR. */
const RETURN_DP = 10;

/**
 * A portfolio's returns over a period (ADR 0007): its XIRR ("Mon
 * rendement"), its TWR at each trading day's close next to the benchmark's
 * change over the same days, and the days on which data is missing.
 *
 * The period starts on the later of `from` and the performance start (an
 * opening position says nothing about earlier days) and ends on the last
 * trading day on or before `to`. A trading day is one with a published
 * benchmark value or end-of-day price.
 *
 * - The holdings the period starts with (every entry dated before it, and
 *   opening positions dated on it) are valued at their latest close on or
 *   before its first day: money paid in on that day. With the full trade
 *   history and the whole period, there are none.
 * - From then on, each buy (cost and fees) is money paid in on its date;
 *   each sale (proceeds net of fees), user dividend (the net amount
 *   confirmed; dividend suggestions never reach the engine) and cash paid
 *   for a fraction of a share by a corporate action is money received.
 * - The holdings at the end, valued at their latest close on or before its
 *   last day, are money received on that day.
 *
 * Holdings are replayed with the corporate actions in effect on each day,
 * so they are in the shares of that day, as the end-of-day prices are: a
 * split changes neither the value nor the return.
 *
 * Nothing is interpolated. A trading day on which a held security has no
 * end-of-day price has no portfolio point, one with no benchmark value no
 * benchmark point, and both are listed as data gaps; so are the start and
 * end valuations when they cannot be made, and then the XIRR is "unpriced".
 */
export function portfolioReturns(input: ReturnsInput): ReturnsResult {
  const { entries, prices, benchmark } = input;
  const actions = input.corporateActions ?? [];
  const start = performanceStart(entries);
  if (start === null) return NOTHING;
  const from = input.from > start ? input.from : start;
  if (from > input.to) return NOTHING;

  const days = tradingDays(input, from);
  const to = days.at(-1) ?? input.to;
  const closes = new Closes(prices);
  const holdings = new HoldingsTimeline(entries, actions);
  const gaps = new GapList();
  const benchmarkOn = new Map(benchmark.map((p) => [p.date, p.value]));

  // The start: what is held going into the first day, at its latest close.
  const opening = quantities(
    entries.filter(
      (e) =>
        e.date < from || (e.kind === 'opening_position' && e.date === from),
    ),
    actions.filter((a) => a.effectiveDate <= from),
  );
  const startValue = closes.value(opening, from, 'asOf');
  gaps.add(from, false, startValue.missing);
  const benchmarkBase = latest(benchmark, from);
  if (!benchmarkBase) gaps.add(from, true, []);

  const flows = flowsOf(entries, actions, from, to);

  // Each trading day: its value, the flows since the previous one, its gaps.
  const twrDays: TwrDay[] = [];
  let next = 0;
  for (const [i, date] of days.entries()) {
    let inflow = i === 0 ? (startValue.value ?? ZERO) : ZERO;
    let outflow = ZERO;
    for (; next < flows.length && flows[next].date <= date; next++) {
      inflow = inflow.plus(flows[next].inflow);
      outflow = outflow.plus(flows[next].outflow);
    }
    const value = closes.value(holdings.atClose(date), date, 'exact');
    gaps.add(date, !benchmarkOn.has(date), value.missing);
    twrDays.push({
      date,
      value: value.value === null ? null : toDecimalString(value.value),
      inflow: toDecimalString(inflow),
      outflow: toDecimalString(outflow),
    });
  }

  const portfolio = startValue.value === null ? null : twr(twrDays);
  const series = days.map((date, i) => {
    const index = benchmarkOn.get(date);
    return {
      date,
      portfolio: portfolio?.[i].twr ?? null,
      benchmark:
        benchmarkBase && index
          ? toDecimalString(
              new Decimal(index).div(benchmarkBase).minus(ONE).round(RETURN_DP),
            )
          : null,
    };
  });

  // The end: what is held at the last day's close, at its latest close.
  const endValue = closes.value(holdings.atClose(to), to, 'asOf');
  gaps.add(to, false, endValue.missing);

  return {
    period: { from, to },
    xirr:
      startValue.value === null || endValue.value === null
        ? { status: 'unpriced' }
        : xirr([
            { date: from, amount: toDecimalString(startValue.value.neg()) },
            ...flows.flatMap((flow): CashFlow[] => [
              { date: flow.date, amount: toDecimalString(flow.inflow.neg()) },
              { date: flow.date, amount: toDecimalString(flow.outflow) },
            ]),
            { date: to, amount: toDecimalString(endValue.value) },
          ]),
    series,
    gaps: gaps.list(),
  };
}

const NOTHING: ReturnsResult = {
  period: null,
  xirr: { status: 'no_solution' },
  series: [],
  gaps: [],
};

/** The dates with a benchmark value or a close, from `from` to `to`. */
function tradingDays(input: ReturnsInput, from: string): string[] {
  const dates = new Set<string>();
  for (const series of [input.benchmark, ...input.prices.values()]) {
    for (const { date } of series) {
      if (date >= from && date <= input.to) dates.add(date);
    }
  }
  return [...dates].sort();
}

/** The value on or before `date` of a series sorted oldest first. */
function latest(
  series: readonly DatedValue[],
  date: string,
): string | undefined {
  let found: string | undefined;
  for (const point of series) {
    if (point.date > date) break;
    found = point.value;
  }
  return found;
}

/** Money paid in and received on one day. */
interface Flow {
  date: string;
  inflow: Decimal;
  outflow: Decimal;
}

/**
 * The flows dated `from` to `to`, oldest first: buys, sales and user
 * dividends, and cash paid for fractions of shares by corporate actions
 * effective after `from` (one effective on `from` applies before the
 * period starts).
 */
function flowsOf(
  entries: readonly LedgerEntry[],
  actions: readonly CorporateAction[],
  from: string,
  to: string,
): Flow[] {
  const flows: Flow[] = [];
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    if (entry.kind === 'buy') {
      const cost = new Decimal(entry.quantity)
        .times(entry.price)
        .plus(entry.fees);
      flows.push({ date: entry.date, inflow: cost, outflow: ZERO });
    } else if (entry.kind === 'sell') {
      const proceeds = new Decimal(entry.quantity)
        .times(entry.price)
        .minus(entry.fees);
      flows.push({ date: entry.date, inflow: ZERO, outflow: proceeds });
    } else if (entry.kind === 'dividend') {
      const amount = new Decimal(entry.amount);
      flows.push({ date: entry.date, inflow: ZERO, outflow: amount });
    }
    // An opening position in the period is its start (see performanceStart).
  }
  for (const action of actions) {
    const date = action.effectiveDate;
    if (date <= from || date > to || action.cashInLieuPrice == null) continue;
    const held = quantities(
      entries.filter((e) => e.date < date),
      actions.filter(
        (a) =>
          a.effectiveDate < date ||
          (a.effectiveDate === date && a.id < action.id),
      ),
    ).get(action.securityId);
    const cash = held ? cashInLieu(action, held) : ZERO;
    if (cash.gt(ZERO)) flows.push({ date, inflow: ZERO, outflow: cash });
  }
  return flows.sort((a, b) => a.date.localeCompare(b.date));
}

/** The shares held of each security after replaying, those above 0 only. */
function quantities(
  entries: readonly LedgerEntry[],
  corporateActions: readonly CorporateAction[],
): Map<string, Decimal> {
  const { positions } = replay({
    entries,
    prices: new Map(),
    corporateActions,
  });
  return new Map(
    positions
      .filter((p) => p.quantity !== '0')
      .map((p) => [p.securityId, new Decimal(p.quantity)]),
  );
}

/**
 * The holdings at the close of any day. They only change on a day with a
 * ledger entry or a corporate action, so the ledger is replayed once per
 * such day, not once per trading day.
 */
class HoldingsTimeline {
  private readonly changes: string[];
  private readonly cache = new Map<string, Map<string, Decimal>>();

  constructor(
    private readonly entries: readonly LedgerEntry[],
    private readonly actions: readonly CorporateAction[],
  ) {
    this.changes = [
      ...new Set([
        ...entries.map((e) => e.date),
        ...actions.map((a) => a.effectiveDate),
      ]),
    ].sort();
  }

  atClose(date: string): Map<string, Decimal> {
    const changed = this.changes.filter((d) => d <= date).at(-1) ?? '';
    let held = this.cache.get(changed);
    if (!held) {
      held = quantities(
        this.entries.filter((e) => e.date <= changed),
        this.actions.filter((a) => a.effectiveDate <= changed),
      );
      this.cache.set(changed, held);
    }
    return held;
  }
}

/** End-of-day closes by security and date. */
class Closes {
  private readonly byDate = new Map<string, Map<string, string>>();

  constructor(private readonly prices: ReturnsInput['prices']) {
    for (const [securityId, series] of prices) {
      this.byDate.set(
        securityId,
        new Map(series.map((p) => [p.date, p.value])),
      );
    }
  }

  /**
   * The market value of the holdings at the close of `date` (`exact`) or at
   * each one's latest close on or before it (`asOf`); null, with the
   * securities lacking a close, when one does.
   */
  value(
    holdings: ReadonlyMap<string, Decimal>,
    date: string,
    match: 'exact' | 'asOf',
  ): { value: Decimal | null; missing: string[] } {
    let value = ZERO;
    const missing: string[] = [];
    for (const [securityId, quantity] of holdings) {
      const close =
        match === 'exact'
          ? this.byDate.get(securityId)?.get(date)
          : latest(this.prices.get(securityId) ?? [], date);
      if (close === undefined) missing.push(securityId);
      else value = value.plus(quantity.times(close));
    }
    return { value: missing.length > 0 ? null : value, missing };
  }
}

/** Data gaps by date, merged. */
class GapList {
  private readonly gaps = new Map<string, DataGap>();

  add(date: string, benchmark: boolean, securityIds: string[]): void {
    if (!benchmark && securityIds.length === 0) return;
    const gap = this.gaps.get(date) ?? { date, benchmark, securityIds: [] };
    gap.benchmark ||= benchmark;
    gap.securityIds = [...new Set([...gap.securityIds, ...securityIds])].sort();
    this.gaps.set(date, gap);
  }

  list(): DataGap[] {
    return [...this.gaps.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
