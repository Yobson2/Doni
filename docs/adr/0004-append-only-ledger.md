# Append-only ledger as the single source of truth

## Context

A portfolio's state (positions, PMP, realised gains, returns) depends on every buy, sell, opening position, user dividend and corporate action in date order. Users enter trades late, backdate them, and correct mistakes from years ago. Corporate actions can land between existing entries. Storing positions as mutable rows makes these cases error-prone and hard to audit.

## Decision

Each portfolio has an **append-only ledger of ledger entries**, which is the single source of truth. Positions, PMP and gains are never stored as authoritative state: they are **derived by replaying the ledger** together with corporate actions and end-of-day prices. The replay lives in a pure ledger engine (inputs in, positions out, no I/O). Ledger entries are never overwritten: when a user edits or deletes a past trade, the change is recorded as new entries that supersede or void the earlier one, and the portfolio is recomputed. An entry that would make a position negative at any date is rejected.

## Rejected alternatives

- **Mutable position table updated in place**: backdated trades and corporate actions require hand-written fix-ups and drift from the trade history.
- **Mutable trade list (update/delete rows in place)**: simpler, but loses the audit trail of what the user changed and when.
- **Full event sourcing with an event store and projections**: more machinery than one engine replaying a small per-user ledger needs.

## Consequences

- The engine can be tested exhaustively with hand-computed cases and property tests (deterministic replay, order independence within a date, never negative).
- Replay cost grows with ledger size; caching derived positions is allowed as long as it is rebuildable from the ledger.
- Data export can include the full ledger history.
- Entries on the same date replay in a fixed order, whatever order they were recorded in: opening positions first (an opening position states the holding at the start of its day), then buys, then sells.
