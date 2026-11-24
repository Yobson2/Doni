import type { DividendEntitlement } from './engine';
import { Decimal, toDecimalString } from './engine/decimal';

export const DIVIDEND_STATUSES = [
  'upcoming',
  'awaiting_payment',
  'suggested',
  'confirmed',
  'dismissed',
] as const;

/** Where a portfolio stands with one reference dividend. */
export type DividendStatus = (typeof DIVIDEND_STATUSES)[number];

/** A reference dividend's dates and terms. */
export interface CalendarDividend {
  id: string;
  exDate: string;
  paymentDate: string;
  grossPerShare: string;
}

/** A user dividend in the ledger, confirmed from a reference dividend. */
export interface ConfirmedDividend {
  referenceDividendId: string;
  entryId: string;
  /** Shares it was paid on, as recorded. */
  shares: string;
  /** Net amount received. */
  amount: string;
}

export interface CalendarInput {
  /** Today, YYYY-MM-DD. */
  today: string;
  dividends: readonly CalendarDividend[];
  /** The ledger's entitlements to those dividends (engine). */
  entitlements: readonly DividendEntitlement[];
  confirmed: readonly ConfirmedDividend[];
  /** Reference dividends whose suggestion the user dismissed. */
  dismissed: ReadonlySet<string>;
}

export interface CalendarLine {
  referenceDividendId: string;
  shares: string;
  grossAmount: string;
  status: DividendStatus;
  netAmount: string | null;
  entryId: string | null;
}

/**
 * The portfolio's dividend calendar: one line per reference dividend that
 * concerns it, in the order given. A dividend concerns the portfolio when
 * the user confirmed it, or when the ledger is entitled to it: shares held
 * going into the ex-date, or, before the ex-date, shares held now.
 *
 * Suggestions are derived here on every read and never stored; only a
 * confirmed dividend is a ledger entry, and only it counts anywhere.
 */
export function dividendCalendar(input: CalendarInput): CalendarLine[] {
  const entitled = new Map(
    input.entitlements.map((e) => [e.referenceDividendId, e]),
  );
  const confirmed = new Map(
    input.confirmed.map((c) => [c.referenceDividendId, c]),
  );
  const lines: CalendarLine[] = [];
  for (const dividend of input.dividends) {
    const entry = confirmed.get(dividend.id);
    if (entry) {
      lines.push({
        referenceDividendId: dividend.id,
        shares: entry.shares,
        grossAmount: toDecimalString(
          new Decimal(entry.shares).times(dividend.grossPerShare),
        ),
        status: 'confirmed',
        netAmount: entry.amount,
        entryId: entry.entryId,
      });
      continue;
    }
    const entitlement = entitled.get(dividend.id);
    if (!entitlement) continue;
    lines.push({
      referenceDividendId: dividend.id,
      shares: entitlement.shares,
      grossAmount: entitlement.grossAmount,
      status: statusOf(dividend, input),
      netAmount: null,
      entryId: null,
    });
  }
  return lines;
}

function statusOf(
  dividend: CalendarDividend,
  { today, dismissed }: CalendarInput,
): DividendStatus {
  if (dividend.exDate > today) return 'upcoming';
  if (dismissed.has(dividend.id)) return 'dismissed';
  if (dividend.paymentDate > today) return 'awaiting_payment';
  return 'suggested';
}
