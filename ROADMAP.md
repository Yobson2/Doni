# Roadmap

Vocabulary follows `CONTEXT.md`; decisions are in `docs/adr/`.

## MVP (free beta)

Tracked as GitHub issues #1 to #21.

| # | Ticket |
| --- | --- |
| 1 | Record the domain glossary and architecture decisions |
| 2 | Unify workspace, CI and end-to-end test harness |
| 3 | Trim backend infrastructure to Postgres only |
| 4 | Strip the frontend template and set up FR/EN |
| 5 | Secure sign-up, sign-in and sign-out |
| 6 | Deploy to production early |
| 7 | Securities catalogue and company page |
| 8 | Ledger engine and first portfolio |
| 9 | Opening positions |
| 10 | Edit and delete backdated trades |
| 11 | Corporate actions |
| 12 | Dividends |
| 13 | Daily BOC ingestion (current layout) |
| 14 | Historical BOC backfill (pre-2026 layout) |
| 15 | Returns and benchmark comparison |
| 16 | Allocation and EUR display |
| 17 | Watchlist |
| 18 | PWA shell and offline mode |
| 19 | Daily alerts |
| 20 | Guides, SGI directory and legal pages |
| 21 | Account data export and deletion |

## V1 (public launch)

Not yet ticketed. Conditions for leaving the beta:

- Written BRVM redistribution terms obtained, so backfilled history can be shown publicly (licence gate, ADR-0003).
- Monetisation decided in light of beta usage and the licence terms (ADR-0014).

## Later (explicitly deferred)

Out of MVP scope; not to be built without a new decision:

- Bonds (only listed shares in the MVP)
- Screener
- Technical analysis
- AI features (insights, commentary, assistants); see ADR-0002 before reopening
- Quizzes
- Virtual portfolio
- CSV import of trades
