# API reference

The Doni backend is a JSON REST API served under `/api`, plus `GET /health`.

- **Interactive docs:** with the backend running, Swagger UI is at `http://localhost:3000/api/docs`.
- **Contract:** [`doni-backend/openapi.json`](../doni-backend/openapi.json) is the source of truth for request and response shapes. Regenerate it with `pnpm --filter doni-backend openapi:emit`; an e2e test fails if the committed file is stale. The frontend generates its types from it (`pnpm --filter doni-frontend api:generate`).

This page is a map of the endpoints and of the conventions shared by all of them. For field-level details, use the OpenAPI file.

## Conventions

| Topic | Rule |
| --- | --- |
| Money | Decimal **strings** in XOF (`"370845"`, `"3850.25"`), never JSON numbers, to avoid floating-point rounding ([ADR 0005](adr/0005-numeric-money-and-decimal-library.md)) |
| Quantities | Strings holding whole numbers of shares |
| Dates | `YYYY-MM-DD` for trading and trade dates; ISO 8601 date-times for timestamps |
| Identifiers | Securities by `ticker` (e.g. `SNTS`), indices and sectors by `code` (e.g. `BRVM-C`), everything else by UUID |
| Validation | Unknown body fields are rejected (`400`) |

## Authentication

| | Access token | Refresh token |
| --- | --- | --- |
| Format | JWT, `typ: access` | JWT, `typ: refresh` |
| Lifetime | 15 minutes | 30 days, rotated on every use |
| Transport | `Authorization: Bearer <token>` | `doni_refresh` cookie: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` |
| Stored | Client memory only | Hashed in `refresh_tokens` |

Presenting a refresh token that has already been rotated revokes the whole session ([ADR 0011](adr/0011-auth-session-model.md)). Every endpoint requires an access token unless marked **Public** below.

**Access** column: **Public** = no token · **User** = any signed-in user · **Owner** = signed-in user who owns the portfolio · **Admin** = `ADMIN` role. Missing or invalid token → `401`; signed in without the required role → `403`.

## Endpoints

### Health

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Database and job-runner status; `503` if either is down |

### Auth: `/api/auth`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/sign-up` | Public | Create an account (email, password 8–72 chars, optional names); signs in |
| `POST` | `/api/auth/sign-in` | Public | Sign in; returns an access token and sets the refresh cookie |
| `POST` | `/api/auth/refresh` | Refresh cookie | Rotate the refresh token, get a new access token |
| `POST` | `/api/auth/sign-out` | Refresh cookie | End the session and clear the cookie |

### Users: `/api/users`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users/me` | User | Read my account |
| `PATCH` | `/api/users/me` | User | Update my first/last name and display currency (`XOF` or `EUR`) |
| `GET` | `/api/users` | Admin | List accounts (paginated) |
| `GET` | `/api/users/{id}` | Admin | Read an account |
| `PATCH` | `/api/users/{id}` | Admin | Update an account |
| `DELETE` | `/api/users/{id}` | Admin | Deactivate an account |

### Catalogue: securities, sectors, indices

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/securities` | User | Securities with their latest end-of-day price |
| `GET` | `/api/securities/{ticker}` | User | One security |
| `GET` | `/api/securities/{ticker}/prices` | User | Price history, oldest first, restated for corporate actions |
| `POST` | `/api/securities` | Admin | Add a security |
| `PATCH` | `/api/securities/{ticker}` | Admin | Edit a security |
| `PUT` | `/api/securities/{ticker}/prices/{date}` | Admin | Enter or correct one day's price from a BOC |
| `GET` | `/api/sectors` | User | List sectors |
| `POST` | `/api/sectors` | Admin | Add a sector |
| `PATCH` | `/api/sectors/{code}` | Admin | Rename a sector |
| `GET` | `/api/indices` | User | List indices |
| `GET` | `/api/indices/{code}/prices` | User | Index value history, oldest first |
| `POST` | `/api/indices` | Admin | Add an index |
| `PUT` | `/api/indices/{code}/prices/{date}` | Admin | Enter or correct one day's index value from a BOC |

### Corporate actions and declared dividends

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/securities/{ticker}/corporate-actions` | User | Corporate actions on a security, oldest first |
| `POST` | `/api/securities/{ticker}/corporate-actions` | Admin | Enter one from its BRVM notice (`split`, `reverse_split`, `free_shares`, `rights_issue`) |
| `PUT` | `/api/securities/{ticker}/corporate-actions/{id}` | Admin | Correct one |
| `DELETE` | `/api/securities/{ticker}/corporate-actions/{id}` | Admin | Remove one entered by mistake |
| `GET` | `/api/securities/{ticker}/dividends` | User | Declared (reference) dividends, by ex-date |
| `POST` | `/api/securities/{ticker}/dividends` | Admin | Enter a declared dividend from its notice |
| `PUT` | `/api/securities/{ticker}/dividends/{id}` | Admin | Correct it; suggestions follow, confirmed user dividends keep their amounts |

