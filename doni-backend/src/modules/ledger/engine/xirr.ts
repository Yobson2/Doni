import { Decimal, ZERO, toDecimalString } from './decimal';
import type { CashFlow, XirrResult } from './types';

const ONE = new Decimal('1');
const DAYS_PER_YEAR = 365;
/** Significant digits kept by each multiplication in `power`. */
const PRECISION = 50;
/** The search stops once the daily factor moves by less than this. */
const TOLERANCE = new Decimal('1e-24');
const MAX_NEWTON_STEPS = 100;
const MAX_BISECTION_STEPS = 200;
/**
 * Bracket for the bisection fallback, as daily discount factors: 0.95 is an
 * annual rate of about +130 000 000 %, 1.05 one of about −99.999998 %.
 */
const BRACKET: [Decimal, Decimal] = [new Decimal('0.95'), new Decimal('1.05')];
/** Decimal places of the annual rate returned. */
const RATE_DP = 10;

/**
 * The XIRR of a series of dated cash flows (ADR 0007): the annual rate r at
 * which their net present value is zero, each flow discounted by
 * (1 + r)^(days since the first flow / 365), as in a spreadsheet's XIRR.
 * Flows are from the investor's side: money paid in is negative, money
 * received (sale proceeds, dividends, the final valuation) is positive.
 *
 * Decimal arithmetic only (ADR 0005). Writing x = (1 + r)^(−1/365), the
 * daily discount factor, the net present value is Σ amount · x^days: a
 * polynomial in x with whole-number powers, which the decimal library
 * computes without logarithms. Newton's method from r = 0 finds the root;
 * if it fails to converge, bisection over a wide bracket does. Then
 * r = x^(−365) − 1, rounded to 10 decimal places.
 *
 * "No solution" when the flows cannot have one (they need money both paid
 * in and received, on different days) or when no root is found.
 */
export function xirr(flows: readonly CashFlow[]): XirrResult {
  const terms = aggregate(flows);
  const signs = new Set(terms.map((t) => t.amount.gt(ZERO)));
  if (signs.size < 2) return { status: 'no_solution' };

  const x = newton(terms) ?? bisection(terms);
  if (!x) return { status: 'no_solution' };
  const rate = ONE.div(power(x, DAYS_PER_YEAR)).minus(ONE);
  return { status: 'solved', rate: toDecimalString(rate.round(RATE_DP)) };
}

interface Term {
  /** Whole days since the first flow. */
  days: number;
  amount: Decimal;
}

/** One term per day: same-day flows summed, zero sums dropped. */
function aggregate(flows: readonly CashFlow[]): Term[] {
  if (flows.length === 0) return [];
  const first = flows.map((f) => f.date).reduce((a, b) => (b < a ? b : a));
  const byDay = new Map<number, Decimal>();
  for (const flow of flows) {
    const days = daysBetween(first, flow.date);
    byDay.set(days, (byDay.get(days) ?? ZERO).plus(flow.amount));
  }
  return [...byDay]
    .filter(([, amount]) => !amount.eq(ZERO))
    .map(([days, amount]) => ({ days, amount }));
}

/** Whole days from one YYYY-MM-DD date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** x^n for a whole n ≥ 0, by squaring, to `PRECISION` significant digits. */
function power(x: Decimal, n: number): Decimal {
  let result = ONE;
  let base = x;
  for (let e = n; e > 0; e = Math.floor(e / 2)) {
    if (e % 2 === 1) result = result.times(base).prec(PRECISION);
    base = base.times(base).prec(PRECISION);
  }
  return result;
}

/** Net present value at daily factor x: Σ amount · x^days. */
const npv = (terms: Term[], x: Decimal): Decimal =>
  terms.reduce((sum, t) => sum.plus(t.amount.times(power(x, t.days))), ZERO);

/** Its derivative in x: Σ days · amount · x^(days − 1). */
const npvSlope = (terms: Term[], x: Decimal): Decimal =>
  terms.reduce(
    (sum, t) =>
      t.days === 0
        ? sum
        : sum.plus(t.amount.times(String(t.days)).times(power(x, t.days - 1))),
    ZERO,
  );

function newton(terms: Term[]): Decimal | null {
  let x = ONE;
  for (let step = 0; step < MAX_NEWTON_STEPS; step++) {
    const slope = npvSlope(terms, x);
    if (slope.eq(ZERO)) return null;
    const next = x.minus(npv(terms, x).div(slope));
    if (next.lte(ZERO)) return null;
    if (next.minus(x).abs().lt(TOLERANCE)) return next;
    x = next;
  }
  return null;
}

function bisection(terms: Term[]): Decimal | null {
  let [low, high] = BRACKET;
  const lowSign = npv(terms, low).gt(ZERO);
  if (lowSign === npv(terms, high).gt(ZERO)) return null;
  for (let step = 0; step < MAX_BISECTION_STEPS; step++) {
    const mid = low.plus(high).div('2');
    if (npv(terms, mid).gt(ZERO) === lowSign) low = mid;
    else high = mid;
    if (high.minus(low).lt(TOLERANCE)) break;
  }
  return low.plus(high).div('2');
}
