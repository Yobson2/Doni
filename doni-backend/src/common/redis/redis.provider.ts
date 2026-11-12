import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const logger = new Logger('RedisProvider');
    const redisPassword = config.get<string>('REDIS_PASSWORD');
    const nodeEnv = config.get<string>('NODE_ENV');

    const useManagedRedis = nodeEnv === 'staging' || nodeEnv === 'production';

    const tlsConfig = useManagedRedis
      ? {
          tls: {
            rejectUnauthorized:
              config.get('REDIS_SSL_REJECT_UNAUTHORIZED', 'false') === 'true',
          },
        }
      : {};

    const redisClient = new Redis({
      host: config.get<string>('REDIS_HOST'),
      port: config.get<number>('REDIS_PORT'),
      password: redisPassword || undefined,
      ...tlsConfig,
      retryStrategy: (times: number): number | null => {
        if (times > 10) {
          logger.error(
            'Redis connection failed after 10 retries. Please check Redis configuration.',
          );
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        logger.warn(
          `Redis connection attempt ${times} failed. Retrying in ${delay}ms...`,
        );
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (error: Error) => {
      logger.error(`Redis client error: ${error.message}`, error.stack);
    });

    redisClient.on('connect', () => {
      logger.log('Redis client connected successfully');
    });

    redisClient.on('ready', () => {
      logger.log('Redis client ready to accept commands');
    });

    return redisClient;
  },
};
