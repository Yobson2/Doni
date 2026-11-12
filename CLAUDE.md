# Doni

BRVM investment research and portfolio-tracking PWA. `doni-backend/` (NestJS + Postgres) and `doni-frontend/` (React + Vite).

## Commands

One pnpm workspace; run from the repo root: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (backend, needs a disposable Postgres: see `doni-backend/README.md`). CI (`.github/workflows/ci.yml`) runs the same commands. Schema changes go through migrations (`pnpm --filter doni-backend migration:generate`); `synchronize` is off.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Yobson2/Doni` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
