import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { getEnvironmentConfig } from '@common/config/environment.loader';
import { buildDbConfig } from '@common/database/database.config';
import { getJWTSecret, JWT_EXPIRES_IN } from '@common/config/auth.config';
import { RedisModule } from '@common/redis/redis.module';
import { FirebaseModule } from '@common/firebase/firebase.module';
import { MailModule } from '@common/mail/mail.module';
import { StorageModule } from '@common/storage/storage.module';
import { WebSocketsModule } from '@common/websockets/websockets.module';
import { QueuesModule } from '@common/queues/queues.module';
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
    RedisModule,
    FirebaseModule,
    MailModule,
    StorageModule,
    WebSocketsModule,
    QueuesModule,

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
