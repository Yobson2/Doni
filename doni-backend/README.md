# NestJS Monolithic Template

A production-ready NestJS monolithic starter template with battle-tested infrastructure patterns.

## Tech Stack

- **NestJS 11** — TypeScript framework
- **TypeORM + PostgreSQL 16** — Database ORM; the schema is created by migrations only (`synchronize` is off everywhere)
- **pg-boss** — Background and scheduled jobs, stored in Postgres
- **JWT** — Authentication with access + refresh tokens
- **Nodemailer + Handlebars** — Email templating
- **Swagger** — Auto-generated API documentation
- **Docker** — PostgreSQL (the only infrastructure dependency) + Mailpit for local email

## Quick Start

This app is part of the root pnpm workspace. Install from the repo root:

```bash
# 1. Install dependencies (from the repo root)
pnpm install

# 2. Create environment file (in doni-backend/)
cp .env.example .env

# 3. Start infrastructure (PostgreSQL, plus Mailpit to catch emails)
docker compose up -d

# 4. Create the schema, then add the seed securities and their BOC prices
pnpm migration:run
pnpm seed:catalogue

# 5. Start the application
pnpm start:dev

# 6. Open Swagger docs
open http://localhost:3000/api/docs
```

## Project Structure

```
src/
├── main.ts                        # Bootstrap (Helmet, CORS, Swagger, Validation)
├── app.module.ts                  # Root module
├── common/                        # Shared infrastructure
│   ├── config/                    # Environment loader (Docker-aware)
│   ├── database/                  # TypeORM config, BaseEntity
│   ├── jobs/                      # Job runner (pg-boss) + sample heartbeat job
│   ├── mail/                      # Email with Handlebars templates
│   ├── constants/                 # Error codes, roles
│   ├── decorators/                # @GetUserId, @Roles, @Public
│   ├── dto/                       # Pagination DTOs
│   ├── exceptions/                # Domain exceptions
│   ├── filters/                   # Global exception filter
│   ├── guards/                    # Access-token guard (401), Roles guard (403)
│   └── utils/                     # Error context utility
├── modules/
│   ├── auth/                      # Sign-up, sign-in, refresh, sign-out (ADR 0011)
│   ├── users/                     # Own account (/me) and account administration
│   ├── securities/                # Catalogue, end-of-day prices, PriceSource (ADR 0003)
│   └── health/                    # Health check (database + job runner)
templates/                         # Handlebars email templates
```

## Available Scripts

```bash
pnpm start:dev           # Development with hot-reload
pnpm build               # Compile TypeScript
pnpm start:prod          # Run compiled app
pnpm test                # Unit tests
pnpm test:watch          # Tests in watch mode
pnpm test:cov            # Test coverage
pnpm test:e2e            # End-to-end tests (needs Postgres, see below)
pnpm lint                # ESLint (check only)
pnpm lint:fix            # ESLint with autofix
pnpm typecheck           # TypeScript, no emit
pnpm format              # Prettier
pnpm migration:run       # Apply pending migrations
pnpm migration:revert    # Revert the last migration
pnpm migration:generate  # Generate a migration from entity changes
pnpm seed:catalogue      # Add seed securities and real BOC prices (only what is missing)
pnpm backfill:boc --from YYYY-MM-DD --to YYYY-MM-DD  # Historical BOC backfill (see below)
```

## Background and scheduled jobs

