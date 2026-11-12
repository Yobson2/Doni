# BOC-first market data, with a licence gate before public launch

## Context

Doni needs end-of-day prices, index values, corporate actions and dividends for BRVM securities. The BRVM publishes the BOC as a free PDF after every session, but commercial data feeds are expensive and the terms for redistributing BOC data (especially history) are not yet confirmed in writing. The BOC layout changed in 2026, so older bulletins need a different parser.

## Decision

- The **BOC is the primary data source**. Prices are first seeded by hand from real bulletins, then ingested daily by parsing the BOC PDF; the original PDF is stored with a checksum.
- Every price carries its provenance (source document, publication date, status) and is shown with an "as of <date>" label. Doni never calls a price live.
- Ingested days pass automatic checks; a day that fails is stored as `pending_review` and is never shown until an admin publishes it.
- Prices are read only through a `PriceSource` abstraction, so a licensed feed can replace BOC parsing without changing consumers.
- **Licence gate:** before public launch, and before any historical (backfilled) data is shown publicly, we must hold the BRVM's written redistribution terms. Backfilled history stays behind a feature flag until then.

## Rejected alternatives

- **Commercial real-time or delayed feed**: cost out of proportion to a free beta, and real-time data is not needed for long-term holders.
- **Scraping the BRVM website**: fragile, less authoritative than the official bulletin, and less clear legally.
- **Crowd-sourced or user-entered prices**: unverifiable.
- **Launching publicly first and sorting out terms later**: risks a takedown of the core data.

## Consequences

- Prices are end-of-day only; the UI always shows the as-of date.
- Two parsers (pre-2026 and 2026 layouts) sit behind the same `PriceSource`.
- Public launch is blocked on a non-engineering task (written BRVM terms).
