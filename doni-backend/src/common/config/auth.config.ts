import { ConfigService } from '@nestjs/config';

export const getJWTSecret = (config: ConfigService): string => {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret) {
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production' || nodeEnv === 'staging') {
      throw new Error(
        'JWT_SECRET environment variable is required in production/staging',
      );
    }
    console.warn(
      'WARNING: Using insecure JWT secret. Set JWT_SECRET environment variable.',
    );
    return 'dev-only-insecure-secret-do-not-use-in-production';
  }
  return secret;
};

export const getJWTRefreshSecret = (config: ConfigService): string => {
  const refreshSecret = config.get<string>('JWT_REFRESH_SECRET');
  if (refreshSecret) {
    return refreshSecret;
  }
  return getJWTSecret(config);
};

export const JWT_EXPIRES_IN = '900s';
export const JWT_REFRESH_TOKEN_EXPIRES_IN = '7d';
