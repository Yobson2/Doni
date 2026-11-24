import { InvalidLedgerEntryError, dividendEntitlements, replay } from '.';
import type {
  CorporateAction,
  LedgerEntry,
  ReferenceDividendTerms,
  ValuationPrice,
} from '.';

/*
 * Hand-computed dividend cases. A user dividend changes neither quantity nor
 * PMP; it adds its net amount to the position's dividends and to the total
 * gain (realised + unrealised + dividends). An entitlement is the shares held
 * at the close of the day before the ex-date (corporate actions effective by
 * the ex-date applied) × the gross amount per share.
 */

const SNTS = 'snts';
const ORAC = 'orac';

let nextId = 0;
const trade =
  (kind: 'buy' | 'sell') =>
  (
    date: string,
    quantity: string,
    price: string,
    fees = '0',
    securityId = SNTS,
  ): LedgerEntry => ({
    id: `e${++nextId}`,
    kind,
    securityId,
    date,
    quantity,
    price,
    fees,
  });
const buy = trade('buy');
const sell = trade('sell');
const opening = (date: string, quantity: string, pmp: string): LedgerEntry => ({
  id: `e${++nextId}`,
  kind: 'opening_position',
  securityId: SNTS,
  date,
  quantity,
  pmp,
});
const dividend = (
  date: string,
  amount: string,
  securityId = SNTS,
): LedgerEntry => ({
  id: `e${++nextId}`,
  kind: 'dividend',
  securityId,
  date,
  amount,
});
const split = (effectiveDate: string, held: string, received: string) =>
  ({
    id: `ca${++nextId}`,
    kind: 'split',
    securityId: SNTS,
    effectiveDate,
    held,
    received,
  }) satisfies CorporateAction;
const reference = (
  exDate: string,
  grossPerShare: string,
  securityId = SNTS,
): ReferenceDividendTerms => ({
  id: `rd${++nextId}`,
  securityId,
  exDate,
  grossPerShare,
});

const SNTS_PRICE: Record<string, ValuationPrice> = {
  [SNTS]: { close: '4190', date: '2026-11-11' },
};

const run = (
  entries: LedgerEntry[],
  prices: Record<string, ValuationPrice> = SNTS_PRICE,
) => replay({ entries, prices: new Map(Object.entries(prices)) });

const position = (result: ReturnType<typeof replay>, securityId = SNTS) =>
  result.positions.find((p) => p.securityId === securityId);

