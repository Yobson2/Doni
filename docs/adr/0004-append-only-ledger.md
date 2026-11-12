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
- Two opening positions for the same security on the same date contradict each other, and which one wins would depend on the order they were recorded in. The ledger refuses the second one (and any edit that would create such a pair); the user corrects the first instead.
- The engine keeps each holding's exact total cost and divides it by the quantity only when it needs the PMP (for a sale, or the result). The PMP division is the only rounding, so the same entries give the same figures, to the last decimal, in whatever order the entries of a day were recorded. Property tests check this, together with deterministic replay and positions that never go negative.

## Corrections (edit and delete)

Editing or deleting a ledger entry never changes or removes its row. Both record a **correction** in a separate append-only table, `ledger_entry_voids` (the database rejects any UPDATE, as for `ledger_entries`): one row per voided entry, with `replacementId` naming the new entry when the user edited it, and null when they deleted it. The ledger as it stands is every entry that no correction voids; replay only ever sees that.

- An edit is a new ledger entry, with all its values, plus the void of the old one, written in one transaction. An entry is voided at most once (the voided entry is the primary key), and a replacement replaces one entry only.
- A correction is accepted only if the ledger it leaves replays with the corporate actions in effect, exactly as for a new entry: no sale, at any date, may exceed the shares then held. Deleting a buy or an opening position that a later sale needs is refused like an edit that would leave the sale uncovered.
- Only entries that still count can be corrected: an entry already edited or deleted answers "not found", and an edit is a correction of the latest version. Its kind is kept: a buy or sell is edited as a trade (and may switch between buy and sell), an opening position as an opening position.
- `ledger_entries` keeps its triggers and constraints unchanged. A separate table was chosen over a `voided_by` column on the entry so that no ledger row ever changes, not even once, and so that the full history (each entry, what replaced it and when) exports as two plain tables.