Jobs run on [pg-boss](https://github.com/timgit/pg-boss), which keeps its
queue in the application database (schema `pgboss`, created and upgraded by
pg-boss itself on startup). `JobsService` starts and stops with the app; to
add a scheduled job, call `jobs.schedule(name, cron, handler)` from a
provider's `onApplicationBootstrap` (see `src/common/jobs/heartbeat.job.ts`).

### Daily BOC ingestion

`BocIngestionJob` (`src/modules/securities/boc/`) runs on weekdays at 18:30
and 21:30, Abidjan time. For the day's session it downloads the BOC from
brvm.org (link found on the bulletins listing page, falling back to
`boc_YYYYMMDD_2.pdf` / `boc_YYYYMMDD.pdf`), stores the original PDF and its
SHA-256 in `boc_bulletins`, reads it (`BocDocumentParser`, which detects the
layout and reads 2026 bulletins with `boc-parser.ts` and the 2016 to 2025
layouts with `boc-legacy-parser.ts`; an unknown layout holds the day) and runs the
automatic checks (`boc-checks.ts`). If every check passes the day's prices are
published; otherwise the day is held as `pending_review`, never served, and
every active admin is emailed the reasons (Mailpit locally). Admins review
held days at `/admin/bulletins` (API: `/api/bulletins`). Re-running a day with
the same PDF changes nothing; a new PDF replaces a held day; a published day is
never overwritten by ingestion. When a day is published, `boc.day-published`
is emitted (`@nestjs/event-emitter`) for anything that reacts to new prices.

### Historical BOC backfill (ADR 0018)

A one-time command loads price and index history from past BOCs, through the
same ingestion service and automatic checks:

```bash
pnpm --filter doni-backend backfill:boc --from 2016-01-01 --to 2025-12-31 --report ../docs/backfill-report.md [--pause-ms 2000] [--retry-held]
```

It walks every weekday, downloads `boc_YYYYMMDD.pdf` / `boc_YYYYMMDD_2.pdf`
from brvm.org with a pause before each request (at most two per day, about
30 minutes per year at the default pause), and writes a report (days imported,
held by reason, not found, securities not in the catalogue). It can be stopped
and run again: a stored day is not downloaded again (a held one only with
`--retry-held`), a published day or a day stored by the daily ingestion is
never touched. Held days send no email each; admins get one summary at the end
and review them like any held day. In the backfill, a bulletin must list only
the catalogued securities and indices already priced on an earlier day (a
security listed later is not missing from an older bulletin). Securities no
longer in the catalogue (delisted, renamed) are read but not stored, and
counted in the report. Bulletins before mid-2016 are not on brvm.org.

Backfilled bulletins have `origin = 'backfill'`. **Licence gate:** their prices
are served to users only when `HISTORY_PUBLIC=true` (default off), until the
BRVM's redistribution terms cover historical data (ADR 0003). The gate lives in
`DatabasePriceSource`, so the catalogue, company pages, indices, valuation,
returns and benchmark, and watchlist all follow it; admins still see the
bulletins on the review screens.

Rate limiting (`@nestjs/throttler`) keeps its counters in process memory,
which suits a single backend instance (ADR 0009).

## Migrations

The schema is owned by migrations in `src/common/database/migrations/`;
`synchronize` is off in every environment. After changing an entity, run
`pnpm migration:generate`, rename the generated file to describe the change,
review the SQL and commit it.

## End-to-end tests

The e2e suite boots the whole `AppModule` against a real, disposable Postgres
database. Each spec drops that database's schema and rebuilds it by running
every migration, so point it at a database you do not mind losing. It never
reads `.env`; configure it with environment variables (defaults in
`test/setup-env.ts`: `localhost:5432`, user/password `postgres`, database
`doni_test`). For example:

```bash
docker run -d --name doni-e2e-pg -p 55432:5432   -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=doni_test postgres:16
DB_PORT=55432 pnpm test:e2e
```

The suite needs nothing but Postgres. It also drops the job runner's `pgboss`
schema so pg-boss reinstalls it on boot, and shortens the schedule-check
intervals so the sample scheduled job runs within the test.

## Docker

```bash
docker compose up -d      # Start PostgreSQL + Mailpit
docker compose down        # Stop all
docker compose logs -f     # View logs
```

| Service | URL |
|---------|-----|
| PostgreSQL | `localhost:5432` |
| Mailpit SMTP | `localhost:1025` |
| Mailpit UI | `http://localhost:8025` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check: database and job runner (503 if either is down) |
| `POST` | `/api/auth/sign-up` | No | Create an account (the only way to create one); signs in |
| `POST` | `/api/auth/sign-in` | No | Sign in |
| `POST` | `/api/auth/refresh` | Refresh cookie | Rotate the refresh token, get a new access token |
| `POST` | `/api/auth/sign-out` | Refresh cookie | End the session, clear the cookie |
| `GET` | `/api/users/me` | Yes | Read my account |
| `PATCH` | `/api/users/me` | Yes | Update my account (name only) |
| `GET` | `/api/users` | Admin | List accounts (paginated) |
| `GET` | `/api/users/:id` | Admin | Read an account |
| `PATCH` | `/api/users/:id` | Admin | Update an account |
| `DELETE` | `/api/users/:id` | Admin | Deactivate an account |
| `GET` | `/api/bulletins` | Admin | Ingested BOCs (`?status=pending_review` for held days) |
| `GET` | `/api/bulletins/:date` | Admin | One day's BOC: rows read and failed checks |
| `GET` | `/api/bulletins/:date/document` | Admin | The original BOC PDF |
| `POST` | `/api/bulletins/:date/ingest` | Admin | Fetch and ingest that day's BOC now |
| `PATCH` | `/api/bulletins/:date` | Admin | Correct a held day's values (checks run again) |
| `POST` | `/api/bulletins/:date/publish` | Admin | Publish a held day |

No or invalid access token: `401`. Authenticated without the required role: `403`.

### Sessions (ADR 0011)

- Access token: 15-minute JWT signed with `JWT_ACCESS_SECRET`, `typ: access`,
  sent as `Authorization: Bearer`. The client keeps it in memory only.
- Refresh token: JWT signed with `JWT_REFRESH_SECRET`, `typ: refresh`, sent
  only in the `doni_refresh` cookie (`HttpOnly; Secure; SameSite=Strict;
  Path=/api/auth`). Stored hashed in `refresh_tokens`, rotated on every
  refresh; presenting a rotated token again revokes the whole session.
  Expired tokens are deleted by a daily job.

### OpenAPI

`pnpm openapi:emit` writes `openapi.json` (no database needed). The frontend
generates its client from it (`pnpm api:generate` in `doni-frontend`). An e2e
test fails if the committed file is out of date.

## Adding a New Module

```bash
# 1. Generate the module
nest generate module modules/products
nest generate controller modules/products
nest generate service modules/products

# 2. Create entity extending BaseEntity
# src/modules/products/entities/product.entity.ts

# 3. Register in module with TypeOrmModule.forFeature([Product])

# 4. Import the module in app.module.ts
```

### Entity Pattern

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@common/database/base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: true })
  isActive: boolean;
}
```

### Protecting Routes

```typescript
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/constants/roles.constant';

@Public()           // Skip authentication
@Roles(UserRole.ADMIN)  // Require admin role
```

## Environment Variables

See [.env.example](.env.example) for all available variables.

Key variables:
- `DB_*` — PostgreSQL connection
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — Token signing; both required and distinct (boot fails otherwise)
- `JOBS_*` — Job runner tuning (optional)
- `BOC_*` — Daily BOC ingestion schedule and source URLs (optional)
- `HISTORY_PUBLIC` — `true` to show backfilled price history to users once the licence gate is cleared (default `false`)
- `MAIL_*` — SMTP email

## Production Build

```bash
# Build Docker image
docker build -t my-app .

# Run container
docker run -p 3000:3000 --env-file .env my-app
```

## License

MIT
