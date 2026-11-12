import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

interface TestAppOptions {
  /**
   * Keep the per-client rate limits on (default). Suites that fire many
   * requests in a row from one client turn them off; the rate-limit suite
   * keeps them.
   */
  rateLimit?: boolean;
}

/** Boots the full AppModule against the test database, Postgres only. */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.rateLimit === false) {
    builder = builder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true });
  }
  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
