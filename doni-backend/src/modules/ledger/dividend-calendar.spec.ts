import {
  type CalendarDividend,
  type CalendarInput,
  dividendCalendar,
} from './dividend-calendar';

const TODAY = '2026-06-15';

const dividend = (
  id: string,
  exDate: string,
  paymentDate: string,
  grossPerShare = '100',
): CalendarDividend => ({ id, exDate, paymentDate, grossPerShare });

const entitlement = (referenceDividendId: string, shares: string) => ({
  referenceDividendId,
  securityId: 'snts',
  shares,
  grossAmount: String(Number(shares) * 100),
});

const calendar = (input: Partial<CalendarInput>) =>
  dividendCalendar({
    today: TODAY,
    dividends: [],
    entitlements: [],
    confirmed: [],
    dismissed: new Set(),
    ...input,
  });

describe('dividend calendar', () => {
  it('gives each dividend the ledger is entitled to its status, in the order given', () => {
    const lines = calendar({
      dividends: [
        dividend('past', '2026-05-10', '2026-05-20'),
        dividend('unpaid', '2026-06-10', '2026-06-30'),
        dividend('dismissed', '2026-04-10', '2026-04-20'),
        dividend('future', '2026-07-01', '2026-07-15'),
        dividend('exToday', TODAY, TODAY),
      ],
      entitlements: [
        entitlement('past', '30'),
        entitlement('unpaid', '30'),
        entitlement('dismissed', '30'),
        entitlement('future', '40'),
        entitlement('exToday', '40'),
      ],
      dismissed: new Set(['dismissed']),
    });

    expect(lines.map((l) => [l.referenceDividendId, l.status])).toEqual([
      ['past', 'suggested'],
      ['unpaid', 'awaiting_payment'],
      ['dismissed', 'dismissed'],
      ['future', 'upcoming'],
      ['exToday', 'suggested'],
    ]);
    expect(lines[0]).toEqual({
      referenceDividendId: 'past',
      shares: '30',
      grossAmount: '3000',
      status: 'suggested',
      netAmount: null,
      entryId: null,
    });
  });

  it('leaves out dividends the ledger is not entitled to', () => {
    expect(
      calendar({ dividends: [dividend('none', '2026-05-10', '2026-05-20')] }),
    ).toEqual([]);
  });

  it('shows a confirmed dividend with the net amount and shares recorded, even when dismissed before', () => {
    const lines = calendar({
      dividends: [dividend('paid', '2026-05-10', '2026-05-20', '120.5')],
      entitlements: [entitlement('paid', '30')],
      confirmed: [
        {
          referenceDividendId: 'paid',
          entryId: 'entry-1',
          shares: '20',
          amount: '2100',
        },
      ],
      dismissed: new Set(['paid']),
    });

    expect(lines).toEqual([
      {
        referenceDividendId: 'paid',
        shares: '20',
        grossAmount: '2410',
        status: 'confirmed',
        netAmount: '2100',
        entryId: 'entry-1',
      },
    ]);
  });

  it('keeps a confirmed dividend listed after its shares were removed from the ledger', () => {
    const lines = calendar({
      dividends: [dividend('paid', '2026-05-10', '2026-05-20')],
      confirmed: [
        {
          referenceDividendId: 'paid',
          entryId: 'entry-1',
          shares: '20',
          amount: '1700',
        },
      ],
    });

    expect(lines.map((l) => l.status)).toEqual(['confirmed']);
  });
});
