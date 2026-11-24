# Contributing to Doni

Thanks for your interest. This guide covers how work is organised and what a change needs before it can be merged. To set up a local environment, see [Getting started](README.md#getting-started) in the README.

## Before you start

- **Read [`CONTEXT.md`](CONTEXT.md).** It is the project's glossary. Use its terms in code, UI copy, issues and commits (*ledger entry*, not "transaction"; *security*, not "stock"; *PMP*, not "average cost"). Each term lists the words to avoid.
- **Check the [ADRs](docs/adr/).** Many choices that look arbitrary were made deliberately: the append-only ledger, money as decimal strings, read-only offline mode, Postgres as the only infrastructure, the information-only stance. To change one of them, write a new ADR instead of working around the old one.
- **Check [`ROADMAP.md`](ROADMAP.md).** Features listed under *Later* (screener, technical analysis, AI features, bonds…) are out of scope without a new decision.

## Issues

Work is tracked in [GitHub Issues](https://github.com/Yobson2/Doni/issues). Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` ([details](docs/agents/triage-labels.md)).

## Workflow

1. Branch from `main`, named after the issue: `issue-<number>-<short-slug>` (for example `issue-17-watchlist`), or `fix/<slug>` and `docs/<slug>` for smaller changes.
2. Write commits in the [Conventional Commits](https://www.conventionalcommits.org/) style used in the history, scoped where useful:
   `feat(frontend): …`, `fix(backend): …`, `feat(boc): …`, `test(boc): …`, `chore(api): …`, `docs: …`.
3. Open a pull request against `main` that references its issue. CI must pass.

## Checks

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the commands below. Run them from the repository root before pushing:

```bash
pnpm lint
pnpm typecheck
pnpm --filter doni-frontend knip     # unused files, exports, dependencies
pnpm test
pnpm build
pnpm --filter doni-frontend size     # JS budget, after build
DB_PORT=55432 pnpm test:e2e          # backend e2e, needs a disposable Postgres (see README › Testing)
```

Frontend changes that touch the service worker, caching or the app shell should also pass `pnpm test:browser` and `pnpm lighthouse` in `doni-frontend` (after `pnpm build`).

## Conventions

### Backend

- **Schema changes go through migrations.** Change the entity, run `pnpm --filter doni-backend migration:generate`, rename the generated file to describe the change, review the SQL and commit it. `synchronize` is off everywhere.
- **Money is never a JS number.** Use `big.js` (see `src/modules/ledger/engine/decimal.ts`), Postgres `numeric`, and decimal strings in the API.
- **The ledger is append-only.** Never update or delete a ledger entry; record a void and, for an edit, a replacement.
- **Read prices through `PriceSource` only**, so the publication status and the licence gate apply everywhere.
- **Keep the API contract in sync.** After changing a controller or DTO, run `pnpm --filter doni-backend openapi:emit` and then `pnpm --filter doni-frontend api:generate`, and commit both `openapi.json` and `src/api/schema.d.ts`. An e2e test fails if `openapi.json` is stale.
- **Account data.** A module that stores user data registers it in the `user-data` registry so that export and deletion cover it ([ADR 0016](docs/adr/0016-account-export-and-deletion.md)).

### Frontend

- **Every visible string goes through i18next**, with keys in both `src/i18n/fr.json` (default) and `src/i18n/en.json`. ESLint enforces it.
- **Writes are online-only.** Use `OnlineButton` for any action that calls the API, so it is disabled with an explanation while offline.
- **Show the date of every price** ("as of …"). Doni has end-of-day data, never live prices.
- **No advice.** UI copy describes; it never recommends buying or selling ([ADR 0002](docs/adr/0002-information-only-regulatory-stance.md)).
- Keep first-load JavaScript under the 200 KB gzipped budget; lazy-load heavy dependencies.

### Tests

- Business rules (ledger replay, returns, corporate actions, BOC checks) get unit tests next to the code (`*.spec.ts`); the ledger replay also has property-based tests with fast-check.
- API behaviour gets e2e tests in `doni-backend/test/` against a real Postgres.
- A BOC parser change needs a real bulletin as a fixture in `doni-backend/test/fixtures/boc/`, with its source URL.
