import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Security: Helmet for HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'https:', 'https://validator.swagger.io'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
          connectSrc: ["'self'", 'https://validator.swagger.io'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',');
  if (!allowedOrigins || allowedOrigins.length === 0) {
    logger.warn(
      'CORS_ORIGINS not configured. Using localhost defaults for development.',
    );
  }

  app.enableCors({
    origin:
      allowedOrigins && allowedOrigins.length > 0
        ? allowedOrigins
        : ['http://localhost:3000', 'http://localhost:4200'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 3600,
  });

  // Global validation pipe
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

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('REST API documentation with Swagger')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Authentication and authorization')
    .addTag('Users', 'User management')
    .addTag('Health', 'Health check')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application running on port ${port}`);
  logger.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
