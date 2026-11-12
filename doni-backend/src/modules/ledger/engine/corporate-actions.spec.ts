import { replay } from '.';
import type {
  CorporateAction,
  CorporateActionKind,
  LedgerEntry,
  ValuationPrice,
} from '.';

/*
 * Hand-computed corporate action cases. Every expected value was worked out
 * by hand from the rules (ADR 0006: quantity and PMP adjust, total cost is
 * preserved), not by re-running the engine's arithmetic:
 *
 *   split / reverse split: quantity × received / held
 *   free shares:           quantity × (held + received) / held
 *   PMP:                   total cost / new quantity
 */

const SNTS = 'snts';

let nextId = 0;
const trade =
  (kind: 'buy' | 'sell') =>
  (date: string, quantity: string, price: string, fees = '0'): LedgerEntry => ({
    id: `e${++nextId}`,
    kind,
    securityId: SNTS,
    date,
    quantity,
    price,
    fees,
  });
const buy = trade('buy');
const sell = trade('sell');

const action =
  (kind: CorporateActionKind) =>
  (
    effectiveDate: string,
    held: string,
    received: string,
    cashInLieuPrice?: string,
  ): CorporateAction => ({
    id: `ca${++nextId}`,
    kind,
    securityId: SNTS,
    effectiveDate,
    held,
    received,
    cashInLieuPrice,
  });
const split = action('split');
const reverseSplit = action('reverse_split');
const freeShares = action('free_shares');

const run = (
  entries: LedgerEntry[],
  corporateActions: CorporateAction[],
  prices: Record<string, ValuationPrice> = {},
) =>
  replay({
    entries,
    corporateActions,
    prices: new Map(Object.entries(prices)),
  });

const position = (result: ReturnType<typeof replay>) =>
  result.positions.find((p) => p.securityId === SNTS);

