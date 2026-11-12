import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { getEnvironmentConfig } from '@common/config/environment.loader';
import { buildDbConfig } from '@common/database/database.config';
import { MailModule } from '@common/mail/mail.module';
import { JobsModule } from '@common/jobs/jobs.module';

import { UsersModule } from '@modules/users/users.module';
import { AuthModule } from '@modules/auth/auth.module';
import { HealthModule } from '@modules/health/health.module';
import { SecuritiesModule } from '@modules/securities/securities.module';

@Module({
  imports: [
    // ─── Configuration ──────────────────────────────────────
    ConfigModule.forRoot(getEnvironmentConfig()),

    // ─── Rate Limiting ──────────────────────────────────────
    // Counters live in process memory (the throttler's default storage):
    // right for a single backend instance. Running several instances needs a
    // shared store first (ADR 0009).
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,
      },
    ]),

    // ─── Database ───────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildDbConfig(config),
    }),

    // ─── Infrastructure ─────────────────────────────────────
    MailModule,
    JobsModule,

    // ─── Feature Modules ────────────────────────────────────
    UsersModule,
    AuthModule,
    HealthModule,
    SecuritiesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
// Authentication and role checks are global guards registered by AuthModule.
export class AppModule {}
