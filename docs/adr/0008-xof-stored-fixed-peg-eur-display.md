# XOF as stored currency, EUR as display only via the fixed peg

## Context

All BRVM securities trade in XOF. Many users (including the diaspora) think in EUR. The XOF is pegged to the euro at a fixed rate of 655.957 XOF per EUR.

## Decision

Every amount is **stored and computed in XOF**. Users can toggle an **EUR display**, which converts at the fixed peg rate (655.957) at display time only. The preference persists per user.

## Rejected alternatives

- **Multi-currency storage**: no BRVM security trades in another currency, so it adds complexity with no benefit.
- **A floating FX rate from a rate provider**: the rate is fixed by treaty; a provider adds a dependency and spurious variation.
- **Storing EUR amounts alongside XOF**: duplication that can drift.

## Consequences

- EUR values are exact conversions of XOF values; no FX history is needed.
- If the peg ever changes, the conversion constant changes; stored data does not.
