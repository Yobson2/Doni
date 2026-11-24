# Historical backfill: same checks, own layouts, hidden behind a licence-gate flag

## Context

Charts and benchmark comparison need price and index history back to about 2015. The BRVM's public website keeps past BOCs, but in layouts that changed several times (and once in an English edition), and the BRVM's redistribution terms may cover only current data: ADR 0003 makes BOC data a licence-gated source. History must be loadable now, checked like any other day, and shown to users only once the terms allow it.

## Decision

- **One parser per layout, chosen by what the bulletin prints, never by its date.** `BocDocumentParser` detects the layout (2026, compartment-2023, sector-2018, sector-2016) and reads it; a bulletin in no known layout is refused with a readable reason, so its day is held like any unreadable bulletin. Fixtures are real bulletins from each layout (`doni-backend/test/fixtures/boc/README.md`).
- **The backfill goes through the daily ingestion service and the same automatic checks.** Only two things differ: a historical bulletin must list the catalogued securities and indices *already priced on an earlier day* (not today's whole catalogue, which includes later listings), and held days send no email each but one summary at the end. It never overwrites a published day nor a day the daily ingestion stored, and can be stopped and run again.
- **Securities no longer in the catalogue** (delistings, renamings) are read and checked but not stored, and counted in the backfill report. No inactive catalogue entries are created: they would add companies Doni does not describe, for history nobody holds.
- **Indices that changed keep separate codes.** BRVM 10 (replaced by BRVM 30 in 2023, another composition) is `BRVM-10`, not joined onto `BRVM-30`. The sector indices printed until 2025 are other series than the 2026 sector indices and get their own codes (`BRVM-INDUSTRIE`, `BRVM-SERVICES-PUBLICS`, ...); the new sector indices printed in 2025 as "NOUVEAUX" take the 2026 codes. Only indices in the catalogue are stored.
- **Bulletins record their origin** (`daily` or `backfill`). **`HISTORY_PUBLIC`** (default `false`) is read by `DatabasePriceSource`: while off, prices from backfilled bulletins are never served, so every PriceSource consumer (catalogue, company page, indices, valuation, returns and benchmark, watchlist) hides them with no change of its own. Admins still review backfilled bulletins. Turning the flag on needs no data change.

## Rejected alternatives

- **Choosing the parser by date ranges**: the BRVM changed layouts mid-year and published an English edition at least once; a date table would silently misread such a day.
- **A separate backfill pipeline with relaxed checks**: two ways to accept a price would drift; a held historical day is reviewed exactly like a held daily one.
- **Not storing history until the licence is cleared**: the download, checks and review take weeks of polite requests and admin time; doing them now makes clearing the gate a configuration change.
- **Filtering backfilled data in each endpoint**: one forgotten consumer (e.g. returns) would leak history; the PriceSource is the single read path (ADR 0003).

## Consequences

- Bulletins before mid-2016 are not on brvm.org: history starts there unless older bulletins are found elsewhere.
- The flag is read at start-up: changing it takes a restart.
- A held backfill day waits in the same admin review queue as daily ones; the report groups them by reason.
