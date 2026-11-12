import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/common/redis/redis.provider';

/**
 * In-memory stand-in for the Redis client. The app only needs Redis for the
 * WebSocket pub/sub bridge, which the e2e suite does not exercise, so the e2e
 * suite runs against Postgres alone. Remove together with Redis (#3).
 */
function createRedisStub() {
  const stub = {
    duplicate: () => stub,
    subscribe: (_channel: string, callback?: (err: Error | null) => void) => {
      callback?.(null);
      return Promise.resolve(1);
    },
    on: () => stub,
    publish: () => Promise.resolve(0),
    quit: () => Promise.resolve('OK'),
    disconnect: () => undefined,
  };
  return stub;
}

/** Boots the full AppModule against the test database. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(REDIS_CLIENT)
    .useValue(createRedisStub())
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  return app;
}
