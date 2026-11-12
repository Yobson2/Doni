import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { REFRESH_COOKIE } from '@common/config/auth.config';

/**
 * The API's OpenAPI document, built from the controllers and DTOs. The
 * frontend client and types are generated from it (`pnpm openapi:emit` here,
 * then `pnpm api:generate` in doni-frontend).
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Doni API')
    .setDescription('BRVM investment research and portfolio tracking')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token from sign-in, sign-up or refresh',
      },
      'JWT-auth',
    )
    .addCookieAuth(REFRESH_COOKIE, {
      type: 'apiKey',
      in: 'cookie',
      description: 'httpOnly refresh-token cookie, set by the API',
    })
    .addTag('Auth', 'Sign-up, sign-in, session refresh and sign-out')
    .addTag('Users', 'Own account, and account administration (admin)')
    .addTag('Health', 'Health check')
    .build();

  return SwaggerModule.createDocument(app, config);
}
