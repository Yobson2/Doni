import { replay } from '.';
import type { LedgerEntry, ValuationPrice } from '.';

/*
 * Hand-computed reference cases. Every expected value below was worked out
 * by hand from the PMP rules (ADR 0006), not by re-running the engine's
 * arithmetic:
 *
 *   buy:  PMP' = (quantity × PMP + bought × price + fees) / (quantity + bought)
 *   sell: realised += (sold × price − fees) − sold × PMP; PMP unchanged
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
const opening = (
  date: string,
  quantity: string,
  pmp: string,
  securityId = SNTS,
): LedgerEntry => ({
  id: `e${++nextId}`,
  kind: 'opening_position',
  securityId,
  date,
  quantity,
  pmp,
});

const run = (
  entries: LedgerEntry[],
  prices: Record<string, ValuationPrice> = {},
): ReturnType<typeof replay> =>
  replay({ entries, prices: new Map(Object.entries(prices)) });

const position = (result: ReturnType<typeof replay>, securityId = SNTS) =>
  result.positions.find((p) => p.securityId === securityId);

describe('ledger engine replay', () => {
  describe('reference cases', () => {
    it('a single buy: PMP is the price plus fees per share', () => {
      // 100 × 4000 + 2000 = 402000; 402000 / 100 = 4020
      const result = run([buy('2026-01-05', '100', '4000', '2000')]);

      expect(position(result)).toEqual({
        securityId: SNTS,
        quantity: '100',
        pmp: '4020',
        costBasis: '402000',
        realisedGain: '0',
        valuation: null,
      });
    });

    it('multiple buys: PMP is the fee-inclusive weighted average', () => {
      // 402000 + (50 × 4300 + 1075 = 216075) = 618075; 618075 / 150 = 4120.5
      const result = run([
        buy('2026-01-05', '100', '4000', '2000'),
        buy('2026-02-10', '50', '4300', '1075'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '150',
        pmp: '4120.5',
        costBasis: '618075',
        realisedGain: '0',
      });
    });

    it('partial sale: realises the gain against the PMP and leaves the PMP unchanged', () => {
      // proceeds 60 × 4500 − 1350 = 268650; cost 60 × 4120.5 = 247230
      // realised 21420; 90 shares left at 4120.5 = 370845
      const result = run([
        buy('2026-01-05', '100', '4000', '2000'),
        buy('2026-02-10', '50', '4300', '1075'),
        sell('2026-03-16', '60', '4500', '1350'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '90',
        pmp: '4120.5',
        costBasis: '370845',
        realisedGain: '21420',
      });
    });

    it('full sale: closes the position and keeps its realised gain', () => {
      // second sale: 90 × 4400 − 1980 = 394020 − 370845 = 23175
      // realised 21420 + 23175 = 44595 (= 662670 received − 618075 paid)
      const result = run([
        buy('2026-01-05', '100', '4000', '2000'),
        buy('2026-02-10', '50', '4300', '1075'),
        sell('2026-03-16', '60', '4500', '1350'),
        sell('2026-04-20', '90', '4400', '1980'),
      ]);

      expect(position(result)).toEqual({
        securityId: SNTS,
        quantity: '0',
        pmp: '0',
        costBasis: '0',
        realisedGain: '44595',
        valuation: null,
      });
    });

    it('fees on both sides: a round trip at the same price realises a loss of both fees', () => {
      // bought 10 × 1000 + 150 = 10150 (PMP 1015); sold 10 × 1000 − 150 = 9850
      const result = run([
        buy('2026-01-05', '10', '1000', '150'),
        sell('2026-01-06', '10', '1000', '150'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '0',
        realisedGain: '-300',
      });
    });

    it('keeps a PMP that does not divide exactly to 30 decimal places, and leaves it unchanged on a sale', () => {
      // 3001 / 3 = 1000.333… ; selling 1 at 1100 realises 1100 − 1000.333…
      const result = run([
        buy('2026-01-05', '3', '1000', '1'),
        sell('2026-01-06', '1', '1100'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '2',
        pmp: '1000.333333333333333333333333333333',
        costBasis: '2000.666666666666666666666666666666',
        realisedGain: '99.666666666666666666666666666667',
      });
    });
  });

  describe('valuation at end-of-day prices', () => {
    const ledger = () => [
      buy('2026-01-05', '100', '4000', '2000'),
      buy('2026-02-10', '50', '4300', '1075'),
      sell('2026-03-16', '60', '4500', '1350'),
      // 20 × 15000 + 3000 = 303000; PMP 15150
      buy('2026-05-04', '20', '15000', '3000', ORAC),
    ];

    it('values each open position at its price, with the date that price applies to', () => {
      // SNTS: 90 × 4190 = 377100; 377100 − 370845 = 6255
      // ORAC: 20 × 14800 = 296000; 296000 − 303000 = −7000
      const result = run(ledger(), {
        [SNTS]: { close: '4190', date: '2026-11-11' },
        [ORAC]: { close: '14800', date: '2026-11-10' },
      });

      expect(position(result)?.valuation).toEqual({
        price: '4190',
        priceDate: '2026-11-11',
        marketValue: '377100',
        unrealisedGain: '6255',
      });
      expect(position(result, ORAC)?.valuation).toEqual({
        price: '14800',
        priceDate: '2026-11-10',
        marketValue: '296000',
        unrealisedGain: '-7000',
      });
    });

    it('totals cost basis, market value, realised and unrealised gain', () => {
      const result = run(ledger(), {
        [SNTS]: { close: '4190', date: '2026-11-11' },
        [ORAC]: { close: '14800', date: '2026-11-10' },
      });

      expect(result.totals).toEqual({
        costBasis: '673845',
        realisedGain: '21420',
        marketValue: '673100',
        unrealisedGain: '-745',
      });
    });

    it('leaves a position without a price unvalued, and the portfolio value unknown', () => {
      const result = run(ledger(), {
        [SNTS]: { close: '4190', date: '2026-11-11' },
      });

      expect(position(result, ORAC)?.valuation).toBeNull();
      expect(result.totals).toEqual({
        costBasis: '673845',
        realisedGain: '21420',
        marketValue: null,
        unrealisedGain: null,
      });
    });

    it('does not value a closed position, and an empty ledger is worth zero', () => {
      const closed = run(
        [
          buy('2026-01-05', '10', '1000', '150'),
          sell('2026-01-06', '10', '1000', '150'),
        ],
        { [SNTS]: { close: '4190', date: '2026-11-11' } },
      );
      expect(position(closed)?.valuation).toBeNull();
      expect(closed.totals).toEqual({
        costBasis: '0',
        realisedGain: '-300',
        marketValue: '0',
        unrealisedGain: '0',
      });

      expect(run([])).toEqual({
        positions: [],
        totals: {
          costBasis: '0',
          realisedGain: '0',
          marketValue: '0',
          unrealisedGain: '0',
        },
      });
    });
  });

  describe('replay order', () => {
    it('replays by date, whatever order the entries are given in', () => {
      // A buy recorded late but dated before an existing sale.
      const result = run([
        buy('2026-01-05', '100', '4000', '2000'),
        sell('2026-03-16', '60', '4500', '1350'),
        buy('2026-02-10', '50', '4300', '1075'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '90',
        pmp: '4120.5',
        realisedGain: '21420',
      });
    });

    it('rejects a sale dated before the shares were bought', () => {
      expect(() =>
        run([
          sell('2026-01-04', '10', '4500'),
          buy('2026-01-05', '100', '4000'),
        ]),
      ).toThrow(expect.objectContaining({ name: 'InsufficientQuantityError' }));
    });

    it('applies the buys of a day before its sales, so the result does not depend on order within a day', () => {
      // Same day: buy 10 at 1000 and sell 4 at 1200, given sale first.
      // PMP 1000; realised 4 × 1200 − 4 × 1000 = 800.
      const result = run([
        sell('2026-01-05', '4', '1200'),
        buy('2026-01-05', '10', '1000'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '6',
        pmp: '1000',
        realisedGain: '800',
      });
    });
  });

  describe('malformed entries', () => {
    it.each([
      ['a zero quantity', buy('2026-01-05', '0', '4000')],
      ['a negative quantity', buy('2026-01-05', '-5', '4000')],
      ['a negative price', buy('2026-01-05', '5', '-4000')],
      ['negative fees', buy('2026-01-05', '5', '4000', '-1')],
      ['a value that is not a decimal', buy('2026-01-05', '5', '4,000')],
      ['a float-style exponent', buy('2026-01-05', '5', '4e3')],
    ])('rejects %s', (_case, entry) => {
      expect(() => run([entry])).toThrow(
        expect.objectContaining({
          name: 'InvalidLedgerEntryError',
          entryId: entry.id,
        }),
      );
    });
  });

  describe('selling more than is held', () => {
    it('is rejected, naming the entry, the quantity held and the quantity sold', () => {
      const oversell = sell('2026-03-16', '101', '4500');

      expect(() =>
        run([buy('2026-01-05', '100', '4000', '2000'), oversell]),
      ).toThrow(
        expect.objectContaining({
          name: 'InsufficientQuantityError',
          entryId: oversell.id,
          securityId: SNTS,
          date: '2026-03-16',
          held: '100',
          sold: '101',
        }),
      );
    });

    it('is rejected when nothing is held', () => {
      expect(() => run([sell('2026-03-16', '1', '4500')])).toThrow(
        expect.objectContaining({
          name: 'InsufficientQuantityError',
          held: '0',
        }),
      );
    });

    it('is judged per security', () => {
      expect(() =>
        run([
          buy('2026-01-05', '100', '4000', '0', ORAC),
          sell('2026-03-16', '1', '4500', '0', SNTS),
        ]),
      ).toThrow(expect.objectContaining({ securityId: SNTS }));
    });
  });

  describe('opening positions', () => {
    it('an opening position alone: holds its quantity at its PMP, with no gain realised', () => {
      // 200 × 3850.25 = 770050
      const result = run([opening('2026-01-02', '200', '3850.25')]);

      expect(position(result)).toEqual({
        securityId: SNTS,
        quantity: '200',
        pmp: '3850.25',
        costBasis: '770050',
        realisedGain: '0',
        valuation: null,
      });
    });

    it('opening position + later buy: the buy averages into the opening PMP', () => {
      // 200 × 3850.25 = 770050; buy 50 × 4100 + 1450 = 206450
      // 976500 / 250 = 3906
      const result = run([
        opening('2026-01-02', '200', '3850.25'),
        buy('2026-02-10', '50', '4100', '1450'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '250',
        pmp: '3906',
        costBasis: '976500',
        realisedGain: '0',
      });
    });

    it('opening position + partial sale: realises the gain against the opening PMP', () => {
      // proceeds 80 × 4200 − 1680 = 334320; cost 80 × 3850.25 = 308020
      // realised 26300; 120 left at 3850.25 = 462030
      const result = run([
        opening('2026-01-02', '200', '3850.25'),
        sell('2026-03-16', '80', '4200', '1680'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '120',
        pmp: '3850.25',
        costBasis: '462030',
        realisedGain: '26300',
      });
    });

    it('opening position + full sale: closes the position and keeps its realised gain', () => {
      // 200 × 4000 − 4000 = 796000; 796000 − 770050 = 25950
      const result = run([
        opening('2026-01-02', '200', '3850.25'),
        sell('2026-04-20', '200', '4000', '4000'),
      ]);

      expect(position(result)).toEqual({
        securityId: SNTS,
        quantity: '0',
        pmp: '0',
        costBasis: '0',
        realisedGain: '25950',
        valuation: null,
      });
    });

    it('opening position + buy + two sales: realised gain is what was received minus the opening cost and what was paid', () => {
      // opening 770050 + buy 206450 = 976500 for 250 shares (PMP 3906)
      // sell 100: 420000 − 2100 = 417900 − 390600 = 27300; 150 left, 585900
      // sell 150: 570000 − 2850 = 567150 − 585900 = −18750
      // realised 8550 (= 985050 received − 976500 cost)
      const result = run([
        opening('2026-01-02', '200', '3850.25'),
        buy('2026-02-10', '50', '4100', '1450'),
        sell('2026-03-16', '100', '4200', '2100'),
        sell('2026-04-20', '150', '3800', '2850'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '0',
        realisedGain: '8550',
      });
    });

    it('is valued at end-of-day prices like any position', () => {
      // 200 × 4190 = 838000; 838000 − 770050 = 67950
      const result = run([opening('2026-01-02', '200', '3850.25')], {
        [SNTS]: { close: '4190', date: '2026-11-11' },
      });

      expect(position(result)?.valuation).toEqual({
        price: '4190',
        priceDate: '2026-11-11',
        marketValue: '838000',
        unrealisedGain: '67950',
      });
    });

    it("states the holding at the start of its day: the same day's buys and sales apply on top, whatever the order given", () => {
      // opening 100 at 4000 = 400000; buy 25 × 4200 = 105000
      // 505000 / 125 = 4040; sell 30 × 4300 = 129000 − 30 × 4040 = 7800
      // 95 left at 4040 = 383800
      const result = run([
        sell('2026-01-02', '30', '4300'),
        buy('2026-01-02', '25', '4200'),
        opening('2026-01-02', '100', '4000'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '95',
        pmp: '4040',
        costBasis: '383800',
        realisedGain: '7800',
      });
    });

    it('supersedes the quantity and PMP of earlier entries for its security, and keeps gains they realised', () => {
      // buy 50 × 3000; sell 20 × 3500 = 70000 − 60000 = 10000 realised
      // the opening position then states 200 held at 3850.25
      const result = run([
        buy('2025-06-02', '50', '3000'),
        sell('2025-09-01', '20', '3500'),
        opening('2026-01-02', '200', '3850.25'),
      ]);

      expect(position(result)).toMatchObject({
        quantity: '200',
        pmp: '3850.25',
        costBasis: '770050',
        realisedGain: '10000',
      });
    });

    it('does not cover a sale dated before it', () => {
      expect(() =>
        run([
          sell('2025-12-31', '10', '4000'),
          opening('2026-01-02', '200', '3850.25'),
        ]),
      ).toThrow(
        expect.objectContaining({
          name: 'InsufficientQuantityError',
          held: '0',
        }),
      );
    });

    it('only sets the holding of its own security', () => {
      // ORAC: 20 × 15000 + 3000 = 303000 (PMP 15150), untouched
      const result = run([
        buy('2025-05-04', '20', '15000', '3000', ORAC),
        opening('2026-01-02', '200', '3850.25'),
      ]);

      expect(position(result, ORAC)).toMatchObject({
        quantity: '20',
        pmp: '15150',
      });
      expect(result.totals.costBasis).toBe('1073050'); // 303000 + 770050
    });

    it.each([
      ['a zero quantity', '0', '4000'],
      ['a negative PMP', '10', '-4000'],
      ['a PMP that is not a decimal', '10', '4,000'],
    ])('rejects %s', (_case, quantity, pmp) => {
      const entry = opening('2026-01-02', quantity, pmp);
      expect(() => run([entry])).toThrow(
        expect.objectContaining({
          name: 'InvalidLedgerEntryError',
          entryId: entry.id,
        }),
      );
    });
  });
});
