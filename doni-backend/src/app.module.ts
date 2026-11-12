import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { getEnvironmentConfig } from '@common/config/environment.loader';
import { buildDbConfig } from '@common/database/database.config';
import { getJWTSecret, JWT_EXPIRES_IN } from '@common/config/auth.config';
import { MailModule } from '@common/mail/mail.module';
import { JobsModule } from '@common/jobs/jobs.module';
import { AuthenticationMiddleware } from '@common/middleware/authentication.middleware';
import { AuthGuard } from '@common/guards/auth.guard';

import { UsersModule } from '@modules/users/users.module';
import { AuthModule } from '@modules/auth/auth.module';
import { HealthModule } from '@modules/health/health.module';

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

    // ─── JWT (Global) ───────────────────────────────────────
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getJWTSecret(config),
        signOptions: { expiresIn: JWT_EXPIRES_IN },
      }),
    }),

    // ─── Infrastructure ─────────────────────────────────────
    MailModule,
    JobsModule,

    // ─── Feature Modules ────────────────────────────────────
    UsersModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthenticationMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