describe('ledger engine corporate actions', () => {
  it('a split multiplies the quantity and divides the PMP, preserving total cost', () => {
    // 100 × 20000 + 5000 = 2005000 (PMP 20050); 1:5 split → 500 shares
    // 2005000 / 500 = 4010
    const result = run(
      [buy('2026-01-05', '100', '20000', '5000')],
      [split('2026-04-02', '1', '5')],
    );

    expect(position(result)).toMatchObject({
      quantity: '500',
      pmp: '4010',
      costBasis: '2005000',
      realisedGain: '0',
    });
  });

  it('a reverse split divides the quantity and multiplies the PMP, preserving total cost', () => {
    // 1000 × 400 + 2000 = 402000 (PMP 402); 10:1 reverse split → 100 shares
    // 402000 / 100 = 4020
    const result = run(
      [buy('2026-01-05', '1000', '400', '2000')],
      [reverseSplit('2026-04-02', '10', '1')],
    );

    expect(position(result)).toMatchObject({
      quantity: '100',
      pmp: '4020',
      costBasis: '402000',
      realisedGain: '0',
    });
  });

  it('free shares add shares at no cost, lowering the PMP', () => {
    // 100 × 4000 + 2000 = 402000; one free share for 10 held → 100 + 10 = 110
    // 402000 / 110 = 3654.5454… (30 decimal places, banker's rounding)
    const result = run(
      [buy('2026-01-05', '100', '4000', '2000')],
      [freeShares('2026-06-15', '10', '1')],
    );

    expect(position(result)).toMatchObject({
      quantity: '110',
      pmp: '3654.545454545454545454545454545455',
      realisedGain: '0',
    });
  });

  it('a rights issue changes nothing by itself: the subscription is a buy the holder records', () => {
    // 100 at 4000 = 400000; rights 1 for 4 at 3000; holder subscribes 25
    // → 125 shares, 400000 + 75000 = 475000; PMP 3800
    const rightsIssue = action('rights_issue');
    const unsubscribed = run(
      [buy('2026-01-05', '100', '4000')],
      [rightsIssue('2026-06-15', '4', '1')],
    );
    const subscribed = run(
      [buy('2026-01-05', '100', '4000'), buy('2026-07-01', '25', '3000')],
      [rightsIssue('2026-06-15', '4', '1')],
    );

    expect(position(unsubscribed)).toMatchObject({
      quantity: '100',
      pmp: '4000',
    });
    expect(position(subscribed)).toMatchObject({
      quantity: '125',
      pmp: '3800',
    });
  });

  describe('valuation', () => {
    it('puts an end-of-day price dated before the action in new shares', () => {
      // 100 at 20000 → 1:5 split on 2026-11-02 → 500 at 4000
      // last price 20500 on 2026-10-30, before the split: 20500 / 5 = 4100
      // 500 × 4100 = 2050000; unrealised 2050000 − 2000000 = 50000
      const result = run(
        [buy('2026-01-05', '100', '20000')],
        [split('2026-11-02', '1', '5')],
        { [SNTS]: { close: '20500', date: '2026-10-30' } },
      );

      expect(position(result)?.valuation).toEqual({
        price: '4100',
        priceDate: '2026-10-30',
        marketValue: '2050000',
        unrealisedGain: '50000',
      });
    });

    it('uses a price dated on or after the action as it is', () => {
      const result = run(
        [buy('2026-01-05', '100', '20000')],
        [split('2026-11-02', '1', '5')],
        { [SNTS]: { close: '4100', date: '2026-11-02' } },
      );

      expect(position(result)?.valuation?.price).toBe('4100');
    });
  });

  describe('malformed corporate actions', () => {
    it.each([
      ['a zero ratio', split('2026-04-02', '0', '5'), 'held'],
      ['a fractional ratio', split('2026-04-02', '1', '2.5'), 'received'],
      ['a negative ratio', freeShares('2026-04-02', '10', '-1'), 'received'],
      [
        'a negative cash-in-lieu price',
        reverseSplit('2026-04-02', '10', '1', '-1'),
        'cashInLieuPrice',
      ],
    ])('rejects %s', (_case, corporateAction, field) => {
      expect(() =>
        run([buy('2026-01-05', '100', '4000')], [corporateAction]),
      ).toThrow(
        expect.objectContaining({
          name: 'InvalidCorporateActionError',
          corporateActionId: corporateAction.id,
          field,
        }),
      );
    });
  });

  describe('fractions of a share', () => {
    it('without a cash-in-lieu price, keeps the whole shares and their total cost', () => {
      // 105 × 4000 = 420000; 10:1 reverse split → 10.5 → 10 shares kept
      // 420000 / 10 = 42000; nothing realised
      const result = run(
        [buy('2026-01-05', '105', '4000')],
        [reverseSplit('2026-04-02', '10', '1')],
      );

      expect(position(result)).toMatchObject({
        quantity: '10',
        pmp: '42000',
        costBasis: '420000',
        realisedGain: '0',
      });
    });

    it('with a cash-in-lieu price, sells the fraction at that price', () => {
      // 10.5 new shares at 420000 / 10.5 = 40000 each; 0.5 paid 0.5 × 41000
      // = 20500 against a cost of 0.5 × 40000 = 20000: realised 500
      // 10 shares kept at 40000 = 400000
      const result = run(
        [buy('2026-01-05', '105', '4000')],
        [reverseSplit('2026-04-02', '10', '1', '41000')],
      );

      expect(position(result)).toMatchObject({
        quantity: '10',
        pmp: '40000',
        costBasis: '400000',
        realisedGain: '500',
      });
    });

    it('rounds free shares down to whole shares', () => {
      // 105 held, one free for 10 → 115.5 → 115 kept; 420000 / 115
      const result = run(
        [buy('2026-01-05', '105', '4000')],
        [freeShares('2026-06-15', '10', '1')],
      );

      expect(position(result)).toMatchObject({
        quantity: '115',
        pmp: '3652.173913043478260869565217391304',
        realisedGain: '0',
      });
    });

    it('settles a fractional free share in cash at the cash-in-lieu price', () => {
      // 115.5 at 420000 / 115.5 = 3636.3636… ; 0.5 × 3700 = 1850 paid
      // against 0.5 × 3636.3636… = 1818.1818…: realised 31.8181…
      const result = run(
        [buy('2026-01-05', '105', '4000')],
        [freeShares('2026-06-15', '10', '1', '3700')],
      );

      expect(position(result)).toMatchObject({
        quantity: '115',
        pmp: '3636.363636363636363636363636363636',
        realisedGain: '31.818181818181818181818181818182',
      });
    });

    it('closes a position left with less than one share, realising its cost against the cash paid', () => {
      // 5 × 4000 = 20000; 10:1 → 0.5 share, paid 0.5 × 41000 = 20500
      // realised 500 with a price; −20000 (nothing known to be paid) without
      const withPrice = run(
        [buy('2026-01-05', '5', '4000')],
        [reverseSplit('2026-04-02', '10', '1', '41000')],
      );
      const withoutPrice = run(
        [buy('2026-01-05', '5', '4000')],
        [reverseSplit('2026-04-02', '10', '1')],
      );

      expect(position(withPrice)).toMatchObject({
        quantity: '0',
        pmp: '0',
        realisedGain: '500',
      });
      expect(position(withoutPrice)).toMatchObject({
        quantity: '0',
        pmp: '0',
        realisedGain: '-20000',
      });
    });
  });

  describe('trades around the effective date', () => {
    it('a sale after a split is in new shares and realises against the adjusted PMP', () => {
      // 100 at PMP 20050 → 500 at 4010 (1:5 on 2026-04-02)
      // sell 300 at 4500 − 6750 fees: 1350000 − 6750 = 1343250
      // cost 300 × 4010 = 1203000; realised 140250; 200 left at 4010 = 802000
      const result = run(
        [
          buy('2026-01-05', '100', '20000', '5000'),
          sell('2026-05-11', '300', '4500', '6750'),
        ],
        [split('2026-04-02', '1', '5')],
      );

      expect(position(result)).toMatchObject({
        quantity: '200',
        pmp: '4010',
        costBasis: '802000',
        realisedGain: '140250',
      });
    });

    it('a trade on the effective date is already in new shares', () => {
      // The split applies before the day's entries: buy 100 at 20000 on
      // 2026-01-05 → 500 at 4000; buy 100 at 4100 on the effective day
      // → 600 shares, cost 2000000 + 410000 = 2410000; PMP 4016.666…
      const result = run(
        [buy('2026-04-02', '100', '4100'), buy('2026-01-05', '100', '20000')],
        [split('2026-04-02', '1', '5')],
      );

      expect(position(result)).toMatchObject({
        quantity: '600',
        pmp: '4016.666666666666666666666666666667',
      });
    });

    it('a trade backdated before a split is adjusted by it, whenever it was recorded', () => {
      // Recorded last, dated before the split: 100 at 20000 + 50 at 21000
      // = 3050000 for 150 → split 1:5 → 750 shares at 3050000 / 750 = 4066.666…
      // then sell 700 at 4200: 2940000 − 700 × 4066.666… = 93333.333…
      const result = run(
        [
          buy('2026-01-05', '100', '20000'),
          sell('2026-05-11', '700', '4200'),
          buy('2026-03-02', '50', '21000'),
        ],
        [split('2026-04-02', '1', '5')],
      );

      expect(position(result)).toMatchObject({
        quantity: '50',
        pmp: '4066.666666666666666666666666666667',
        realisedGain: '93333.3333333333333333333333333331',
      });
    });

    it('rejects a sale after a split that exceeds the adjusted quantity', () => {
      expect(() =>
        run(
          [
            buy('2026-01-05', '100', '20000'),
            sell('2026-05-11', '501', '4200'),
          ],
          [split('2026-04-02', '1', '5')],
        ),
      ).toThrow(
        expect.objectContaining({
          name: 'InsufficientQuantityError',
          held: '500',
          sold: '501',
        }),
      );
    });

    it('applies an action with no later ledger entry', () => {
      const result = run(
        [buy('2026-01-05', '100', '20000')],
        [split('2026-11-02', '1', '5')],
      );

      expect(position(result)).toMatchObject({ quantity: '500', pmp: '4000' });
    });

    it('leaves a position closed before the action at zero, with its realised gain', () => {
      // bought 10 at 1000, sold 10 at 1100: realised 1000
      const result = run(
        [buy('2026-01-05', '10', '1000'), sell('2026-02-05', '10', '1100')],
        [split('2026-04-02', '1', '5')],
      );

      expect(position(result)).toMatchObject({
        quantity: '0',
        pmp: '0',
        realisedGain: '1000',
      });
    });

    it('ignores an action on a security the ledger never held', () => {
      const result = run([], [split('2026-04-02', '1', '5')]);

      expect(result.positions).toEqual([]);
    });
  });
});
