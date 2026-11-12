# Account export and deletion: password re-entry, cascading deletion, export sections per module

## Context

Users control their personal financial data: they can download all of it and delete their account. Deleting is irreversible and destroys the ledger, the single source of truth (ADR 0004), so it must be confirmed by the account holder, not just by whoever holds an unlocked device with a live session. ADR 0011 gives no way to prove a recent sign-in: the access token says who the user is, not when they last entered their password. Data is spread over several modules (account, sessions, portfolios and ledgers, watchlist, and later alert settings), and new modules keep adding tables that hold user data.

## Decision

- **Re-authentication is password re-entry on the request itself.** Deleting the account sends the current password in the request body; the server checks it before doing anything. A wrong password answers 403 (the session is valid, the confirmation is not) and the attempts are rate-limited. There is no separate "re-authenticate" step, token or time window to manage. Any later sensitive action (changing the email or password) uses the same pattern.
- **Deletion is a hard delete of the user row**; every table holding the user's data references it, directly or through its parent (ledger entries through their portfolio), with `ON DELETE CASCADE`. Sessions (refresh tokens) are deleted with it. The ledger's append-only trigger rejects only `UPDATE`, so cascading deletes are allowed.
- **Access tokens are checked against the account on every request**: the token must belong to an account that still exists and is active. A deleted or deactivated account's access tokens stop working at once, instead of up to 15 minutes later. This adds one primary-key lookup per authenticated request; the role still comes from the token.
- **The export is assembled from sections that modules register** with a `UserDataRegistry` at startup (`account`, `sessions`, `portfolios` with their ledgers, `watchlist`). The export endpoint never changes when a module is added. User dividends are ledger entries, so they appear in each portfolio's ledger; alert settings will be their own section. The export is one JSON document, read in a single transaction, served as a file download; secrets (password hash, token hashes) are never included.
- **A coverage check keeps export and deletion complete**: a test reads the ORM metadata, finds every table linked to `users` directly or transitively, and fails if one is not exported by a registered section or its link does not cascade.

## Rejected alternatives

- **A short-lived re-authentication token** (password exchanged for a proof, sent with the sensitive request): one more token kind, secret and expiry for a single action; the password in the request proves the same thing more directly.
- **A recent-sign-in claim (`auth_time`) with a time window**: forces a full sign-out/sign-in round trip in the UI and still accepts anyone holding the device within the window.
- **Soft delete (deactivate and keep the rows)**: does not remove personal data, which is what the user asked for.
- **An export service that queries every module's tables itself**: has to be edited for every new module and silently misses the ones it is not told about.

## Consequences

- Deleted accounts are gone from the live database at once; they remain in backups until those expire under the point-in-time-recovery retention (ADR 0013). The privacy policy states this.
- A future table holding user data must register an export section and cascade from its parent, or the coverage test fails. A table that cannot cascade (for example one whose rows reference each other with `RESTRICT`) needs its own removal step before the user row is deleted.
- Every authenticated request reads the user row once.
