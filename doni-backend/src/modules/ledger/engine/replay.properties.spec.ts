import fc from 'fast-check';
import { InsufficientQuantityError, replay } from '.';
import type { CorporateAction, LedgerEntry, ReplayResult } from '.';

/*
 * Property tests of the replay (ADR 0004): whatever the ledger, replaying it
 * is deterministic, does not depend on the order entries of the same day
 * were recorded in, and never leaves a position negative at any date.
 */

// Enough runs to reach rare cases, such as same-day buys whose PMP does not
// divide exactly.
fc.configureGlobal({ numRuns: 1000 });

const SECURITIES = ['snts', 'orac'] as const;
const DATES = [
  '2024-01-02',
  '2024-01-03',
  '2024-06-14',
  '2025-03-10',
  '2026-01-05',
] as const;

const amount = fc.oneof(
  fc.integer({ min: 0, max: 50_000 }).map(String),
  fc
    .tuple(fc.integer({ min: 0, max: 50_000 }), fc.integer({ min: 1, max: 99 }))
    .map(([units, cents]) => `${units}.${String(cents).padStart(2, '0')}`),
);
const shares = (max: number) => fc.integer({ min: 1, max }).map(String);

const common = {
  securityId: fc.constantFrom(...SECURITIES),
  date: fc.constantFrom(...DATES),
};

type Draft = LedgerEntry extends infer E
  ? E extends LedgerEntry
    ? Omit<E, 'id'>
    : never
  : never;

const trade = fc.record({
  ...common,
  kind: fc.constantFrom('buy' as const, 'sell' as const),
  quantity: shares(30),
  price: amount,
  fees: amount,
});
const opening = fc.record({
  ...common,
  kind: fc.constant('opening_position' as const),
  quantity: shares(30),
  pmp: amount,
});

/**
 * A ledger: trades and opening positions over a few securities and dates,
 * at most one opening position per security and day (two would contradict
 * each other; the engine refuses them).
 */
const ledger = fc
  .array(fc.oneof({ arbitrary: trade, weight: 4 }, opening), {
    maxLength: 25,
  })
  .map((drafts: Draft[]) => {
    const openings = new Set<string>();
    return drafts
      .filter((d) => {
        if (d.kind !== 'opening_position') return true;
        const key = `${d.securityId}@${d.date}`;
        if (openings.has(key)) return false;
        openings.add(key);
        return true;
      })
      .map((d, i): LedgerEntry => ({ ...d, id: `e${i}` }) as LedgerEntry);
  });

const corporateActions = fc.uniqueArray(
  fc.record<CorporateAction>({
    id: fc.constantFrom('ca1', 'ca2', 'ca3'),
    kind: fc.constantFrom(
      'split' as const,
      'reverse_split' as const,
      'free_shares' as const,
      'rights_issue' as const,
    ),
    securityId: fc.constantFrom(...SECURITIES),
    effectiveDate: fc.constantFrom(...DATES),
    held: fc.integer({ min: 1, max: 10 }).map(String),
    received: fc.integer({ min: 1, max: 10 }).map(String),
    cashInLieuPrice: fc.option(amount, { nil: null }),
  }),
  { maxLength: 3, selector: (a) => a.id },
);

/** The replay's result, or the kind of rule it broke. */
function outcome(
  entries: readonly LedgerEntry[],
  actions: readonly CorporateAction[] = [],
): ReplayResult | string {
  try {
    return replay({ entries, prices: new Map(), corporateActions: actions });
  } catch (error) {
    if (error instanceof InsufficientQuantityError) return error.name;
    throw error;
  }
}

describe('ledger engine replay: properties', () => {
  it('is deterministic: the same ledger always gives the same result', () => {
    fc.assert(
      fc.property(ledger, corporateActions, (entries, actions) => {
        expect(outcome(entries, actions)).toEqual(outcome(entries, actions));
      }),
    );
  });

  it('gives the same positions whatever order entries of the same dates are in', () => {
    fc.assert(
      fc.property(
        ledger,
        corporateActions,
        fc.infiniteStream(fc.integer()),
        (entries, actions, randoms) => {
          // Another recording order: the entries are listed in a shuffled
          // order, and their ids, the replay's last tiebreak within a day,
          // are handed out again in a different order.
          const shuffled = [...entries]
            .map((entry) => ({ entry, key: randoms.next().value as number }))
            .sort((a, b) => a.key - b.key)
            .map(({ entry }, i) => ({ ...entry, id: `r${i}` }));

          expect(outcome(shuffled, actions)).toEqual(outcome(entries, actions));
        },
      ),
    );
  });

  it('never leaves a position negative, at any date', () => {
    fc.assert(
      fc.property(ledger, corporateActions, (entries, actions) => {
        const full = outcome(entries, actions);
        if (typeof full === 'string') return; // refused as a whole
        // A ledger that replays holds at every date: replaying only the
        // entries up to that date leaves no position below zero.
        for (const date of DATES) {
          const upTo = outcome(
            entries.filter((e) => e.date <= date),
            actions,
          );
          expect(typeof upTo).not.toBe('string');
          for (const position of (upTo as ReplayResult).positions) {
            expect(Number(position.quantity)).toBeGreaterThanOrEqual(0);
            expect(position.quantity.startsWith('-')).toBe(false);
          }
        }
      }),
    );
  });

  it('refuses any ledger in which a sale exceeds the shares then held', () => {
    fc.assert(
      fc.property(ledger, corporateActions, (entries, actions) => {
        const result = outcome(entries, actions);
        // An extra sale of more shares than exist in the whole ledger.
        const sale: LedgerEntry = {
          id: 'oversold',
          kind: 'sell',
          securityId: 'snts',
          date: DATES[DATES.length - 1],
          quantity: '1000000000',
          price: '1',
          fees: '0',
        };
        expect(outcome([...entries, sale], actions)).toBe(
          typeof result === 'string' ? result : 'InsufficientQuantityError',
        );
      }),
    );
  });
});
