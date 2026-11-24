import { Decimal, ZERO, toDecimalString } from './decimal';
import type { TwrDay, TwrPoint } from './types';

const ONE = new Decimal('1');
/** Decimal places of the returns given back. */
const RETURN_DP = 10;

/**
 * The cumulative time-weighted return (ADR 0007) at each day's close, as a
 * fraction ("0.1" is 10 %): the period cut into sub-periods at every
 * valued day, so at least at every external flow, and their returns linked
 * by multiplication. The size and timing of the user's own flows drop out.
 *
 * A sub-period's return is (value + outflow) / (previous value + inflow) − 1:
 * money put in (a buy) is taken to arrive at its start and earn the
 * sub-period's return; money taken out (a sale, a user dividend) at its end,
 * having earned it. That keeps the base positive on the day of a first buy
 * and on the day everything is sold.
 *
 * A day with no value (a data gap) has no point; its flows carry over to the
 * next valued day, whose sub-period then spans the gap. A sub-period with
 * nothing invested (no previous value, nothing put in) has a return of 0.
 */
export function twr(days: readonly TwrDay[]): TwrPoint[] {
  let growth = ONE;
  let previous = ZERO;
  let inflow = ZERO;
  let outflow = ZERO;
  return days.map((day) => {
    inflow = inflow.plus(day.inflow);
    outflow = outflow.plus(day.outflow);
    if (day.value === null) return { date: day.date, twr: null };

    const value = new Decimal(day.value);
    const base = previous.plus(inflow);
    if (base.gt(ZERO)) growth = growth.times(value.plus(outflow).div(base));
    previous = value;
    inflow = ZERO;
    outflow = ZERO;
    return {
      date: day.date,
      twr: toDecimalString(growth.minus(ONE).round(RETURN_DP)),
    };
  });
}
