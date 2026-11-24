# Deployment

> [!IMPORTANT]
> Doni has **no production deployment yet**: [issue #6](https://github.com/Yobson2/Doni/issues/6) is open. This page describes the target setup chosen in [ADR 0013](adr/0013-eu-hosting-with-pitr.md) and what the repository provides for it.

## Target setup

| Component | Where | Repository support |
| --- | --- | --- |
| Frontend (static PWA) | Vercel | `doni-frontend/vercel.json` (SPA rewrites, Vite output) |
| Backend (NestJS) | One managed container | `doni-backend/Dockerfile` (multi-stage, non-root, port 3000) |
| Database | Managed PostgreSQL 16, **EU region**, daily backups + **point-in-time recovery** | TLS options in `DB_*` variables |
| Email | Any SMTP provider | `MAIL_*` variables |

Run **one backend instance**: rate-limit counters are held in process memory ([ADR 0009](adr/0009-postgres-only-infrastructure-pg-boss.md)). pg-boss creates its own `pgboss` schema in the same database on start-up; no other service (Redis, queue, object storage) is needed.

ADR 0013 also requires, before relying on backups, a rehearsed **restore drill** into a scratch database, plus **error tracking and uptime monitoring** from the first deploy. Neither is set up in the repository yet.

## Backend

### Environment

Set the variables from [`doni-backend/.env.example`](../doni-backend/.env.example) in the host's environment (the full list is in the [README](../README.md#environment-variables)). In production at least:

```dotenv
NODE_ENV=production
PORT=3000
RUNNING_IN_DOCKER=true            # read variables from the environment, not a .env file
CORS_ORIGINS=https://app.example.com

DB_HOST=…  DB_PORT=5432  DB_USER=…  DB_PASS=…  DB_NAME=…
DB_SSL_REJECT_UNAUTHORIZED=true   # with DB_CA_CERT if the provider requires its CA
JWT_ACCESS_SECRET=…               # two different random values
JWT_REFRESH_SECRET=…

MAIL_HOST=…  MAIL_PORT=…  MAIL_USER=…  MAIL_PASS=…  MAIL_FROM="Doni <noreply@example.com>"
APP_NAME=Doni
HISTORY_PUBLIC=false              # until the BRVM licence gate is cleared (ADR 0003, 0018)
```

### Docker image

Both Dockerfiles build from the **repository root**, so the image installs exactly the versions in the workspace lockfile (`pnpm install --frozen-lockfile`). The root [`.dockerignore`](../.dockerignore) keeps `node_modules`, builds, `.env` files and other local files out of the context.

```bash
docker build -f doni-backend/Dockerfile -t doni-backend .
docker run -p 3000:3000 --env-file doni-backend/.env doni-backend
```

With `NODE_ENV` set to `production` (or `staging`), the database connection always uses TLS, so the database must accept TLS connections. `DB_SSL_REJECT_UNAUTHORIZED` and `DB_CA_CERT` control how its certificate is checked.

The image runs as a non-root user, contains only production dependencies, and already sets `NODE_ENV=production` and `RUNNING_IN_DOCKER=true`. When building on a hosting platform, set the build context to the repository root and the Dockerfile path to `doni-backend/Dockerfile`.

### Migrations

The schema is created only by migrations (`synchronize` is off). Run them on every deploy, **before** the new version starts, from a checkout with dev dependencies installed (for example a CI step) and pointed at the production database:

```bash
pnpm install --frozen-lockfile
DB_HOST=… DB_PORT=… DB_USER=… DB_PASS=… DB_NAME=… \
  pnpm --filter doni-backend migration:run
```

The production image prunes dev dependencies, so it cannot run `migration:run` (which uses `ts-node`) by itself.

### Seed data

A fresh database has an empty catalogue. `pnpm --filter doni-backend seed:catalogue` adds the 5 seed securities and 2 indices with three sessions of real BOC prices; it only adds what is missing. The daily ingestion then keeps prices current, and admins manage the catalogue in the app.

### Health check

`GET /health` returns `200` when the database and the job runner are up and `503` otherwise. Use it as the container's health and readiness probe.

### First admin

Accounts are created through sign-up only, with the default role. Promote the first administrator directly in the database:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Admins receive the emails about held BOC days.

## Frontend

### Vercel

1. Import the repository and set the project's **Root Directory** to `doni-frontend`.
2. `vercel.json` already sets the build (`pnpm run build`), the output (`dist`) and the rewrite of every route to `index.html`.
3. If the API is on another origin, set `VITE_API_URL` (for example `https://api.example.com`). It is read **at build time**.

### Same-site requirement for the session cookie

The refresh cookie is `SameSite=Strict` and scoped to `/api/auth`. The browser only sends it when the app and the API are on the **same site** (the same registrable domain). Two layouts work:

- **Subdomains of one domain:** `app.example.com` and `api.example.com`. Set `VITE_API_URL=https://api.example.com` on the frontend and `CORS_ORIGINS=https://app.example.com` on the backend. The API client sends credentials (`credentials: 'include'`) and CORS allows them.
- **Same origin:** serve `/api` from the frontend's domain through a reverse proxy, and leave `VITE_API_URL` empty. This is how local development works (the Vite dev server proxies `/api`).

An app on `*.vercel.app` calling an API on an unrelated domain would lose its session on every reload.

### Static hosting elsewhere

`pnpm --filter doni-frontend build` produces a static site in `doni-frontend/dist/`. Any static host works if it falls back to `index.html` for unknown paths and serves `sw.js` and `index.html` without long-lived caching.

### Docker (nginx)

`doni-frontend/Dockerfile` builds the app and serves it with nginx (`doni-frontend/nginx.conf`: SPA fallback, one-year cache on hashed `/assets`). Build from the repository root; `VITE_API_URL` is a build argument because Vite reads it at build time:

```bash
docker build -f doni-frontend/Dockerfile \
  --build-arg VITE_API_URL=https://api.example.com -t doni-frontend .
docker run -p 8080:80 doni-frontend
```

### Production build checks

CI checks every build against the PWA requirements; run them locally before a release:

```bash
cd doni-frontend
pnpm build
pnpm size           # first-load JS under 200 KB gzipped
pnpm test:browser   # offline behaviour (Playwright)
pnpm lighthouse     # installability
```

## Scheduled work in production

| Job | Schedule | Notes |
| --- | --- | --- |
| BOC ingestion | `30 18,21 * * 1-5`, Africa/Abidjan | Override with `BOC_INGESTION_CRON`, or `off` |
| Refresh-token cleanup | `17 3 * * *` (daily) | Deletes expired sessions |
| Heartbeat | `* * * * *` (every minute) | Shows the job runner is alive |

Historical backfill is a one-off, manual command, never scheduled. See the [backend README](../doni-backend/README.md#historical-boc-backfill-adr-0018).
