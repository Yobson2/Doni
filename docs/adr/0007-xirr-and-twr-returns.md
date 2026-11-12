# XIRR for personal return, TWR for benchmark comparison

## Context

Users want to know two different things: "how did my money do?" and "did I beat the market?". A single return figure cannot answer both. Money-weighted return reflects the user's own timing of contributions; time-weighted return removes it, which is what a fair benchmark comparison needs. Simple percentage gain ignores both timing and dividends.

## Decision

- **"Mon rendement" is the XIRR** (money-weighted, annualised) of the portfolio, including user dividends and opening positions.
- **Benchmark comparison uses TWR** of the portfolio against the BRVM Composite over the same period.
- Every figure is labelled with its method and period. Performance is only measured from the earliest data available (e.g. "performance since <date>" for opening positions). When data is missing for part of a period, the UI says so rather than interpolating silently.

## Rejected alternatives

- **Simple gain percentage only**: misleading once there are several contributions or dividends.
- **XIRR only**: comparing a money-weighted return with an index is unfair to or flattering for the user depending on timing.
- **TWR only**: does not answer the user's main question about their own money.

## Consequences

- Two return engines, each tested against hand-computed cases.
- Full TWR history depends on historical index data (the backfill), and hence on the licence gate (ADR-0003).