### Bulletins (BOC review): `/api/bulletins`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/bulletins` | Admin | Ingested BOCs, newest first; `?status=pending_review` for held days |
| `GET` | `/api/bulletins/{date}` | Admin | One day: rows read and failed checks |
| `GET` | `/api/bulletins/{date}/document` | Admin | The original BOC PDF |
| `POST` | `/api/bulletins/{date}/ingest` | Admin | Fetch and ingest that day's BOC now (same as the daily job) |
| `PATCH` | `/api/bulletins/{date}` | Admin | Correct misread values of a held day; checks run again |
| `POST` | `/api/bulletins/{date}/publish` | Admin | Publish a held day |

### Portfolios: `/api/portfolios`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/portfolios` | User | My portfolios |
| `POST` | `/api/portfolios` | User | Create a portfolio |
| `GET` | `/api/portfolios/{id}/valuation` | Owner | Positions, PMP, realised/unrealised gains, totals and allocation at the latest prices |
| `GET` | `/api/portfolios/{id}/returns?period=` | Owner | XIRR and TWR vs. the BRVM Composite; `period` is `1M`, `3M`, `YTD`, `1Y` or `ALL`; lists data gaps |
| `GET` | `/api/portfolios/{id}/entries` | Owner | Ledger entries, oldest trade first |
| `POST` | `/api/portfolios/{id}/entries` | Owner | Record a `buy` or `sell` with fees and SGI |
| `PUT` | `/api/portfolios/{id}/entries/{entryId}` | Owner | Correct a buy or sell, however old (a new entry replaces it) |
| `DELETE` | `/api/portfolios/{id}/entries/{entryId}` | Owner | Delete a ledger entry of any kind (it is voided, not erased) |
| `POST` | `/api/portfolios/{id}/opening-positions` | Owner | Record an opening position (quantity and PMP as of a date) |
| `PUT` | `/api/portfolios/{id}/opening-positions/{entryId}` | Owner | Correct an opening position |
| `GET` | `/api/portfolios/{id}/dividends` | Owner | Dividend calendar: `upcoming`, `awaiting_payment`, `suggested`, `confirmed` or `dismissed` |
| `POST` | `/api/portfolios/{id}/dividends/{referenceDividendId}/confirmation` | Owner | Confirm the net amount received (recorded as a user dividend) |
| `PUT` | `/api/portfolios/{id}/dividends/{referenceDividendId}/dismissal` | Owner | Dismiss a suggestion |
| `DELETE` | `/api/portfolios/{id}/dividends/{referenceDividendId}/dismissal` | Owner | Undo a dismissal |

Corrections that would sell more shares than held at any date are refused.

### Watchlist: `/api/watchlist`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/watchlist` | User | Watched securities with their latest price and its date |
| `PUT` | `/api/watchlist/{ticker}` | User | Watch a security (idempotent) |
| `DELETE` | `/api/watchlist/{ticker}` | User | Stop watching (idempotent) |

### Account: `/api/account`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/account/export` | User | Download all my data as JSON |
| `POST` | `/api/account/deletion` | User | Delete my account and all my data; requires the current password, ends every session, cannot be undone |

## Errors

Every error uses the same envelope:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "…",
  "errors": [{ "message": "…", "code": "…" }],
  "timestamp": "2026-11-24T17:24:10.234Z",
  "path": "/api/portfolios"
}
```

Outside production the response also includes the stack trace. Domain error codes are defined in `doni-backend/src/common/constants/error-codes.ts` and `src/common/exceptions/`.

## Rate limits

Applied globally per client by `@nestjs/throttler`, with counters held in process memory (single instance):

| Window | Limit |
| --- | --- |
| 1 second | 10 requests |
| 1 minute | 100 requests |
| 1 hour | 1,000 requests |

`POST /api/account/deletion` is limited to 5 attempts per minute, since each one checks the password. Exceeding a limit returns `429`.
