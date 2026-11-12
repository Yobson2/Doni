# NestJS Monolithic Template

A production-ready NestJS monolithic starter template with battle-tested infrastructure patterns.

## Tech Stack

- **NestJS 11** — TypeScript framework
- **TypeORM + PostgreSQL 16** — Database ORM with auto-sync in development, migration CLI for production
- **Redis (ioredis)** — Caching and pub/sub
- **BullMQ** — Background job queues
- **JWT** — Authentication with access + refresh tokens
- **Socket.IO** — WebSocket gateway with Redis bridge
- **S3 Storage** — MinIO (dev) / DigitalOcean Spaces / AWS S3
- **Firebase Admin** — Push notifications
- **Nodemailer + Handlebars** — Email templating
- **Swagger** — Auto-generated API documentation
- **Docker** — PostgreSQL, Redis, MinIO, Adminer

## Quick Start

```bash
# 1. Install dependencies
yarn install

# 2. Create environment file
cp .env.example .env

# 3. Start infrastructure (PostgreSQL, Redis, MinIO)
docker compose up -d

# 4. Start the application
yarn start:dev

# 5. Open Swagger docs
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
│   ├── redis/                     # Redis provider (TLS-aware)
│   ├── storage/                   # S3-compatible storage
│   ├── firebase/                  # Push notifications
│   ├── mail/                      # Email with Handlebars templates
│   ├── websockets/                # WebSocket gateway + Redis bridge
│   ├── queues/                    # BullMQ configuration
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
│   └── health/                    # Health check endpoint
templates/                         # Handlebars email templates
```

## Available Scripts

```bash
yarn start:dev       # Development with hot-reload
yarn build           # Compile TypeScript
yarn start:prod      # Run compiled app
yarn test            # Unit tests
yarn test:watch      # Tests in watch mode
yarn test:cov        # Test coverage
yarn test:e2e        # End-to-end tests
yarn lint            # ESLint
yarn format          # Prettier
```

## Docker

```bash
docker compose up -d      # Start PostgreSQL + Redis + MinIO + Adminer
docker compose down        # Stop all
docker compose logs -f     # View logs
```

| Service | URL |
|---------|-----|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO Console | `http://localhost:9001` |
| Adminer | `http://localhost:8080` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
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
- `REDIS_*` — Redis connection
- `S3_*` — Object storage
- `FIREBASE_*` — Push notifications
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
