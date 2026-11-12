# Read-only offline mode

## Context

Many users are on mobile with unreliable or expensive connections. Doni is a PWA. Supporting offline writes (recording trades offline and syncing later) would require conflict resolution against an append-only ledger whose validity (no negative positions) depends on the server's view of all entries.

## Decision

Offline mode is **read-only**. After one visit, the last-synced portfolio, end-of-day prices and guides are available offline with their "as of" dates and a clear offline indicator. Write actions are disabled offline with an explanation. A JavaScript budget (under 200 KB gzipped on first load) is enforced in CI.

## Rejected alternatives

- **Offline writes with background sync**: conflict handling and validation against the ledger are complex, and a rejected sync after the fact is confusing.
- **Online-only**: poor experience on the connections our users actually have.
- **Native mobile apps**: more codebases and store overhead for the same read-mostly use.

## Consequences

- The service worker caches read data and guides; there is no client-side write queue.
- Users must be online to record trades or confirm dividends.
