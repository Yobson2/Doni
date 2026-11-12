import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Request handling shared by the running server (`main.ts`) and the e2e
 * suite, so tests exercise the same pipeline as production.
 */
export function configureApp(app: INestApplication): void {
  // Reads the refresh-token cookie on the auth endpoints.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}