describe('ledger engine dividends', () => {
  describe('user dividends in the replay', () => {
    it('add their net amount to the position without changing quantity or PMP', () => {
      // 100 × 4000 + 2000 fees = 402000, PMP 4020.
      const ledger = [buy('2026-01-05', '100', '4000', '2000')];
      const without = position(run(ledger));
      const withDividend = position(
        run([...ledger, dividend('2026-06-10', '15300.5')]),
      );

      expect(withDividend).toEqual({ ...without, dividends: '15300.5' });
      expect(withDividend).toMatchObject({
        quantity: '100',
        pmp: '4020',
        costBasis: '402000',
        realisedGain: '0',
      });
    });

    it('count toward the total gain: realised + unrealised + dividends', () => {
      // Buy 100 @ 4000 (+2000 fees): cost 402000, PMP 4020.
      // Sell 40 @ 4500 (−1000 fees): 179000 − 40 × 4020 = 18200 realised.
      // 60 left, cost 241200, valued 60 × 4190 = 251400: unrealised 10200.
      // Dividends 9000 + 6300 = 15300. Total gain 18200 + 10200 + 15300.
      const result = run([
        buy('2026-01-05', '100', '4000', '2000'),
        dividend('2026-03-10', '9000'),
        sell('2026-04-01', '40', '4500', '1000'),
        dividend('2026-09-10', '6300'),
      ]);

      expect(position(result)?.dividends).toBe('15300');
      expect(result.totals).toEqual({
        costBasis: '241200',
        realisedGain: '18200',
        marketValue: '251400',
        unrealisedGain: '10200',
        dividends: '15300',
        totalGain: '43700',
      });
    });

    it('keep dividends of a position after it is fully sold, and through an opening position', () => {
      const result = run([
        buy('2026-01-05', '10', '1000'),
        dividend('2026-02-10', '500'),
        opening('2026-03-01', '20', '1100'),
        dividend('2026-05-10', '700'),
        sell('2026-06-01', '20', '1100'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '0',
        dividends: '1200',
        valuation: null,
      });
      expect(result.totals).toMatchObject({
        dividends: '1200',
        totalGain: '1200',
      });
    });

    it('leave the total gain unknown when some open position has no price', () => {
      const result = run(
        [
          buy('2026-01-05', '10', '1000'),
          buy('2026-01-05', '10', '1000', '0', ORAC),
          dividend('2026-02-10', '500'),
        ],
        SNTS_PRICE,
      );

      expect(result.totals).toMatchObject({
        dividends: '500',
        unrealisedGain: null,
        totalGain: null,
      });
    });

    it('refuse a dividend amount that is not greater than zero', () => {
      for (const amount of ['0', '-5', '1e3', 'abc']) {
        const entry = dividend('2026-02-10', amount);
        expect(() => run([buy('2026-01-05', '10', '1000'), entry])).toThrow(
          new InvalidLedgerEntryError(entry.id, 'amount', amount),
        );
      }
    });

    it('do not depend on where in the day they were recorded', () => {
      const a = buy('2026-01-05', '10', '1000');
      const b = dividend('2026-01-05', '300');
      const c = sell('2026-01-05', '10', '1200');
      expect(run([c, b, a])).toEqual(run([a, b, c]));
    });
  });

  describe('entitlements from reference dividends', () => {
    it('use the shares held at the ex-date, with a split before it and a sale after it', () => {
      // 100 bought; a 1:5 split on 2026-03-02 makes them 500; the ex-date
      // is 2026-05-10; 200 are sold on 2026-06-01, after the ex-date.
      // Entitled: 500 shares × 120 gross = 60000.
      const rd = reference('2026-05-10', '120');
      const entitlements = dividendEntitlements({
        entries: [
          buy('2026-01-05', '100', '20000'),
          sell('2026-06-01', '200', '4500'),
        ],
        corporateActions: [split('2026-03-02', '1', '5')],
        dividends: [rd],
      });

      expect(entitlements).toEqual([
        {
          referenceDividendId: rd.id,
          securityId: SNTS,
          shares: '500',
          grossAmount: '60000',
        },
      ]);
    });

    it('apply a corporate action effective on the ex-date, but not a later one', () => {
      const entries = [buy('2026-01-05', '100', '20000')];
      const onExDate = reference('2026-03-02', '10');
      const before = reference('2026-03-01', '10');

      const entitlements = dividendEntitlements({
        entries,
        corporateActions: [split('2026-03-02', '1', '5')],
        dividends: [onExDate, before],
      });

      expect(entitlements).toEqual([
        expect.objectContaining({
          referenceDividendId: onExDate.id,
          shares: '500',
          grossAmount: '5000',
        }),
        expect.objectContaining({
          referenceDividendId: before.id,
          shares: '100',
          grossAmount: '1000',
        }),
      ]);
    });

    it('do not count shares bought on the ex-date, and do count shares sold on it', () => {
      const rd = reference('2026-05-10', '100');
      const [entitlement] = dividendEntitlements({
        entries: [
          buy('2026-01-05', '30', '1000'),
          sell('2026-05-10', '30', '1100'),
          buy('2026-05-10', '50', '1100'),
        ],
        dividends: [rd],
      });

      expect(entitlement).toMatchObject({ shares: '30', grossAmount: '3000' });
    });

    it('start from an opening position stated before the ex-date', () => {
      const rd = reference('2026-05-10', '150.5');
      const [entitlement] = dividendEntitlements({
        entries: [opening('2026-02-01', '40', '3800')],
        dividends: [rd],
      });

      expect(entitlement).toMatchObject({ shares: '40', grossAmount: '6020' });
    });

    it('give nothing to a ledger without shares at the ex-date', () => {
      const entitlements = dividendEntitlements({
        entries: [
          buy('2026-01-05', '30', '1000'),
          sell('2026-04-01', '30', '1100'),
          buy('2026-06-01', '30', '1000'),
          buy('2026-01-05', '30', '1000', '0', ORAC),
        ],
        dividends: [
          reference('2026-05-10', '100'),
          reference('2026-01-05', '100'),
          reference('2026-05-10', '100', 'other'),
        ],
      });

      expect(entitlements).toEqual([]);
    });

    it('are suggestions only: the replay counts confirmed net amounts, never entitlements', () => {
      const ledger = [buy('2026-01-05', '100', '4000')];
      const rd = reference('2026-05-10', '100');
      const [entitlement] = dividendEntitlements({
        entries: ledger,
        dividends: [rd],
      });
      expect(entitlement.grossAmount).toBe('10000');

      // Unconfirmed: nothing counts.
      expect(run(ledger).totals).toMatchObject({
        dividends: '0',
        totalGain: '19000', // unrealised only: 100 × 4190 − 400000
      });
      // Confirmed: only the net amount received counts, not the gross.
      expect(
        run([...ledger, dividend('2026-06-10', '8500')]).totals,
      ).toMatchObject({ dividends: '8500', totalGain: '27500' });
    });
  });
});
