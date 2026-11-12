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

# 4. Create the schema
pnpm migration:run

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
│   ├── decorators/                # @GetUser, @Roles, @Public
│   ├── dto/                       # Pagination DTOs
│   ├── exceptions/                # Domain exceptions
│   ├── filters/                   # Global exception filter
│   ├── guards/                    # Auth guard, Roles guard
│   ├── middleware/                # JWT authentication
│   └── utils/                     # Error context utility
├── modules/
│   ├── auth/                      # JWT auth (register, login, refresh)
│   ├── users/                     # Sample CRUD module
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
```

## Background and scheduled jobs

Jobs run on [pg-boss](https://github.com/timgit/pg-boss), which keeps its
queue in the application database (schema `pgboss`, created and upgraded by
pg-boss itself on startup). `JobsService` starts and stops with the app; to
add a scheduled job, call `jobs.schedule(name, cron, handler)` from a
provider's `onApplicationBootstrap` (see `src/common/jobs/heartbeat.job.ts`).

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
| `POST` | `/api/auth/register` | No | Register user |
| `POST` | `/api/auth/login` | No | Login |
| `POST` | `/api/auth/refresh` | No | Refresh tokens |
| `GET` | `/api/users` | Yes | List users (paginated) |
| `GET` | `/api/users/:id` | Yes | Get user by ID |
| `POST` | `/api/users` | No | Create user |
| `PATCH` | `/api/users/:id` | Yes | Update user |
| `DELETE` | `/api/users/:id` | Admin | Delete user (soft) |

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
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — Token signing
- `JOBS_*` — Job runner tuning (optional)
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
