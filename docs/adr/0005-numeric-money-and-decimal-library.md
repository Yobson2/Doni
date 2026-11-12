# Money as Postgres numeric and a decimal library

## Context

Doni computes PMP, realised gains, dividend amounts and returns, and users compare them with their SGI statements. JavaScript numbers are binary floating-point, so sums of fees and averages drift by small amounts that show up as wrong cents and broken reference tests.

## Decision

Monetary amounts, prices and quantities are stored as **Postgres `numeric`** and handled in application code with a **decimal library**; floating-point arithmetic is never used for money. Values cross the API as strings and are rounded only for display, with explicit rounding rules.

## Rejected alternatives

- **JavaScript `number` / `float8` columns**: rounding errors in PMP and gains.
- **Integer minor units (e.g. centimes as integers)**: XOF has no minor unit in practice, but PMP and per-share dividends need fractional precision, so a fixed scale would either lose precision or need ad-hoc scaling per field.
- **`bigint` with a per-field scale**: workable but error-prone across divisions (PMP, peg conversion).

## Consequences

- Every engine function takes and returns decimals; tests compare exact values.
- TypeORM column transformers and API types use strings for decimals, and the frontend needs the same decimal library or careful formatting.
